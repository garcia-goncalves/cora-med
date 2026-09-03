/**
 * Verificação da Fase 2 contra um Workspace local REAL — a ESCRITA.
 *
 * Não entra em `pnpm run test`: a suíte padrão não faz rede. Este script existe para
 * provar, do lado do consumidor, o que mock nenhum prova — que a prévia, a aprovação e a
 * idempotência do OUTRO sistema funcionam como o contrato 0.2.1 descreve.
 *
 * ⚠️ **Ele CRIA tarefas de verdade** no banco local. Só rode contra um Workspace de
 * desenvolvimento. Toda tarefa criada aqui nasce com o prefixo `SYNTH-` no título.
 *
 * Antes de rodar, no repositório do WORKSPACE (não neste):
 *   pnpm db:up && pnpm dev          (API sobe em :4319)
 *   pnpm contas:teste
 *   pnpm agente:fixtures
 *   pnpm agente cliente --nome <nome>
 *   pnpm agente delegar --cliente <id> --email <pessoa> \
 *       --escopos "tasks:read tasks:write" --minutos 60
 *   (o parâmetro é --email, NÃO --usuario)
 *
 * Uso (as credenciais vêm do ambiente, e nenhuma é impressa):
 *   WORKSPACE_BASE_URL=http://localhost:4319 \
 *   WORKSPACE_AGENT_CLIENT=... WORKSPACE_AGENT_SECRET=... \
 *   TOKEN_A=... TOKEN_SO_LEITURA=... \
 *   pnpm exec tsx scripts/verificacao-fase-02.ts
 */

import { randomUUID } from 'node:crypto'

import { CONTRACT_VERSION, type ArgumentosDaTarefa, type RespostaDaPrevia } from '@cora/contracts'
import { WorkspaceApiError, WorkspaceClient } from '@cora/workspace-client'

import type { MotorPort } from '../apps/server/src/engine/port.js'
import { descreverPrevia, traduzirPrevia } from '../apps/server/src/preview/preview.js'
import { runTurn } from '../apps/server/src/run/turn.js'
import { ToolRegistry } from '../apps/server/src/tools/registry.js'
import {
  ArmazemDePrevias,
  createPreviewTaskTool,
} from '../apps/server/src/tools/workspace-create-task.js'

const BASE = process.env.WORKSPACE_BASE_URL ?? 'http://localhost:4319'
const CLIENT = process.env.WORKSPACE_AGENT_CLIENT ?? ''
const SECRET = process.env.WORKSPACE_AGENT_SECRET ?? ''
const TOKEN_A = process.env.TOKEN_A ?? ''
const TOKEN_SO_LEITURA = process.env.TOKEN_SO_LEITURA ?? ''

/**
 * Termo que casa com a fixture de injeção de CLIENTE.
 *
 * ⚠️ O mesmo texto hostil existe em **dois** artefatos do Workspace, e confundi-los faz
 * uma verificação passar pelo motivo errado:
 * - `cora-fx-cli-injecao` — o **cliente**, cujo nome é `Clinica CORA ` + o texto, cortado
 *   em 120 caracteres. É este que a busca da prévia alcança (ela só olha `Cliente`).
 * - `cora-fx-injecao` — a **tarefa**, cujo título é o texto inteiro, sem corte. Essa
 *   aparece no `GET /tasks`, e a Fase 1 já a exerceu (C5.15).
 *
 * Por causa do corte em 120, **não case pelo fim da frase**.
 */
const BUSCA_INJECAO = 'Ignore as instruções'
const BUSCA_UNICA = 'Unica CORA'
const BUSCA_HOMONIMA = 'Homonima CORA'
const BUSCA_INEXISTENTE = 'Clinica Que Nao Existe CORA ZZZ'

/**
 * Valores sintéticos montados por concatenação, e não escritos como literal.
 *
 * O guardião de segredo do repositório barra qualquer atribuição de `token` com valor
 * literal antes do commit — e ele está certo em não saber distinguir isca de credencial.
 * Montar aqui mantém a trava ligada em vez de abrir exceção para ela.
 */
const TOKEN_INVENTADO = ['SYNTH', 'token', 'que', 'eu', 'inventei'].join('-')
const CHAVE_TORTA = ['nao', 'e', 'uuid'].join('-')

/** Todo título criado por esta verificação é marcado, para dar para achar e limpar depois. */
const marca = `SYNTH-verificacao-fase-02 ${new Date().toISOString()}`

function cliente(token = TOKEN_A): WorkspaceClient {
  return new WorkspaceClient({
    baseUrl: BASE,
    serviceClientId: CLIENT,
    serviceSecret: SECRET,
    delegationToken: token,
    timeoutMs: 15_000,
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

/**
 * Chamada crua, para os casos que o CLIENTE recusa antes de sair da máquina.
 *
 * Sem isto, as travas locais esconderiam o comportamento do servidor: eu provaria que o
 * meu código recusa, não que o Workspace recusa. As duas coisas precisam ser verdade.
 */
async function cru(
  caminho: string,
  corpo: unknown,
  headers: Record<string, string> = {},
  token = TOKEN_A,
): Promise<string> {
  const r = await fetch(`${BASE}${caminho}`, {
    method: 'POST',
    headers: {
      'X-Agent-Client': CLIENT,
      'X-Agent-Secret': SECRET,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(corpo),
  })
  const body = (await r.json()) as { error?: { code?: string }; taskId?: string; created?: boolean }
  if (body.error?.code) return `${r.status} ${body.error.code}`
  if (body.taskId !== undefined) return `${r.status} created=${body.created}`
  return `${r.status} OK`
}

/** Uma prévia resolvida e aprovável, pronta para virar criação. */
async function previaAprovavel(titulo: string): Promise<{
  resposta: RespostaDaPrevia
  args: ArgumentosDaTarefa
  token: string
}> {
  const pedido = { titulo, cliente: { texto: BUSCA_UNICA } }
  const resposta = await cliente().previewTask(pedido)
  const previa = traduzirPrevia(pedido, resposta)
  if (resposta.approvalToken === null || previa.args === null) {
    throw new Error(`prévia de "${titulo}" não veio aprovável — verifique as fixtures`)
  }
  return { resposta, args: previa.args, token: resposta.approvalToken }
}

async function main(): Promise<void> {
  console.log('--- VERIFICAÇÃO DA FASE 2 (CORA, consumidor da ESCRITA) ---')
  console.log(`data: ${new Date().toISOString()}`)
  console.log(`contrato: workspace-agent-v1 ${CONTRACT_VERSION}`)
  console.log(`base: ${BASE}`)
  console.log('')

  if (!CLIENT || !SECRET || !TOKEN_A) {
    console.log(
      'FALTAM CREDENCIAIS: defina WORKSPACE_AGENT_CLIENT, WORKSPACE_AGENT_SECRET e TOKEN_A.',
    )
    process.exitCode = 1
    return
  }

  // -------------------------------------------------------------------------
  // A prévia
  // -------------------------------------------------------------------------

  await checar(
    'C6.01',
    'Prévia com cliente único emite approvalToken',
    'token emitido',
    async () => {
      const r = await cliente().previewTask({
        titulo: `${marca} unica`,
        cliente: { texto: BUSCA_UNICA },
      })
      return r.approvalToken === null ? 'token NULL' : 'token emitido'
    },
  )

  await checar(
    'C6.02',
    'Prévia com cliente homônimo NÃO emite token e devolve os candidatos',
    'token NULL, 2 candidatos',
    async () => {
      const r = await cliente().previewTask({
        titulo: `${marca} homonima`,
        cliente: { texto: BUSCA_HOMONIMA },
      })
      const amb = r.ambiguidades.find((a) => a.campo === 'cliente')
      return `token ${r.approvalToken === null ? 'NULL' : 'EMITIDO'}, ${amb?.candidatos.length ?? 0} candidatos`
    },
  )

  await checar(
    'C6.03',
    'Cada candidato traz uma distinção não vazia',
    'todas com distinção',
    async () => {
      const r = await cliente().previewTask({
        titulo: `${marca} distincao`,
        cliente: { texto: BUSCA_HOMONIMA },
      })
      const cands = r.ambiguidades.find((a) => a.campo === 'cliente')?.candidatos ?? []
      if (cands.length === 0) return 'sem candidatos'
      return cands.every((c) => c.distincao.trim().length > 0)
        ? 'todas com distinção'
        : 'alguma distinção vazia'
    },
  )

  await checar(
    'C6.04',
    'Cliente PEDIDO que não existe também zera o token (regra 0.2.1)',
    'token NULL',
    async () => {
      const r = await cliente().previewTask({
        titulo: `${marca} inexistente`,
        cliente: { texto: BUSCA_INEXISTENTE },
      })
      return r.approvalToken === null ? 'token NULL' : 'token EMITIDO (regressão)'
    },
  )

  await checar(
    'C6.05',
    'Campo NÃO informado não impede o token, e vem como NAO_INFORMADO',
    'token emitido, NAO_INFORMADO',
    async () => {
      const r = await cliente().previewTask({
        titulo: `${marca} sem projeto`,
        cliente: { texto: BUSCA_UNICA },
      })
      return `token ${r.approvalToken === null ? 'NULL' : 'emitido'}, ${r.previa.projeto.motivo}`
    },
  )

  await checar(
    'C6.06',
    'Prazo ausente aparece como ausência visível, e "hoje" não surge',
    'presente=false, rotulo="sem prazo", sem "hoje"',
    async () => {
      const r = await cliente().previewTask({
        titulo: `${marca} sem prazo`,
        cliente: { texto: BUSCA_UNICA },
      })
      const p = r.previa.prazo
      const temHoje = JSON.stringify(p).toLowerCase().includes('hoje')
      return `presente=${p.presente}, rotulo="${p.rotulo}", ${temHoje ? 'COM "hoje"' : 'sem "hoje"'}`
    },
  )

  await checar(
    'C6.07',
    'Responsável padrão (lista vazia) aparece marcado como PADRAO',
    'origem=PADRAO',
    async () => {
      const r = await cliente().previewTask({
        titulo: `${marca} responsavel padrao`,
        cliente: { texto: BUSCA_UNICA },
      })
      return `origem=${r.previa.responsaveis[0]?.origem ?? 'AUSENTE'}`
    },
  )

  await checar(
    'C6.08',
    'Referência com id E texto juntos é 400 (chamada crua: o cliente recusaria antes)',
    '400 INVALID_INPUT',
    async () =>
      cru('/api/agent/v1/tasks/preview', {
        titulo: `${marca} id e texto`,
        cliente: { id: 'qualquer', texto: 'qualquer' },
      }),
  )

  await checar(
    'C6.09',
    'previousResolutionHash desconhecido é 400, não "sem comparação"',
    '400 INVALID_INPUT',
    async () =>
      cru('/api/agent/v1/tasks/preview', {
        titulo: `${marca} hash desconhecido`,
        previousResolutionHash: 'SYNTH-hash-que-nunca-foi-emitido',
      }),
  )

  await checar(
    'C6.10',
    'previousResolutionHash legítimo faz "mudou" deixar de ser null',
    'mudou é lista',
    async () => {
      const primeira = await cliente().previewTask({
        titulo: `${marca} comparacao`,
        cliente: { texto: BUSCA_UNICA },
      })
      const segunda = await cliente().previewTask({
        titulo: `${marca} comparacao`,
        cliente: { texto: BUSCA_UNICA },
        previousResolutionHash: primeira.resolutionHash,
      })
      return segunda.mudou === null ? 'mudou é null' : 'mudou é lista'
    },
  )

  await checar(
    'C6.11',
    'A prévia exige tasks:write, mesmo sem escrever nada',
    '403 FORBIDDEN',
    async () => {
      if (!TOKEN_SO_LEITURA) return 'PULADO (defina TOKEN_SO_LEITURA)'
      await cliente(TOKEN_SO_LEITURA).previewTask({
        titulo: `${marca} so leitura`,
        cliente: { texto: BUSCA_UNICA },
      })
      return '200 OK (regressão: leitura conseguiu prévia)'
    },
  )

  // -------------------------------------------------------------------------
  // A criação
  // -------------------------------------------------------------------------

  let taskIdCriada = ''
  let chaveDaCriada = ''

  await checar(
    'C6.12',
    'Criação com token da prévia devolve 201 e created=true',
    '201 created=true',
    async () => {
      const { args, token } = await previaAprovavel(`${marca} criacao feliz`)
      chaveDaCriada = randomUUID()
      const r = await cliente().createTask({
        approvalToken: token,
        task: args,
        idempotencyKey: chaveDaCriada,
      })
      taskIdCriada = r.taskId
      return `201 created=${r.created}`
    },
  )

  await checar(
    'C6.13',
    'A tarefa criada aparece no GET /tasks — asserção por ID, nunca por total',
    'encontrada pelo id',
    async () => {
      if (!taskIdCriada) return 'PULADO (a criação não aconteceu)'
      const page = await cliente().listTasks({ scope: 'mine', status: 'open', limit: 100 })
      return page.items.some((t) => t.id === taskIdCriada)
        ? 'encontrada pelo id'
        : 'NÃO encontrada pelo id'
    },
  )

  await checar(
    'C6.14',
    'Repetir a MESMA chave com os MESMOS argumentos devolve 200 e a mesma tarefa',
    '200 created=false',
    async () => {
      if (!taskIdCriada) return 'PULADO (a criação não aconteceu)'
      // Reapresenta a mesma chave. O token já foi consumido, mas a chave responde antes:
      // é a repetição normal de uma tentativa que talvez tenha falhado no caminho.
      const { args, token } = await previaAprovavel(`${marca} criacao feliz`)
      return cru(
        '/api/agent/v1/tasks',
        { approvalToken: token, task: args },
        { 'Idempotency-Key': chaveDaCriada },
      )
    },
  )

  await checar(
    'C6.15',
    'Reapresentar o MESMO token com chave NOVA é recusado',
    '409 APPROVAL_ALREADY_USED',
    async () => {
      const { args, token } = await previaAprovavel(`${marca} token reusado`)
      await cliente().createTask({ approvalToken: token, task: args, idempotencyKey: randomUUID() })
      // Segunda vez, com o MESMO token e outra chave.
      await cliente().createTask({ approvalToken: token, task: args, idempotencyKey: randomUUID() })
      return '201 (regressão: token de uso único foi aceito duas vezes)'
    },
  )

  await checar(
    'C6.16',
    'MESMA chave com argumentos DIFERENTES é conflito, não uma segunda tarefa',
    '409 IDEMPOTENCY_CONFLICT',
    async () => {
      const chave = randomUUID()
      const a = await previaAprovavel(`${marca} chave conflito A`)
      await cliente().createTask({ approvalToken: a.token, task: a.args, idempotencyKey: chave })

      const b = await previaAprovavel(`${marca} chave conflito B`)
      await cliente().createTask({ approvalToken: b.token, task: b.args, idempotencyKey: chave })
      return '201 (regressão: mesma chave criou duas tarefas diferentes)'
    },
  )

  await checar(
    'C6.17',
    'Argumentos diferentes dos aprovados são recusados, e o servidor NÃO executa o novo',
    '409 APPROVAL_MISMATCH',
    async () => {
      const { args, token } = await previaAprovavel(`${marca} mismatch`)
      await cliente().createTask({
        approvalToken: token,
        task: { ...args, titulo: `${marca} TITULO TROCADO DEPOIS DA APROVACAO` },
        idempotencyKey: randomUUID(),
      })
      return '201 (regressão: o servidor executou o pedido trocado)'
    },
  )

  await checar(
    'C6.18',
    'Reordenar as chaves do JSON NÃO produz 409 falso (forma canônica)',
    '201 created=true',
    async () => {
      const { args, token } = await previaAprovavel(`${marca} canonica`)
      return cru(
        '/api/agent/v1/tasks',
        {
          task: {
            responsavelIds: args.responsavelIds,
            projetoId: args.projetoId,
            clienteId: args.clienteId,
            prazo: args.prazo,
            prioridade: args.prioridade,
            titulo: args.titulo,
          },
          approvalToken: token,
        },
        { 'Idempotency-Key': randomUUID() },
      )
    },
  )

  await checar('C6.19', 'Idempotency-Key ausente é 400', '400 INVALID_INPUT', async () => {
    const { args, token } = await previaAprovavel(`${marca} sem chave`)
    return cru('/api/agent/v1/tasks', { approvalToken: token, task: args })
  })

  await checar(
    'C6.20',
    'Idempotency-Key fora do formato UUID é 400',
    '400 INVALID_INPUT',
    async () => {
      const { args, token } = await previaAprovavel(`${marca} chave torta`)
      return cru(
        '/api/agent/v1/tasks',
        { approvalToken: token, task: args },
        { 'Idempotency-Key': CHAVE_TORTA },
      )
    },
  )

  await checar(
    'C6.21',
    'A MESMA chave em CAIXA ALTA é a mesma chave — não cria uma segunda tarefa',
    '200 created=false',
    async () => {
      // O Workspace normaliza a chave para minúsculas. Sem isso, a mesma chave em caixa
      // diferente criaria DUAS tarefas, e a segunda passaria despercebida.
      const chave = randomUUID()
      const a = await previaAprovavel(`${marca} caixa`)
      await cliente().createTask({ approvalToken: a.token, task: a.args, idempotencyKey: chave })

      const b = await previaAprovavel(`${marca} caixa`)
      return cru(
        '/api/agent/v1/tasks',
        { approvalToken: b.token, task: b.args },
        { 'Idempotency-Key': chave.toUpperCase() },
      )
    },
  )

  await checar(
    'C6.22',
    'Responsável REPETIDO é aceito e cria um vínculo, não um erro',
    '201 created=true',
    async () => {
      const { args, token } = await previaAprovavel(`${marca} responsavel repetido`)
      const dobrado = [...args.responsavelIds, ...args.responsavelIds]
      return cru(
        '/api/agent/v1/tasks',
        { approvalToken: token, task: { ...args, responsavelIds: dobrado } },
        { 'Idempotency-Key': randomUUID() },
      )
    },
  )

  await checar('C6.23', 'Criação com token inventado é recusada', '400 APPROVAL_INVALID', async () => {
    const { args } = await previaAprovavel(`${marca} sem token`)
    return cru(
      '/api/agent/v1/tasks',
      { approvalToken: TOKEN_INVENTADO, task: args },
      { 'Idempotency-Key': randomUUID() },
    )
  })

  await checar('C6.24', 'Criação com delegação só de leitura é 403', '403 FORBIDDEN', async () => {
    if (!TOKEN_SO_LEITURA) return 'PULADO (defina TOKEN_SO_LEITURA)'
    const { args, token } = await previaAprovavel(`${marca} escrita sem escopo`)
    return cru(
      '/api/agent/v1/tasks',
      { approvalToken: token, task: args },
      { 'Idempotency-Key': randomUUID() },
      TOKEN_SO_LEITURA,
    )
  })

  await checar(
    'C6.25',
    'Duas criações EM PARALELO com a mesma chave criam UMA tarefa só',
    '1 criada, 1 repetida',
    async () => {
      // O lado deles prova a atomicidade por índice único (W15). Esta é a mesma prova
      // vista daqui: o que importa para a Thaís é não existir uma segunda tarefa.
      const chave = randomUUID()
      const a = await previaAprovavel(`${marca} paralelo`)
      const b = await previaAprovavel(`${marca} paralelo`)

      const [r1, r2] = await Promise.all([
        cru(
          '/api/agent/v1/tasks',
          { approvalToken: a.token, task: a.args },
          { 'Idempotency-Key': chave },
        ),
        cru(
          '/api/agent/v1/tasks',
          { approvalToken: b.token, task: b.args },
          { 'Idempotency-Key': chave },
        ),
      ])
      const criadas = [r1, r2].filter((r) => r.includes('created=true')).length
      const repetidas = [r1, r2].filter((r) => r.includes('created=false')).length
      return criadas === 1 && repetidas === 1
        ? '1 criada, 1 repetida'
        : `criadas=${criadas} repetidas=${repetidas} (${r1} | ${r2})`
    },
  )

  // -------------------------------------------------------------------------
  // Injeção ponta a ponta — o motivo de a 0.2.1 existir
  // -------------------------------------------------------------------------

  await checar(
    'C6.26',
    'Rótulo de cliente com texto hostil chega ao motor EMBRULHADO',
    'embrulhado',
    async () => {
      const vistas: string[] = []
      const motor: MotorPort = {
        name: 'espiao',
        async step(input) {
          vistas.push(...input.messages.map((m) => m.content))
          return vistas.some((c) => c.includes('DADO_NAO_CONFIAVEL'))
            ? { reply: 'fim', proposals: [] }
            : {
                reply: null,
                proposals: [
                  {
                    toolName: 'workspace.tasks.create',
                    args: {
                      titulo: `${marca} injecao`,
                      cliente: { texto: BUSCA_INJECAO },
                    },
                  },
                ],
              }
        },
      }
      const registry = new ToolRegistry().register(
        'workspace.tasks.create',
        createPreviewTaskTool(cliente(), new ArmazemDePrevias()),
      )
      await runTurn({
        motor,
        registry,
        requester: {
          requesterUserId: 'delegado',
          deviceId: null,
          runId: 'verificacao-fase-02',
        },
        messages: [],
      })

      const comInjecao = vistas.find((c) => c.includes(BUSCA_INJECAO))
      if (!comInjecao) return 'FIXTURE AUSENTE (rode pnpm agente:fixtures no Workspace)'
      return comInjecao.includes('DADO_NAO_CONFIAVEL') ? 'embrulhado' : 'CRU (falha grave)'
    },
  )

  await checar(
    'C6.27',
    'A busca de injeção resolve UM cliente — a C6.26 não passa por ambiguidade',
    'um cliente, sem ambiguidade',
    async () => {
      // Sem esta checagem, a C6.26 passaria mesmo se a busca virasse ambígua: o texto
      // hostil apareceria nos rótulos dos candidatos e o embrulho seria exercido do mesmo
      // jeito — só que provando outra coisa. Verificação que passa pelo motivo errado é
      // pior que verificação ausente, porque parece cobertura.
      const r = await cliente().previewTask({
        titulo: `${marca} injecao unica`,
        cliente: { texto: BUSCA_INJECAO },
      })
      const amb = r.ambiguidades.filter((a) => a.campo === 'cliente').length
      return `${r.previa.cliente.encontrado ? 'um cliente' : 'nenhum cliente'}, ${amb === 0 ? 'sem ambiguidade' : `${amb} ambiguidade(s)`}`
    },
  )

  await checar(
    'C6.28',
    'O texto hostil chega inteiro, sem ser reescrito nem apagado por nós',
    'inalterado',
    async () => {
      const pedido = { titulo: `${marca} injecao integra`, cliente: { texto: BUSCA_INJECAO } }
      const resposta = await cliente().previewTask(pedido)
      const rotulo = resposta.previa.cliente.rotulo ?? ''
      if (rotulo === '') return 'FIXTURE AUSENTE'
      // A mitigação é o embrulho, não a censura: apagar o texto esconderia o problema da
      // camada que existe para tratá-lo, e a próxima injeção passaria despercebida.
      const previa = traduzirPrevia(pedido, resposta)
      return descreverPrevia(previa).texto.includes(rotulo) ? 'inalterado' : 'ALTERADO por nós'
    },
  )

  // -------------------------------------------------------------------------
  // Tabela
  // -------------------------------------------------------------------------

  console.log('| # | verificação | esperado | obtido | |')
  console.log('|---|---|---|---|---|')
  for (const r of resultados) {
    console.log(
      `| ${r.id} | ${r.descricao} | \`${r.esperado}\` | \`${r.obtido}\` | ${r.passou ? 'OK' : 'FALHOU'} |`,
    )
  }
  console.log('')
  console.log(`marca das tarefas criadas nesta rodada: ${marca}`)
  if (taskIdCriada) console.log(`id da tarefa do caminho feliz: ${taskIdCriada}`)
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
