import { z } from 'zod'

/**
 * Protocolo interno da Cora: o que o motor propõe, o que a Cora registra e o que ela
 * de fato executa. O modelo NUNCA executa; ele devolve uma proposta estruturada e o
 * código decide se, como e com qual aprovação aquilo acontece.
 */

/** Categorias de ação do briefing, seção 6. A categoria decide o rito, não o texto. */
export const ActionCategorySchema = z.enum([
  /** Leitura. Roda com autorização normal, sem confirmação repetitiva. */
  'read',
  /** Escrita interna reversível. Roda quando o pedido é claro. */
  'internal_write',
  /** Comunicação externa, envio, portal, financeiro relevante, exclusão. Exige aprovação. */
  'external_effect',
  /** Instalação, privilégio administrativo, configuração de servidor. Fora do escopo. */
  'privileged',
])
export type ActionCategory = z.infer<typeof ActionCategorySchema>

/** Uma chamada de ferramenta proposta pelo motor. */
export const ToolCallProposalSchema = z.object({
  toolName: z.string().min(1),
  args: z.record(z.unknown()),
})
export type ToolCallProposal = z.infer<typeof ToolCallProposalSchema>

/** Contexto de quem pede. Vem da delegação verificada, nunca do texto do modelo. */
export const RequesterContextSchema = z.object({
  requesterUserId: z.string().min(1),
  deviceId: z.string().min(1).nullable(),
  runId: z.string().min(1),
})
export type RequesterContext = z.infer<typeof RequesterContextSchema>

/**
 * Aprovação humana. Vinculada ao conteúdo por hash: qualquer mudança material nos
 * argumentos invalida a aprovação, e ela não é reutilizável.
 */
export const ApprovalSchema = z.object({
  approvalId: z.string().min(1),
  argsHash: z.string().length(64),
  approvedByUserId: z.string().min(1),
  expiresAt: z.string(),
  consumedAt: z.string().nullable(),
})
export type Approval = z.infer<typeof ApprovalSchema>

/** Decisão da política sobre uma proposta. */
export type PolicyDecision =
  | { kind: 'allow' }
  | { kind: 'needs_approval'; reason: string; argsHash: string }
  | { kind: 'deny'; reason: string }

/**
 * Registro de execução (briefing, seção 6). `args` guardado já minimizado.
 * Conteúdo sensível não entra em log por padrão.
 */
export const ExecutionRecordSchema = z.object({
  runId: z.string().min(1),
  requesterUserId: z.string().min(1),
  deviceId: z.string().min(1).nullable(),
  toolName: z.string().min(1),
  argsMinimized: z.record(z.unknown()),
  contractVersion: z.string().min(1),
  approvalId: z.string().min(1).nullable(),
  startedAt: z.string(),
  state: z.enum([
    'pending',
    'running',
    'succeeded',
    'failed',
    'cancelled',
    'needs_reconciliation',
  ]),
  resultRef: z.string().min(1).nullable(),
})
export type ExecutionRecord = z.infer<typeof ExecutionRecordSchema>
