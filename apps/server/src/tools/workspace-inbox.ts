import type { WorkspaceClient } from '@cora/workspace-client'

import type { FilaDeEntrada } from '../inbox/fila.js'
import { descreverResumo, montarResumo, type ResumoOperacional } from '../inbox/resumo.js'
import { sincronizarTarefas } from '../inbox/sincronizar.js'
import type { ToolHandler } from './registry.js'

/**
 * Ferramenta `workspace.inbox.resumo`.
 *
 * **Diferença deliberada em relação a `createListTasksTool`
 * (`workspace-tasks.ts:20-26`): lá a falha do Workspace NÃO é capturada, para que um 403
 * não seja registrado como `succeeded` e vire "você não tem tarefas" para o modelo.
 *
 * Aqui a falha **é** capturada — mas ela não some, e não vira sucesso silencioso:
 * `sincronizarTarefas` já a transforma em fonte com `estado: 'falhou'`, e `montarResumo`
 * dá precedência a essa fonte sobre qualquer contagem, produzindo o estado
 * `erro_de_acesso`, que tem frase própria e diz explicitamente que não é uma lista vazia.
 * O handler devolve `outcome: 'ok'` mesmo neste caso porque, do ponto de vista do laço de
 * execução, a ferramenta rodou até o fim e produziu um resultado estruturado válido — a
 * distinção entre "sem pendências" e "não consegui confirmar" mora no `estado` do resumo,
 * não em a chamada ter lançado ou não.
 */
export type InboxSummaryToolResult = { outcome: 'ok'; resumo: ResumoOperacional }

export function createInboxSummaryTool(client: WorkspaceClient, fila: FilaDeEntrada): ToolHandler {
  return async ({ signal }) => {
    const fonte = await sincronizarTarefas({ client, fila, signal })
    const resumo = montarResumo({ itens: fila.itens(), fontes: [fonte] })
    return { outcome: 'ok', resumo } satisfies InboxSummaryToolResult
  }
}

/** Texto que a Cora entrega ao usuário a partir do resultado da ferramenta. */
export function describeResumoForUser(result: InboxSummaryToolResult): string {
  return descreverResumo(result.resumo)
}
