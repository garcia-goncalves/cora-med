import {
  CONTRACT_SHA256,
  CONTRACT_VERSION,
  ListTasksParamsSchema,
  ListTasksResponseSchema,
  type ListTasksParams,
  type ListTasksResponse,
} from '@cora/contracts'

import { ContractViolationError, toApiError, WorkspaceApiError } from './errors.js'

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

/**
 * Cliente do contrato workspace-agent v1, versão `0.1.0`, hash
 * `3fc5e144…4609b` — recebido em CORA-001 e conferido nesta máquina.
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
   * As duas metades da credencial, conforme o contrato 0.1.0 (seção `securitySchemes`).
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
    if (!parsed.success) {
      throw new WorkspaceApiError({
        code: 'INVALID_INPUT',
        message: `Parâmetros inválidos: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
        httpStatus: null,
        requestId: null,
      })
    }

    const query = new URLSearchParams({
      scope: parsed.data.scope,
      status: parsed.data.status,
      limit: String(parsed.data.limit),
    })
    if (parsed.data.cursor) query.set('cursor', parsed.data.cursor)

    const requestId = this.requestIdFactory()
    const url = `${this.baseUrl}/api/agent/v1/tasks?${query.toString()}`

    const response = await this.request(url, requestId, opts.signal)

    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new ContractViolationError('corpo da resposta não é JSON', requestId)
    }

    if (!response.ok) throw toApiError(response.status, body, requestId)

    const validated = ListTasksResponseSchema.safeParse(body)
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
    url: string,
    requestId: string,
    external?: AbortSignal,
  ): Promise<Response> {
    const controller = new AbortController()
    if (external?.aborted) controller.abort()
    const onExternalAbort = () => controller.abort()
    external?.addEventListener('abort', onExternalAbort, { once: true })

    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          ...this.authHeaders(),
          Accept: 'application/json',
          'X-Request-Id': requestId,
        },
        signal: controller.signal,
      })
    } catch (cause) {
      // Rede fora, DNS, timeout. NUNCA vira lista vazia.
      throw new WorkspaceApiError({
        code: 'UPSTREAM_UNAVAILABLE',
        message: abortMessage(cause, external, this.timeoutMs),
        httpStatus: null,
        requestId,
      })
    } finally {
      clearTimeout(timer)
      external?.removeEventListener('abort', onExternalAbort)
    }
  }
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
