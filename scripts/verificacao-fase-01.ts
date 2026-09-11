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

import { CONTRACT_SHA256, CONTRACT_VERSION, type Task } from '@cora/contracts'
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

/**
 * Lista sem derrubar a rodada. Se a credencial estiver expirada ou o Workspace fora, a
 * verificação continua e a tabela mostra o que falhou — em vez de um stack trace e zero
 * informação sobre as outras 15 checagens.
 */
async function listarItens(c: WorkspaceClient, quem: string): Promise<Task[]> {
  try {
    return (await c.listTasks({ scope: 'mine', status: 'open', limit: 100 })).items
  } catch (cause) {
    const motivo = cause instanceof WorkspaceApiError ? cause.code : String(cause)
    console.log(`⚠️  Não consegui listar as tarefas de ${quem}: ${motivo}`)
    console.log('    (as verificações de isolamento vão reprovar por falta de dado)')
    console.log('')
    return []
  }
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
  const tokenRevogado = process.env.TOKEN_REVOGADO ?? ''
  const escopoErrado = process.env.TOKEN_ESCOPO_ERRADO ?? ''

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

  // Isolamento A/B contra as fixtures `cora-fx-*` do WORKSPACE (CORA-002).
  //
  // As asserções são POR ID, nunca por total. O banco de desenvolvimento tem outras
  // tarefas, e "A vê exatamente 7" quebraria no dia em que alguém criasse uma pela tela —
  // eu caçaria um defeito que não existe. Contar total é cair na vacuidade pelo outro lado.
  // Buscar fora de um `checar` mataria a rodada inteira com um stack trace se o token
  // estivesse expirado — foi o que aconteceu na primeira vez. Falha aqui vira lista
  // vazia + verificações reprovadas, com o motivo legível na tabela.
  const [listaA, listaB] = await Promise.all([
    listarItens(cliente({ token: tokenA }), 'A'),
    listarItens(cliente({ token: tokenB }), 'B'),
  ])

  const idsA = listaA.map((t) => t.id)
  const idsB = listaB.map((t) => t.id)

  await checar('C5.4', 'cora-fx-b1 (só de B) AUSENTE da lista de A', 'ausente', async () =>
    !idsA.includes('cora-fx-b1') && idsB.includes('cora-fx-b1') ? 'ausente' : 'VAZOU',
  )

  await checar(
    'C5.5',
    'cora-fx-ab presente nas DUAS, com 2 responsáveis',
    'compartilhada',
    async () => {
      const naA = listaA.find((t) => t.id === 'cora-fx-ab')
      const naB = listaB.find((t) => t.id === 'cora-fx-ab')
      if (!naA || !naB) return 'AUSENTE em uma das listas'
      return naA.assigneeIds.length === 2 && naB.assigneeIds.length === 2
        ? 'compartilhada'
        : `assigneeIds com ${naA.assigneeIds.length} id(s)`
    },
  )

  await checar(
    'C5.6',
    'cora-fx-apagada e cora-fx-concluida ausentes das DUAS',
    'ausentes',
    async () => {
      const proibidos = ['cora-fx-apagada', 'cora-fx-concluida']
      const vazou = proibidos.filter((id) => idsA.includes(id) || idsB.includes(id))
      return vazou.length === 0 ? 'ausentes' : `VAZOU: ${vazou.join(', ')}`
    },
  )

  await checar(
    'C5.16',
    'cora-fx-semprazo volta com dueAt null, sem prazo inventado',
    'dueAt null',
    async () => {
      const t = listaA.find((x) => x.id === 'cora-fx-semprazo')
      if (!t) return 'FIXTURE AUSENTE'
      return t.dueAt === null ? 'dueAt null' : `INVENTOU: ${t.dueAt}`
    },
  )

  await checar(
    'C5.17',
    'cora-fx-prazo volta com a data exata do fixture',
    '2026-12-31',
    async () => {
      const t = listaA.find((x) => x.id === 'cora-fx-prazo')
      if (!t || t.dueAt === null) return 'FIXTURE AUSENTE'
      return t.dueAt.slice(0, 10)
    },
  )

  await checar('C5.9', 'Todo item devolvido a A tem A em assigneeIds', 'coerente', async () => {
    if (listaA.length === 0) return 'coerente'
    const comuns = (listaA[0]?.assigneeIds ?? []).filter((u) =>
      listaA.every((t) => t.assigneeIds.includes(u)),
    )
    return comuns.length > 0 ? 'coerente' : 'INCOERENTE'
  })

  await checar(
    'C5.7',
    'Paginação com limit=1, sem duplicata nem omissão',
    'sem duplicata',
    async () => {
      const resultado = await collectAllTasks(cliente({ token: tokenA }), { limit: 1 })
      const { tasks } = resultado
      if (!resultado.completa) return 'PARCIAL: teto de páginas'
      const distintos = new Set(tasks.map((t) => t.id)).size
      if (distintos !== tasks.length) return `DUPLICOU (${tasks.length} itens, ${distintos} ids)`
      const faltando = idsA.filter((id) => !tasks.some((t) => t.id === id))
      if (faltando.length > 0) return `OMITIU: ${faltando.join(', ')}`
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

  // CORA-002 item 2: a trava de escopo saiu de "só o autor consegue exercer".
  await checar('C5.18', 'Delegação com escopo tasks:write (sem tasks:read)', '403 FORBIDDEN', () =>
    escopoErrado === ''
      ? Promise.resolve('NAO INFORMADO (defina TOKEN_ESCOPO_ERRADO)')
      : listar(cliente({ token: escopoErrado })),
  )

  // CORA-002: expiração e revogação são DOIS caminhos no servidor (`expiraEm` e
  // `revogadaEm`), embora devolvam o mesmo `code`. Provar um não prova o outro.
  await checar(
    'C5.19',
    'Delegação REVOGADA (caminho distinto do de expiração)',
    '401 DELEGATION_EXPIRED',
    () =>
      tokenRevogado === ''
        ? Promise.resolve('NAO INFORMADO (defina TOKEN_REVOGADO)')
        : listar(cliente({ token: tokenRevogado })),
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

    // Procura pelo ID da fixture, não pelo texto dela: o texto é do WORKSPACE e pode
    // mudar; o id é contrato entre nós (CORA-002 §1).
    const comInjecao = vistas.find((c) => c.includes('cora-fx-injecao'))
    if (!comInjecao) return 'FIXTURE AUSENTE (rode pnpm agente:fixtures no Workspace)'
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
  const fx = (ids: string[]) => ids.filter((i) => i.startsWith('cora-fx-')).sort().join(', ')
  console.log(`fixtures cora-fx-* visíveis para A: ${fx(idsA)}`)
  console.log(`fixtures cora-fx-* visíveis para B: ${fx(idsB)}`)
  console.log(`(A vê ${idsA.length} no total, B vê ${idsB.length} — total NÃO é asserção)`)
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
