import type { Task } from '@cora/contracts'
import { wrapUntrusted } from '@cora/policy'
import { WorkspaceApiError, type WorkspaceClient } from '@cora/workspace-client'

import type { ToolHandler } from './registry.js'

/**
 * Ferramenta `workspace.tasks.list`.
 *
 * O handler devolve um resultado ESTRUTURADO, com a distinção que o briefing exige na
 * seção 10: "sem pendências" e "não consegui consultar" são resultados diferentes e
 * nunca se confundem.
 */
export type ListTasksToolResult =
  | { outcome: 'ok'; tasks: Task[]; nextCursor: string | null }
  | { outcome: 'unavailable'; code: string; message: string; requestId: string | null }

export function createListTasksTool(client: WorkspaceClient): ToolHandler {
  return async ({ args }) => {
    const limit = typeof args.limit === 'number' ? args.limit : 20
    const cursor = typeof args.cursor === 'string' ? args.cursor : undefined
    try {
      const page = await client.listTasks(
        cursor === undefined
          ? { scope: 'mine', status: 'open', limit }
          : { scope: 'mine', status: 'open', limit, cursor },
      )
      return {
        outcome: 'ok',
        tasks: page.items,
        nextCursor: page.nextCursor,
      } satisfies ListTasksToolResult
    } catch (cause) {
      if (cause instanceof WorkspaceApiError) {
        return {
          outcome: 'unavailable',
          code: cause.code,
          message: cause.message,
          requestId: cause.requestId,
        } satisfies ListTasksToolResult
      }
      throw cause
    }
  }
}

/**
 * Texto que a Cora entrega ao usuário a partir do resultado da ferramenta.
 *
 * Duas regras não negociáveis moram aqui:
 * 1. lista vazia diz "nenhuma tarefa aberta encontrada", falha diz "não consegui
 *    consultar" — nunca a mesma frase;
 * 2. o título das tarefas vai para o modelo dentro de bloco de dado não confiável.
 */
export function describeTasksForUser(result: ListTasksToolResult): string {
  if (result.outcome === 'unavailable') {
    return (
      'Não consegui consultar suas tarefas no Workspace agora ' +
      `(${result.code}). Isso não quer dizer que você esteja sem pendências.`
    )
  }
  if (result.tasks.length === 0) {
    return 'Não encontrei nenhuma tarefa interna aberta com você como responsável.'
  }
  const linhas = result.tasks
    .map((t) => `- ${t.title} [${t.status}, prioridade ${t.priority}, id ${t.id}]`)
    .join('\n')
  return wrapUntrusted({ source: 'workspace:tasks', content: linhas })
}
