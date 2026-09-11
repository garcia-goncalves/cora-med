import type { InboxItem } from '@cora/contracts'
import { WorkspaceApiError, type WorkspaceClient } from '@cora/workspace-client'
import { collectAllTasks } from '@cora/workspace-client'

import { describeListTasksFailure } from '../tools/workspace-tasks.js'
import type { FilaDeEntrada } from './fila.js'
import type { SincronizacaoDaFonte } from './resumo.js'

/**
 * Único caminho que liga "consultar o Workspace" a "ter itens na fila de entrada".
 *
 * `ContractViolationError` estende `WorkspaceApiError`
 * (`packages/workspace-client/src/errors.ts:68`), então cursor em laço e resposta fora do
 * contrato caem no mesmo ramo de falha, com a frase genérica — para a Thaís, os dois são
 * "não consegui consultar". Qualquer outra exceção sobe: defeito de programação não vira
 * frase amigável.
 */
export async function sincronizarTarefas(entrada: {
  client: WorkspaceClient
  fila: FilaDeEntrada
  limit?: number
  maxPages?: number
  signal?: AbortSignal
  agora?: () => Date
}): Promise<SincronizacaoDaFonte> {
  const { client, fila, limit, maxPages, signal, agora = () => new Date() } = entrada

  try {
    const coleta = await collectAllTasks(client, { limit, maxPages, signal })

    const itens: InboxItem[] = coleta.tasks.map((task) => ({
      tipo: 'tarefa',
      fonte: 'workspace:tasks',
      identificadorDoWorkspace: task.id,
      titulo: task.title,
      status: task.status,
      prioridade: task.priority,
      prazo: task.dueAt,
      vistoEm: agora().toISOString(),
    }))

    if (coleta.completa) {
      // Coleta completa: o que não veio junto não existe mais (foi concluído, apagado ou
      // saiu do escopo) — reconcilia a fonte inteira em vez de só upsertar item a item.
      fila.substituirFonte('workspace:tasks', itens)
    } else {
      // Coleta parcial: uma página não vista não significa item removido. Upsert
      // incremental só nos itens vistos, sem tocar no resto da fila.
      for (const item of itens) {
        fila.adicionar(item)
      }
    }

    if (coleta.completa) {
      return {
        fonte: 'workspace:tasks',
        estado: 'completa',
        itensVistos: coleta.tasks.length,
        paginas: coleta.pages,
      }
    }
    return {
      fonte: 'workspace:tasks',
      estado: 'parcial',
      itensVistos: coleta.tasks.length,
      paginas: coleta.pages,
      motivo: coleta.motivo,
    }
  } catch (cause) {
    if (cause instanceof WorkspaceApiError) {
      return { fonte: 'workspace:tasks', estado: 'falhou', frase: describeListTasksFailure(cause) }
    }
    throw cause
  }
}
