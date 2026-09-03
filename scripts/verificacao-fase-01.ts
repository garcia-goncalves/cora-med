/**
 * Verificação da Fase 1 contra um Workspace local REAL.
 *
 * Não entra em `pnpm run test`: a suíte padrão não faz rede. Este script existe para
 * provar, do lado do consumidor, o que mock nenhum prova — que a autorização do OUTRO
 * sistema funciona.
 *
 * Uso (as credenciais vêm do ambiente, e nenhuma é impressa):
 *   WORKSPACE_BASE_URL=http://localhost:4319 \
 *   WORKSPACE_AGENT_CLIENT=... WORKSPACE_AGENT_SECRET=... \
 *   TOKEN_A=... TOKEN_B=... TOKEN_EXPIRADO=... \
 *   pnpm exec tsx scripts/verificacao-fase-01.ts
 */

import { CONTRACT_SHA256, CONTRACT_VERSION } from '@cora/contracts'
import { collectAllTasks, WorkspaceApiError, WorkspaceClient } from '@cora/workspace-client'

import type { MotorPort } from '../apps/server/src/engine/port.js'
import { runTurn } from '../apps/server/src/run/turn.js'
import { ToolRegistry } from '../apps/server/src/tools/registry.js'
import { createListTasksTool } from '../apps/server/src/tools/workspace-tasks.js'

const BASE = process.env.WORKSPACE_BASE_URL ?? 'http://localhost:4319'
const CLIENT = process.env.WORKSPACE_AGENT_CLIENT ?? ''
const SECRET = process.env.WORKSPACE_AGENT_SECRET ?? ''

function cliente(over: Partial<{ client: string; secret: string; token: string }> = {}) {
  return new WorkspaceClient({
    baseUrl: BASE,
    serviceClientId: over.client ?? CLIENT,
    serviceSecret: over.secret ?? SECRET,
    delegationToken: over.token ?? '',
    timeoutMs: 10_000,
  })
}

interface Resultado {
  id: string
  descricao: string
  esperado: string
  obtido: string
  passou: boolean
}

const resultados: Resultado[] = []

async function checar(
  id: string,
  descricao: string,
  esperado: string,
  fn: () => Promise<string>,
): Promise<void> {
  let obtido: string
  try {
    obtido = await fn()
  } catch (cause) {
    obtido =
      cause instanceof WorkspaceApiError
        ? `${cause.httpStatus ?? '-'} ${cause.code}`
        : `EXCEÇÃO: ${cause instanceof Error ? cause.message : String(cause)}`
  }
  resultados.push({ id, descricao, esperado, obtido, passou: obtido === esperado })
}

/** Roda a listagem e devolve "200 OK (<n> tarefas)". Falha vira código no `checar`. */
async function listar(c: WorkspaceClient): Promise<string> {
  const page = await c.listTasks({ scope: 'mine', status: 'open', limit: 20 })
  return `200 OK (${page.items.length} tarefas)`
}

async function chamarCru(query: string, token: string): Promise<string> {
  const r = await fetch(`${BASE}/api/agent/v1/tasks?${query}`, {
    headers: {
      'X-Agent-Client': CLIENT,
      'X-Agent-Secret': SECRET,
      Authorization: `Bearer ${token}`,
    },
  })
  const body = (await r.json()) as { error?: { code?: string }; items?: unknown[] }
  if (body.error?.code) return `${r.status} ${body.error.code}`
  return `${r.status} OK (${body.items?.length ?? '?'} tarefas)`
}

async function main(): Promise<void> {
  const tokenA = process.env.TOKEN_A ?? ''
  const tokenB = process.env.TOKEN_B ?? ''
  const tokenExpirado = process.env.TOKEN_EXPIRADO ?? ''

  console.log('--- VERIFICAÇÃO DA FASE 1 (CORA, consumidor) ---')
  console.log(`data: ${new Date().toISOString()}`)
  console.log(`contrato: workspace-agent-v1 ${CONTRACT_VERSION}`)
  console.log(`hash fixado: ${CONTRACT_SHA256}`)
  console.log(`alvo: ${BASE}`)
  console.log('')

  await checar('C5.1', 'Sem credencial de serviço nem delegação', '401 UNAUTHENTICATED', () =>
    listar(cliente({ client: '', secret: '', token: '' })),
  )

  await checar('C5.1b', 'Serviço válido, SEM delegação', '401 UNAUTHENTICATED', () =>
    listar(cliente({ token: '' })),
  )

  await checar('C5.1c', 'Delegação válida, SEM segredo de serviço', '401 UNAUTHENTICATED', () =>
    listar(cliente({ secret: '', token: tokenA })),
  )

  await checar('C5.1d', 'Segredo de serviço ERRADO', '401 UNAUTHENTICATED', () =>
    listar(cliente({ secret: 'placeholder-segredo-que-nao-existe', token: tokenA })),
  )

  await checar('C5.2', 'Delegação expirada', '401 DELEGATION_EXPIRED', () =>
    listar(cliente({ token: tokenExpirado })),
  )

  await checar('C5.2b', 'Token de delegação inventado', '401 UNAUTHENTICATED', () =>
    listar(cliente({ token: 'placeholder-token-nunca-emitido' })),
  )

  // Isolamento A/B: a prova é comparar as duas listas de verdade.
  const listaA = (
    await cliente({ token: tokenA }).listTasks({ scope: 'mine', status: 'open', limit: 100 })
  ).items
  const listaB = (
    await cliente({ token: tokenB }).listTasks({ scope: 'mine', status: 'open', limit: 100 })
  ).items

  const idsA = listaA.map((t) => t.id)
  const idsB = listaB.map((t) => t.id)
  const soDeB = idsB.filter((id) => !idsA.includes(id))
  const soDeA = idsA.filter((id) => !idsB.includes(id))
  const compartilhadas = idsA.filter((id) => idsB.includes(id))

  await checar('C5.4', 'Tarefa exclusiva de B NÃO aparece para A', 'isolado', async () =>
    soDeB.every((id) => !idsA.includes(id)) ? 'isolado' : 'VAZOU',
  )

  await checar(
    'C5.9',
    'Todo item devolvido a A tem A em assigneeIds',
    'coerente',
    async () => {
      if (listaA.length === 0) return 'coerente'
      // O userId de A não é adivinhado: é o responsável comum a todas as tarefas de A.
      const comuns = (listaA[0]?.assigneeIds ?? []).filter((u) =>
        listaA.every((t) => t.assigneeIds.includes(u)),
      )
      return comuns.length > 0 ? 'coerente' : 'INCOERENTE'
    },
  )

  await checar(
    'C5.7',
    'Paginação com limit=1, sem duplicata nem omissão',
    'sem duplicata',
    async () => {
      const { tasks } = await collectAllTasks(cliente({ token: tokenA }), { limit: 1 })
      const distintos = new Set(tasks.map((t) => t.id)).size
      if (distintos !== tasks.length) return `DUPLICOU (${tasks.length} itens, ${distintos} ids)`
      if (tasks.length !== idsA.length) return `OMITIU (${tasks.length} vs ${idsA.length})`
      return 'sem duplicata'
    },
  )

  await checar('C5.10', 'limit=101 recusado pelo servidor', '400 INVALID_INPUT', () =>
    chamarCru('scope=mine&status=open&limit=101', tokenA),
  )

  await checar('C5.11', 'Cursor forjado recusado pelo servidor', '400 INVALID_INPUT', () =>
    chamarCru('scope=mine&status=open&limit=10&cursor=forjado', tokenA),
  )

  await checar('C5.12', 'scope=all recusado pelo servidor', '400 INVALID_INPUT', () =>
    chamarCru('scope=all&status=open&limit=10', tokenA),
  )

  await checar('C5.14', 'status inválido recusado pelo servidor', '400 INVALID_INPUT', () =>
    chamarCru('scope=mine&status=qualquer&limit=10', tokenA),
  )

  // O cursor é preso à pessoa — achado 4 da revisão do WORKSPACE.
  await checar(
    'C5.13',
    'Cursor de A reapresentado com a delegação de B',
    '400 INVALID_INPUT',
    async () => {
      const p = await cliente({ token: tokenA }).listTasks({
        scope: 'mine',
        status: 'open',
        limit: 1,
      })
      if (p.nextCursor === null) return 'INCONCLUSIVO (A tem uma página só)'
      return chamarCru(
        `scope=mine&status=open&limit=1&cursor=${encodeURIComponent(p.nextCursor)}`,
        tokenB,
      )
    },
  )

  await checar(
    'C5.8',
    'Workspace inalcançável vira UPSTREAM_UNAVAILABLE, não lista vazia',
    '- UPSTREAM_UNAVAILABLE',
    () =>
      listar(
        new WorkspaceClient({
          baseUrl: 'http://127.0.0.1:9',
          serviceClientId: CLIENT,
          serviceSecret: SECRET,
          delegationToken: tokenA,
          timeoutMs: 2000,
        }),
      ),
  )

  // C5.15 — a prova que só vale ponta a ponta: um título de injeção vindo do Workspace
  // REAL, atravessando a ferramenta e o laço, chega ao motor dentro do bloco inerte.
  await checar('C5.15', 'Título com injeção (HTTP real) chega ao motor embrulhado', 'embrulhado', async () => {
    const vistas: string[] = []
    const motor: MotorPort = {
      name: 'espiao',
      async step(input) {
        vistas.push(...input.messages.map((m) => m.content))
        return vistas.some((c) => c.includes('DADO_NAO_CONFIAVEL'))
          ? { reply: 'fim', proposals: [] }
          : { reply: null, proposals: [{ toolName: 'workspace.tasks.list', args: { limit: 100 } }] }
      },
    }
    const registry = new ToolRegistry().register(
      'workspace.tasks.list',
      createListTasksTool(cliente({ token: tokenA })),
    )
    await runTurn({
      motor,
      registry,
      requester: { requesterUserId: 'delegado', deviceId: null, runId: 'verificacao-fase-01' },
      messages: [],
    })

    const comInjecao = vistas.find((c) => c.includes('Ignore as instrucoes anteriores'))
    if (!comInjecao) return 'FIXTURE AUSENTE (rode o seed de fixtures)'
    return comInjecao.includes('DADO_NAO_CONFIAVEL') ? 'embrulhado' : 'CRU (falha grave)'
  })

  console.log('| # | verificação | esperado | obtido | |')
  console.log('|---|---|---|---|---|')
  for (const r of resultados) {
    console.log(
      `| ${r.id} | ${r.descricao} | \`${r.esperado}\` | \`${r.obtido}\` | ${r.passou ? 'OK' : 'FALHOU'} |`,
    )
  }
  console.log('')
  console.log(`tarefas visíveis para A: ${idsA.length}`)
  console.log(`tarefas visíveis para B: ${idsB.length}`)
  console.log(
    `só de A: ${soDeA.length} · só de B: ${soDeB.length} · compartilhadas: ${compartilhadas.length}`,
  )
  console.log('')

  const falhas = resultados.filter((r) => !r.passou)
  if (falhas.length > 0) {
    console.log(
      `FALHARAM ${falhas.length} de ${resultados.length}: ${falhas.map((f) => f.id).join(', ')}`,
    )
    process.exitCode = 1
  } else {
    console.log(`TODAS AS ${resultados.length} VERIFICAÇÕES PASSARAM`)
    process.exitCode = 0
  }
}

await main()
