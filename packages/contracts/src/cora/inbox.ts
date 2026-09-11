import { z } from 'zod'

import { TaskPrioritySchema, TaskStatusSchema } from '../workspace-agent/v1/tasks.js'

/**
 * Item de inbox: uma coisa que a Cora viu no Workspace e ainda não classificou.
 *
 * União discriminada por `tipo`. Hoje tem **um** membro, `'tarefa'`. `card` e `evento`
 * são fora de escopo desta fase (`spec.md`, `fora_de_escopo`) — não criamos campo, membro
 * nem validação para eles aqui.
 */
export const InboxItemSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('tarefa'),
    /** A fonte é literal fechada hoje — não é texto livre. */
    fonte: z.literal('workspace:tasks'),
    /** Id da tarefa no Workspace. */
    identificadorDoWorkspace: z.string().min(1),
    titulo: z.string(),
    status: TaskStatusSchema,
    prioridade: TaskPrioritySchema,
    prazo: z.string().nullable(),
    /** ISO 8601: quando a Cora viu este item. */
    vistoEm: z.string(),
  }),
])
export type InboxItem = z.infer<typeof InboxItemSchema>

/**
 * Chave de deduplicação, derivada de `(fonte, identificadorDoWorkspace)`.
 *
 * **Ao contrário de `novaChaveDeIdempotencia()` (`apps/server/src/run/idempotency.ts`),
 * que é aleatória de propósito, esta chave é derivada de conteúdo.** Os dois padrões
 * resolvem problemas opostos: a chave de idempotência existe para que duas tentativas do
 * MESMO pedido não criem duas tarefas; esta chave existe para que o MESMO item visto duas
 * vezes seja reconhecido como o mesmo item, e não vire duplicata na inbox. Não "corrija"
 * uma pela outra.
 *
 * Colisão é impossível hoje porque `fonte` é uma literal fechada (não texto livre) — o
 * separador `|` nunca aparece dentro dela.
 */
export function chaveDeInbox(
  item: Pick<InboxItem, 'fonte' | 'identificadorDoWorkspace'>,
): string {
  return `${item.fonte}|${item.identificadorDoWorkspace}`
}
