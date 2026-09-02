import { z } from 'zod'

/**
 * Schemas do endpoint GET /api/agent/v1/tasks do Workspace.
 *
 * ATENÇÃO: estes schemas são a leitura que a CORA fez do briefing (seção 7) e do
 * schema Prisma do Workspace. O contrato canônico é
 * `contracts/workspace-agent-v1.openapi.yaml`, de autoria do WORKSPACE, e ainda NÃO foi
 * publicado. Quando for, `CONTRACT_SHA256` abaixo passa a carregar o hash real e estes
 * schemas são reconciliados com o YAML antes de qualquer chamada real.
 */

/** Versão do contrato que esta cópia espera. */
export const CONTRACT_VERSION = '0.1.0' as const

/**
 * SHA-256 do arquivo OpenAPI, fixado no repositório da Cora.
 * `null` = contrato ainda não recebido. O cliente HTTP se recusa a rodar em modo
 * "integração real" enquanto for null — para que ninguém confunda mock com integração.
 */
export const CONTRACT_SHA256: string | null = null

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
