import { z } from 'zod'

/**
 * Schemas do endpoint GET /api/agent/v1/tasks do Workspace.
 *
 * O contrato canônico é de autoria do WORKSPACE. A cópia vive em
 * `./contrato/workspace-agent-v1.openapi.yaml` — produção nunca lê de `med-coordination`.
 * Estes schemas foram reconciliados com aquele YAML em 03/09/2026; as divergências
 * deliberadas estão anotadas onde ocorrem.
 */

/** Versão do contrato que esta cópia espera. */
export const CONTRACT_VERSION = '0.2.0' as const

/**
 * SHA-256 do arquivo OpenAPI, fixado aqui. Recebido em CORA-003 e **recalculado de forma
 * independente** nesta máquina antes de ser gravado.
 *
 * `null` significaria contrato ainda não recebido, e trava a integração real.
 * Há teste que rehasheia o arquivo vendorizado e compara com esta constante: se alguém
 * trocar o YAML sem trocar o hash, a suíte quebra.
 */
export const CONTRACT_SHA256: string | null =
  'd5dbff4167727e041326d5e9caf38aa2b3388529272dc673095cdc4a617ec13a'

export const TaskStatusSchema = z.enum(['PENDENTE', 'FAZENDO'])
export type TaskStatus = z.infer<typeof TaskStatusSchema>

export const TaskPrioritySchema = z.enum(['BAIXA', 'NORMAL', 'ALTA'])
export type TaskPriority = z.infer<typeof TaskPrioritySchema>

/** ISO 8601 com offset explícito. Ausência de prazo é `null`, nunca uma data inventada. */
const IsoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'data ISO 8601 inválida' })

export const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  dueAt: IsoDateTime.nullable(),
  assigneeIds: z.array(z.string().min(1)),
  clientId: z.string().min(1).nullable(),
  projectId: z.string().min(1).nullable(),
})
export type Task = z.infer<typeof TaskSchema>

export const ListTasksResponseSchema = z.object({
  contractVersion: z.string().min(1),
  items: z.array(TaskSchema),
  nextCursor: z.string().min(1).nullable(),
})
export type ListTasksResponse = z.infer<typeof ListTasksResponseSchema>

export const LIST_TASKS_LIMIT_MIN = 1
export const LIST_TASKS_LIMIT_MAX = 100
export const LIST_TASKS_LIMIT_DEFAULT = 20

/**
 * Parâmetros aceitos. A Cora valida ANTES de chamar: pedido inválido não vira requisição
 * de rede, e `limit` fora da faixa é erro — nunca clamp silencioso.
 */
export const ListTasksParamsSchema = z.object({
  scope: z.literal('mine'),
  status: z.literal('open'),
  limit: z
    .number()
    .int()
    .min(LIST_TASKS_LIMIT_MIN)
    .max(LIST_TASKS_LIMIT_MAX)
    .default(LIST_TASKS_LIMIT_DEFAULT),
  cursor: z.string().min(1).optional(),
})
export type ListTasksParams = z.input<typeof ListTasksParamsSchema>
