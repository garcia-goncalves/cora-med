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
export type ListTasksToolResult = { outcome: 'ok'; tasks: Task[]; nextCursor: string | null }

export function createListTasksTool(client: WorkspaceClient): ToolHandler {
  return async ({ args, signal }) => {
    const limit = typeof args.limit === 'number' ? args.limit : 20
    const cursor = typeof args.cursor === 'string' ? args.cursor : undefined
    // A falha NÃO é capturada aqui, de propósito. Se este handler devolvesse um valor
    // normal em caso de erro, o laço a registraria como `succeeded` e a entregaria ao
    // modelo como `ok: true` — e um 403 ou uma delegação expirada viraria "você não tem
    // tarefas abertas". Quem traduz falha em frase é `describeListTasksFailure`.
    //
    // O signal do turno vai junto: sem isso, cancelar o turno deixa a requisição em voo
    // consumindo conexão até o timeout do cliente.
    const page = await client.listTasks(
      cursor === undefined
        ? { scope: 'mine', status: 'open', limit }
        : { scope: 'mine', status: 'open', limit, cursor },
      { signal },
    )
    return {
      outcome: 'ok',
      tasks: page.items,
      nextCursor: page.nextCursor,
    } satisfies ListTasksToolResult
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
  if (result.tasks.length === 0) {
    return 'Não encontrei nenhuma tarefa interna aberta com você como responsável.'
  }
  const linhas = result.tasks
    .map((t) => `- ${t.title} [${t.status}, prioridade ${t.priority}, id ${t.id}]`)
    .join('\n')
  return wrapUntrusted({ source: 'workspace:tasks', content: linhas })
}

/**
 * Texto para quando a consulta FALHOU.
 *
 * Existe separado de propósito: "não encontrei tarefas" e "não consegui consultar" nunca
 * podem sair como a mesma frase, e uma falha de autorização é a que mais se parece com
 * lista vazia — é justamente a que não pode ser confundida.
 */
export function describeListTasksFailure(error: unknown): string {
  if (!(error instanceof WorkspaceApiError)) {
    return 'Não consegui consultar suas tarefas agora. Isso não quer dizer que você esteja sem pendências.'
  }
  if (error.requiresReauth) {
    return (
      'Sua autorização para eu acessar o Workspace expirou ou foi revogada ' +
      `(${error.code}). Preciso que você me autorize de novo — não estou vendo suas tarefas.`
    )
  }
  if (error.code === 'FORBIDDEN') {
    return (
      'O Workspace não me deixou consultar essas tarefas (FORBIDDEN). ' +
      'Não é uma lista vazia: é falta de permissão.'
    )
  }
  if (error.code === 'INVALID_INPUT') {
    return (
      'Montei essa consulta errado (INVALID_INPUT). O problema é meu, não do Workspace — ' +
      'pode reformular o pedido.'
    )
  }
  return (
    `Não consegui consultar suas tarefas no Workspace agora (${error.code}). ` +
    'Isso não quer dizer que você esteja sem pendências.'
  )
}
