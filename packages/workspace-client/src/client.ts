import {
  ArgumentosDaTarefaSchema,
  CONTRACT_SHA256,
  CONTRACT_VERSION,
  IDEMPOTENCY_KEY_FORMATO,
  ListTasksParamsSchema,
  ListTasksResponseSchema,
  PedidoDePreviaSchema,
  RespostaDaPreviaSchema,
  TarefaCriadaSchema,
  type ArgumentosDaTarefa,
  type ListTasksParams,
  type ListTasksResponse,
  type PedidoDePrevia,
  type RespostaDaPrevia,
  type TarefaCriada,
} from '@cora/contracts'
import type { z } from 'zod'

import {
  ContractViolationError,
  toApiError,
  WorkspaceApiError,
  WriteOutcomeUnknownError,
} from './errors.js'

export interface WorkspaceClientOptions {
  baseUrl: string
  /** Metade 1 da identidade do SERVIÇO Cora: quem é o programa (`AgentClient`). */
  serviceClientId: string
  /** Metade 2: o segredo correspondente. Aparece uma vez na emissão e vira hash no banco. */
  serviceSecret: string
  /**
   * Token de delegação que representa o usuário humano. O Workspace deriva o
   * `requesterUserId` DAQUI. A Cora nunca envia `userId` solto esperando ser obedecida.
   */
  delegationToken: string
  timeoutMs?: number
  /** Injetável para teste. Nenhum teste da suíte usa o fetch real. */
  fetchImpl?: typeof fetch
  /** Injetável para teste determinístico de `X-Request-Id`. */
  requestIdFactory?: () => string
}

/** O que `createTask` precisa saber, e nada além disso. */
export interface PedidoDeCriacaoDoCliente {
  /** O valor opaco devolvido pela prévia. Uso único. */
  approvalToken: string
  task: ArgumentosDaTarefa
  /**
   * UUID escolhido por nós, **nunca derivado do conteúdo**. Quem gera é
   * `novaChaveDeIdempotencia()`; quem repete uma tentativa reaproveita a MESMA chave.
   */
  idempotencyKey: string
}

/**
 * Cliente do contrato workspace-agent v1, versão `0.2.1`, hash `19009cb7…1b50e` —
 * recebido em CORA-001/CORA-003 e recalculado nesta máquina.
 */
export class WorkspaceClient {
  private readonly baseUrl: string
  private readonly serviceClientId: string
  private readonly serviceSecret: string
  private readonly delegationToken: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch
  private readonly requestIdFactory: () => string

  constructor(opts: WorkspaceClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '')
    this.serviceClientId = opts.serviceClientId
    this.serviceSecret = opts.serviceSecret
    this.delegationToken = opts.delegationToken
    this.timeoutMs = opts.timeoutMs ?? 10_000
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch
    this.requestIdFactory = opts.requestIdFactory ?? (() => crypto.randomUUID())
  }

  /**
   * As duas metades da credencial, conforme o contrato (seção `securitySchemes`).
   *
   * Nenhuma basta sozinha: o par de serviço diz QUE PROGRAMA está falando, o Bearer diz
   * EM NOME DE QUEM. Faltando qualquer uma, o Workspace responde 401.
   *
   * A Cora não envia `userId` em lugar nenhum — não existe esse parâmetro no contrato.
   */
  private authHeaders(): Record<string, string> {
    return {
      'X-Agent-Client': this.serviceClientId,
      'X-Agent-Secret': this.serviceSecret,
      Authorization: `Bearer ${this.delegationToken}`,
    }
  }

  /**
   * GET /api/agent/v1/tasks?scope=mine&status=open
   *
   * Valida os parâmetros ANTES de sair da máquina: pedido inválido não vira requisição.
   */
  async listTasks(
    params: ListTasksParams,
    opts: { signal?: AbortSignal } = {},
  ): Promise<ListTasksResponse> {
    const parsed = ListTasksParamsSchema.safeParse(params)
    if (!parsed.success) throw erroDeEntrada(parsed.error)

    const query = new URLSearchParams({
      scope: parsed.data.scope,
      status: parsed.data.status,
      limit: String(parsed.data.limit),
    })
    if (parsed.data.cursor) query.set('cursor', parsed.data.cursor)

    const requestId = this.requestIdFactory()
    const response = await this.request(
      { url: `${this.baseUrl}/api/agent/v1/tasks?${query.toString()}`, method: 'GET' },
      requestId,
      opts.signal,
    )
    return this.lerResposta(response, requestId, ListTasksResponseSchema)
  }

  /**
   * POST /api/agent/v1/tasks/preview — **leitura pura**.
   *
   * Não escreve nada, não consome cota de aprovação e pode ser refeita quantas vezes for
   * preciso. É o que permite perguntar à pessoa e tentar de novo sem custo.
   *
   * ⚠️ **Prévia ambígua é `200`, não erro.** Vem com `approvalToken: null` e
   * `ambiguidades[]` preenchido. Quem chama tem de olhar o token, não o status: tratar
   * ambiguidade como falha faria a Cora repetir com os mesmos dados, em laço.
   */
  async previewTask(
    pedido: PedidoDePrevia,
    opts: { signal?: AbortSignal } = {},
  ): Promise<RespostaDaPrevia> {
    const parsed = PedidoDePreviaSchema.safeParse(pedido)
    if (!parsed.success) throw erroDeEntrada(parsed.error)

    const requestId = this.requestIdFactory()
    const response = await this.request(
      {
        url: `${this.baseUrl}/api/agent/v1/tasks/preview`,
        method: 'POST',
        body: parsed.data,
      },
      requestId,
      opts.signal,
    )
    const resposta = await this.lerResposta(response, requestId, RespostaDaPreviaSchema)

    // Coerência interna: token junto com ambiguidade é o servidor se contradizendo, e
    // aproveitá-lo seria gravar em cima de uma escolha que ninguém fez. A camada de
    // apresentação também recusa isso; aqui a resposta nem chega a ser devolvida.
    if (resposta.approvalToken !== null && resposta.ambiguidades.length > 0) {
      throw new ContractViolationError(
        'prévia veio com approvalToken E ambiguidades[] — autorização sobre escolha não feita',
        requestId,
      )
    }
    if (resposta.approvalToken === null && resposta.approvalExpiresAt !== null) {
      throw new ContractViolationError(
        'prévia sem approvalToken trouxe approvalExpiresAt',
        requestId,
      )
    }
    return resposta
  }

  /**
   * POST /api/agent/v1/tasks — a criação de verdade.
   *
   * Três coisas que este método garante, e que são a razão de ele não ser um `fetch` solto:
   *
   * 1. **A `Idempotency-Key` é obrigatória e conferida no formato antes de sair.** Chave
   *    malformada viraria `400` do outro lado depois de queimar uma viagem.
   * 2. **`201` e `200` são resultados diferentes, e o `created` do corpo tem de concordar
   *    com o status.** Discordar é violação de contrato: é o que faria a Cora anunciar
   *    "criei" duas vezes para a mesma tarefa.
   * 3. **Falha de transporte depois de enviar não vira "não criou".** Vira
   *    `WriteOutcomeUnknownError`, com a chave dentro, para reconsultar com a MESMA chave.
   */
  async createTask(
    pedido: PedidoDeCriacaoDoCliente,
    opts: { signal?: AbortSignal } = {},
  ): Promise<TarefaCriada> {
    if (!IDEMPOTENCY_KEY_FORMATO.test(pedido.idempotencyKey)) {
      throw new WorkspaceApiError({
        code: 'INVALID_INPUT',
        message:
          'Idempotency-Key precisa ter o formato UUID (8-4-4-4-12 hexadecimal). ' +
          'Ela é escolhida por nós e nunca derivada do conteúdo.',
        httpStatus: null,
        requestId: null,
      })
    }
    if (pedido.approvalToken.length === 0) {
      throw new WorkspaceApiError({
        code: 'APPROVAL_INVALID',
        message: 'Sem approvalToken não há o que executar: a prévia é que autoriza a gravação.',
        httpStatus: null,
        requestId: null,
      })
    }

    const parsed = ArgumentosDaTarefaSchema.safeParse(pedido.task)
    if (!parsed.success) throw erroDeEntrada(parsed.error)

    const requestId = this.requestIdFactory()
    const response = await this.request(
      {
        url: `${this.baseUrl}/api/agent/v1/tasks`,
        method: 'POST',
        body: { approvalToken: pedido.approvalToken, task: parsed.data },
        headers: { 'Idempotency-Key': pedido.idempotencyKey },
        idempotencyKey: pedido.idempotencyKey,
      },
      requestId,
      opts.signal,
    )

    const criada = await this.lerResposta(response, requestId, TarefaCriadaSchema)

    const esperado = response.status === 201
    if (criada.created !== esperado) {
      throw new ContractViolationError(
        `HTTP ${response.status} com "created": ${criada.created} — status e corpo discordam ` +
          'sobre a tarefa ter nascido agora',
        requestId,
      )
    }
    return criada
  }

  /**
   * Lê o corpo, decide erro-ou-sucesso e valida a forma. Um caminho só para os três
   * endpoints: duas leituras de resposta é como uma delas esquece de conferir a versão.
   */
  private async lerResposta<S extends z.ZodType<{ contractVersion: string }>>(
    response: Response,
    requestId: string,
    schema: S,
  ): Promise<z.infer<S>> {
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new ContractViolationError('corpo da resposta não é JSON', requestId)
    }

    if (!response.ok) throw toApiError(response.status, body, requestId)

    const validated = schema.safeParse(body)
    if (!validated.success) {
      throw new ContractViolationError(
        validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        requestId,
      )
    }

    if (validated.data.contractVersion !== CONTRACT_VERSION) {
      throw new ContractViolationError(
        `contractVersion recebida "${validated.data.contractVersion}", esperada "${CONTRACT_VERSION}"`,
        requestId,
      )
    }
    return validated.data
  }

  /**
   * `external` é o cancelamento do turno da Cora; o controller interno é o timeout.
   * Os dois precisam abortar a MESMA requisição, senão cancelar um turno deixa o fetch
   * em voo consumindo conexão até o timeout.
   */
  private async request(
    req: {
      url: string
      method: 'GET' | 'POST'
      body?: unknown
      headers?: Record<string, string>
      /** Presente só na escrita. É o que distingue "falhou" de "não sei se gravou". */
      idempotencyKey?: string
    },
    requestId: string,
    external?: AbortSignal,
  ): Promise<Response> {
    const controller = new AbortController()

    // Cancelado ANTES de sair: aqui a Cora sabe que nada foi enviado, e essa certeza não
    // pode ser perdida no caminho — mesmo numa escrita.
    if (external?.aborted) {
      throw new WorkspaceApiError({
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'Chamada ao Workspace cancelada antes de sair da máquina',
        httpStatus: null,
        requestId,
      })
    }

    const onExternalAbort = () => controller.abort()
    external?.addEventListener('abort', onExternalAbort, { once: true })

    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await this.fetchImpl(req.url, {
        method: req.method,
        // ⚠️ NUNCA seguir redirecionamento. O `undici` remove `authorization` ao cruzar
        // origem, mas NÃO remove cabeçalho próprio: `X-Agent-Client` e `X-Agent-Secret`
        // iriam junto, e num 307/308 o corpo do POST — com o `approvalToken` dentro —
        // seria reenviado ao destino novo. A metade de serviço da credencial é a que não
        // expira sozinha: rotacioná-la é emissão nova, não renovação. A API do contrato
        // não redireciona, então seguir redirecionamento aqui não serve a caso legítimo
        // nenhum e só abre a porta para um proxy mal configurado na frente do Workspace.
        redirect: 'error',
        headers: {
          ...this.authHeaders(),
          ...(req.headers ?? {}),
          Accept: 'application/json',
          'X-Request-Id': requestId,
          ...(req.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(req.body === undefined ? {} : { body: JSON.stringify(req.body) }),
        signal: controller.signal,
      })
    } catch (cause) {
      const message = abortMessage(cause, external, this.timeoutMs)
      // Rede fora, DNS, timeout. NUNCA vira lista vazia — e, na escrita, nunca vira
      // "não criou": o pedido pode ter chegado e sido gravado.
      if (req.idempotencyKey !== undefined) {
        throw new WriteOutcomeUnknownError({
          message,
          requestId,
          idempotencyKey: req.idempotencyKey,
        })
      }
      throw new WorkspaceApiError({
        code: 'UPSTREAM_UNAVAILABLE',
        message,
        httpStatus: null,
        requestId,
      })
    } finally {
      clearTimeout(timer)
      external?.removeEventListener('abort', onExternalAbort)
    }
  }
}

function erroDeEntrada(error: z.ZodError): WorkspaceApiError {
  return new WorkspaceApiError({
    code: 'INVALID_INPUT',
    message: `Parâmetros inválidos: ${error.issues.map((i) => i.message).join('; ')}`,
    httpStatus: null,
    requestId: null,
  })
}

/** Distingue "o usuário cancelou" de "o Workspace não respondeu a tempo". */
function abortMessage(cause: unknown, external: AbortSignal | undefined, timeoutMs: number): string {
  if (!(cause instanceof Error) || cause.name !== 'AbortError') {
    return 'Não foi possível falar com o Workspace'
  }
  if (external?.aborted) return 'Consulta ao Workspace cancelada'
  return `Workspace não respondeu em ${timeoutMs}ms`
}

/**
 * Trava de honestidade: enquanto o contrato do WORKSPACE não tiver sido recebido e o
 * SHA-256 fixado aqui, nenhum caminho do produto pode afirmar que a integração está feita.
 */
export function assertContractPinned(): void {
  if (CONTRACT_SHA256 === null) {
    throw new Error(
      'Contrato workspace-agent-v1 ainda não foi fixado nesta cópia (CONTRACT_SHA256 é null). ' +
        'Ver tickets/CORA-001 em med-coordination. Integração real está bloqueada.',
    )
  }
}

export function isContractPinned(): boolean {
  return CONTRACT_SHA256 !== null
}
