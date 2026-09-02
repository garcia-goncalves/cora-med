import {
  fallbackCodeForStatus,
  isTransient,
  requiresReauthentication,
  WorkspaceErrorBodySchema,
  type WorkspaceErrorCode,
} from '@cora/contracts'

/**
 * Erro tipado do cliente. Tudo que dá errado ao falar com o Workspace vira uma instância
 * disto — inclusive falha de rede e resposta fora do contrato. Nada de `catch` genérico
 * transformando problema em lista vazia.
 */
export class WorkspaceApiError extends Error {
  readonly code: WorkspaceErrorCode
  readonly httpStatus: number | null
  readonly requestId: string | null

  constructor(args: {
    code: WorkspaceErrorCode
    message: string
    httpStatus: number | null
    requestId: string | null
  }) {
    super(args.message)
    this.name = 'WorkspaceApiError'
    this.code = args.code
    this.httpStatus = args.httpStatus
    this.requestId = args.requestId
  }

  get requiresReauth(): boolean {
    return requiresReauthentication(this.code)
  }

  get transient(): boolean {
    return isTransient(this.code)
  }
}

/**
 * Resposta que chegou, mas não obedece ao contrato (campo faltando, enum desconhecido).
 * Tratada como indisponibilidade: a Cora não adivinha o que o servidor quis dizer.
 */
export class ContractViolationError extends WorkspaceApiError {
  readonly details: string

  constructor(details: string, requestId: string | null) {
    super({
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'Resposta do Workspace fora do contrato acordado',
      httpStatus: null,
      requestId,
    })
    this.name = 'ContractViolationError'
    this.details = details
  }
}

/** Converte um corpo de erro do Workspace no erro tipado do cliente. */
export function toApiError(
  httpStatus: number,
  rawBody: unknown,
  requestId: string | null,
): WorkspaceApiError {
  const parsed = WorkspaceErrorBodySchema.safeParse(rawBody)
  if (parsed.success) {
    return new WorkspaceApiError({
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      httpStatus,
      requestId: parsed.data.error.requestId ?? requestId,
    })
  }
  // Corpo não padronizado (proxy, gateway, erro antes da aplicação): decide pelo status.
  return new WorkspaceApiError({
    code: fallbackCodeForStatus(httpStatus),
    message: `Workspace respondeu ${httpStatus} sem corpo de erro no formato acordado`,
    httpStatus,
    requestId,
  })
}
