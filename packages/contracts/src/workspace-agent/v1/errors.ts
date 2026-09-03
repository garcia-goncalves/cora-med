import { z } from 'zod'

/**
 * Erros padronizados do Workspace, contrato `workspace-agent-v1` 0.2.1.
 *
 * Regra que este módulo existe para sustentar: **indisponibilidade não é lista vazia.**
 * Um 503 vira `UPSTREAM_UNAVAILABLE` e a Cora diz "não consegui consultar", nunca
 * "você não tem pendências".
 *
 * A 0.2.0 acrescentou os cinco conflitos nomeados da escrita. `CONFLICT` genérico
 * continua **reservado e não emitido** pelo servidor: cada conflito pede uma reação
 * diferente da Cora, e um código só obrigaria a decidir pelo texto da mensagem.
 */

/** Os sete códigos que já existiam na 0.1.0, e que a leitura pode devolver. */
export const WorkspaceReadErrorCodeSchema = z.enum([
  'INVALID_INPUT',
  'UNAUTHENTICATED',
  'DELEGATION_EXPIRED',
  'FORBIDDEN',
  'CONFLICT',
  'RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
])

/**
 * Os cinco conflitos nomeados da escrita, mais o `APPROVAL_INVALID` (que é 400).
 * Todos significam **"não gravei nada"**.
 */
export const WorkspaceWriteErrorCodeSchema = z.enum([
  'APPROVAL_INVALID',
  'APPROVAL_EXPIRED',
  'APPROVAL_MISMATCH',
  'APPROVAL_ALREADY_USED',
  'PRECONDITION_CHANGED',
  'IDEMPOTENCY_CONFLICT',
])

export const WorkspaceErrorCodeSchema = z.enum([
  ...WorkspaceReadErrorCodeSchema.options,
  ...WorkspaceWriteErrorCodeSchema.options,
])
export type WorkspaceErrorCode = z.infer<typeof WorkspaceErrorCodeSchema>

/** Uma referência que mudou entre a prévia e o instante de executar. */
export const IdERotuloSchema = z.object({
  id: z.string().min(1),
  rotulo: z.string(),
})
export type IdERotulo = z.infer<typeof IdERotuloSchema>

export const DivergenciaSchema = z.object({
  campo: z.enum(['cliente', 'projeto', 'responsavel']),
  /** O que a pessoa leu e aprovou. */
  aprovado: IdERotuloSchema,
  /** Como está agora. `null` quando deixou de existir ou de estar acessível. */
  atual: IdERotuloSchema.nullable(),
  /**
   * `SEM_ACESSO` é o responsável que saiu da equipe. "Não existe mais" e "perdeu o
   * acesso" pedem frases diferentes para a pessoa ler — por isso são motivos distintos.
   */
  motivo: z.enum(['NAO_ENCONTRADO', 'ROTULO_MUDOU', 'SEM_ACESSO']),
})
export type Divergencia = z.infer<typeof DivergenciaSchema>

export const WorkspaceErrorBodySchema = z.object({
  error: z.object({
    code: WorkspaceErrorCodeSchema,
    message: z.string(),
    requestId: z.string().optional(),
    /** **Presente apenas** com `code: PRECONDITION_CHANGED`. */
    divergencias: z.array(DivergenciaSchema).optional(),
  }),
})
export type WorkspaceErrorBody = z.infer<typeof WorkspaceErrorBodySchema>

/**
 * Código esperado por status HTTP, para quando o corpo não vier no formato acordado
 * (proxy, gateway, servidor caído antes de chegar na aplicação).
 *
 * ⚠️ Um 409 sem corpo legível cai em `CONFLICT` genérico de propósito: o servidor nunca
 * emite esse código, então vê-lo aqui é sinal de que a resposta não veio da aplicação.
 * Chutar `PRECONDITION_CHANGED` faria a Cora inventar um "o mundo mudou" que ninguém disse.
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
 * Falha transitória: pode ser repetida **com a mesma `Idempotency-Key`**.
 *
 * Nenhum código de escrita entra aqui. Todos eles significam "não gravei nada, e repetir
 * igual dá o mesmo resultado" — repetir conflito às cegas é exatamente o que produz
 * duplicata, ou pior, o que faz a Cora insistir num pedido que a pessoa não aprovou.
 */
export function isTransient(code: WorkspaceErrorCode): boolean {
  return code === 'RATE_LIMITED' || code === 'UPSTREAM_UNAVAILABLE'
}

/**
 * Conflito da escrita cuja saída é **refazer a prévia e pedir aprovação de novo**.
 *
 * Fica de fora o `IDEMPOTENCY_CONFLICT`, que é defeito de quem chama (mesma chave, outros
 * argumentos): a saída dali é chave nova, não prévia nova. E fica de fora o
 * `APPROVAL_MISMATCH`, que significa que a Cora enviou coisa diferente da aprovada — isso
 * é defeito nosso, e a trava local `verificarAntesDeExecutar()` deveria tê-lo impedido.
 */
export function requiresNewPreview(code: WorkspaceErrorCode): boolean {
  return (
    code === 'APPROVAL_EXPIRED' ||
    code === 'APPROVAL_ALREADY_USED' ||
    code === 'PRECONDITION_CHANGED'
  )
}

/** Nenhuma escrita aconteceu. Vale para os seis códigos de escrita, sem exceção. */
export function isWriteRefused(code: WorkspaceErrorCode): boolean {
  return WorkspaceWriteErrorCodeSchema.options.includes(
    code as z.infer<typeof WorkspaceWriteErrorCodeSchema>,
  )
}
