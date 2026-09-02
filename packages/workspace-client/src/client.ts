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
  /** Identidade do SERVIÇO Cora. Distinta da identidade do usuário. */
  serviceToken: string
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
 * Cliente do contrato workspace-agent v1.
 *
 * O nome dos headers de autenticação é uma SUPOSIÇÃO até o WORKSPACE publicar o
 * contrato (ticket CORA-001, item 3). Está isolado em `authHeaders()` justamente para
 * que a correção seja de uma função só.
 */
export class WorkspaceClient {
  private readonly baseUrl: string
  private readonly serviceToken: string
  private readonly delegationToken: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch
  private readonly requestIdFactory: () => string

  constructor(opts: WorkspaceClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '')
    this.serviceToken = opts.serviceToken
    this.delegationToken = opts.delegationToken
    this.timeoutMs = opts.timeoutMs ?? 10_000
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch
    this.requestIdFactory = opts.requestIdFactory ?? (() => crypto.randomUUID())
  }

  private authHeaders(): Record<string, string> {
    return {
      // SUPOSIÇÃO — confirmar em tickets/CORA-001/response.md.
      Authorization: `Bearer ${this.delegationToken}`,
      'X-Cora-Service-Token': this.serviceToken,
    }
  }

  /**
   * GET /api/agent/v1/tasks?scope=mine&status=open
   *
   * Valida os parâmetros ANTES de sair da máquina: pedido inválido não vira requisição.
   */
  async listTasks(params: ListTasksParams): Promise<ListTasksResponse> {
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

    const response = await this.request(url, requestId)

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

  private async request(url: string, requestId: string): Promise<Response> {
    const controller = new AbortController()
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
        message:
          cause instanceof Error && cause.name === 'AbortError'
            ? `Workspace não respondeu em ${this.timeoutMs}ms`
            : 'Não foi possível falar com o Workspace',
        httpStatus: null,
        requestId,
      })
    } finally {
      clearTimeout(timer)
    }
  }
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
