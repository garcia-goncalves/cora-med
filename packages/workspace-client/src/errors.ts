import {
  fallbackCodeForStatus,
  isTransient,
  isWriteRefused,
  requiresNewPreview,
  requiresReauthentication,
  WorkspaceErrorBodySchema,
  type Divergencia,
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
  /**
   * Campo a campo, o que mudou entre a prévia e o instante de executar.
   *
   * Só vem com `PRECONDITION_CHANGED`. É daqui que sai a frase que a pessoa lê — e é por
   * isso que ela não pode ser jogada fora no caminho: sem esta lista, "o mundo mudou" é
   * uma frase que não diz o que mudou, e a pessoa não tem como decidir o que fazer.
   */
  readonly divergencias: readonly Divergencia[]

  constructor(args: {
    code: WorkspaceErrorCode
    message: string
    httpStatus: number | null
    requestId: string | null
    divergencias?: readonly Divergencia[]
  }) {
    super(args.message)
    this.name = 'WorkspaceApiError'
    this.code = args.code
    this.httpStatus = args.httpStatus
    this.requestId = args.requestId
    this.divergencias = args.divergencias ?? []
  }

  get requiresReauth(): boolean {
    return requiresReauthentication(this.code)
  }

  get transient(): boolean {
    return isTransient(this.code)
  }

  /** A saída é refazer a prévia e pedir aprovação de novo. */
  get requiresNewPreview(): boolean {
    return requiresNewPreview(this.code)
  }

  /** Nenhuma escrita aconteceu — vale para os seis códigos de escrita, sem exceção. */
  get writeRefused(): boolean {
    return isWriteRefused(this.code)
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

/**
 * A requisição de ESCRITA saiu da máquina e a resposta não voltou.
 *
 * ⚠️ Este é o único estado em que a Cora **não sabe** se gravou. Ele existe como classe
 * própria porque a reação certa é diferente de todas as outras: não é "falhou" (repetir
 * criaria a segunda tarefa) e não é "criou" (talvez não tenha criado). É **reconsultar
 * com a MESMA `Idempotency-Key`** — que é justamente para isso que a chave existe, e por
 * isso ela viaja dentro do erro.
 *
 * Uma leitura que falha assim é só uma leitura que falhou; por isso só a escrita usa esta
 * classe.
 */
export class WriteOutcomeUnknownError extends WorkspaceApiError {
  readonly idempotencyKey: string

  constructor(args: { message: string; requestId: string | null; idempotencyKey: string }) {
    super({
      code: 'UPSTREAM_UNAVAILABLE',
      message: args.message,
      httpStatus: null,
      requestId: args.requestId,
    })
    this.name = 'WriteOutcomeUnknownError'
    this.idempotencyKey = args.idempotencyKey
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
      divergencias: parsed.data.error.divergencias ?? [],
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
