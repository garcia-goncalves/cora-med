import { z } from 'zod'

/**
 * Erros padronizados do Workspace (briefing, seção 7).
 *
 * Regra que este módulo existe para sustentar: **indisponibilidade não é lista vazia.**
 * Um 503 vira `UPSTREAM_UNAVAILABLE` e a Cora diz "não consegui consultar", nunca
 * "você não tem pendências".
 */

export const WorkspaceErrorCodeSchema = z.enum([
  'INVALID_INPUT',
  'UNAUTHENTICATED',
  'DELEGATION_EXPIRED',
  'FORBIDDEN',
  'CONFLICT',
  'RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
])
export type WorkspaceErrorCode = z.infer<typeof WorkspaceErrorCodeSchema>

export const WorkspaceErrorBodySchema = z.object({
  error: z.object({
    code: WorkspaceErrorCodeSchema,
    message: z.string(),
    requestId: z.string().optional(),
  }),
})
export type WorkspaceErrorBody = z.infer<typeof WorkspaceErrorBodySchema>

/**
 * Código esperado por status HTTP, para quando o corpo não vier no formato acordado
 * (proxy, gateway, servidor caído antes de chegar na aplicação).
 */
export function fallbackCodeForStatus(status: number): WorkspaceErrorCode {
  if (status === 400) return 'INVALID_INPUT'
  if (status === 401) return 'UNAUTHENTICATED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 409) return 'CONFLICT'
  if (status === 429) return 'RATE_LIMITED'
  return 'UPSTREAM_UNAVAILABLE'
}

/** Falha que pede nova autenticação/delegação, em vez de nova tentativa. */
export function requiresReauthentication(code: WorkspaceErrorCode): boolean {
  return code === 'UNAUTHENTICATED' || code === 'DELEGATION_EXPIRED'
}

/**
 * Falha transitória: pode ser repetida. `CONFLICT` fica de fora de propósito — repetir
 * conflito às cegas é exatamente o que produz duplicata em escrita.
 */
export function isTransient(code: WorkspaceErrorCode): boolean {
  return code === 'RATE_LIMITED' || code === 'UPSTREAM_UNAVAILABLE'
}
