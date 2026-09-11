import type { Task } from '@cora/contracts'

import type { WorkspaceClient } from './client.js'
import { ContractViolationError, WorkspaceApiError } from './errors.js'

/**
 * Resultado de `collectAllTasks`: `completa: false` só acontece no teto de páginas — uma
 * lista maior do que o teto que **nós** escolhemos, não um defeito do outro lado. Cursor em
 * laço e id repetido continuam sendo defeito e continuam estourando `ContractViolationError`.
 */
export type ColetaDeTarefas =
  | { tasks: Task[]; pages: number; completa: true }
  | { tasks: Task[]; pages: number; completa: false; motivo: 'teto_de_paginas'; maxPages: number }

/**
 * Percorre todas as páginas de tarefas.
 *
 * Duas proteções que existem porque paginação quebrada é silenciosa:
 * - id repetido entre páginas -> `ContractViolationError` em vez de lista inflada;
 * - cursor que se repete -> para e erra, em vez de girar para sempre.
 * O teto de páginas não entra nessa lista: virar `completa: false` é dado, não defeito —
 * é uma lista maior do que o teto que nós escolhemos, e a Thaís precisa ouvir isso.
 */
export async function collectAllTasks(
  client: WorkspaceClient,
  opts: { limit?: number; maxPages?: number; signal?: AbortSignal } = {},
): Promise<ColetaDeTarefas> {
  const limit = opts.limit ?? 20
  const maxPages = opts.maxPages ?? 50

  let tasks: Task[] = []
  const seenIds = new Set<string>()
  const seenCursors = new Set<string>()
  let cursor: string | undefined
  let pages = 0

  let recomecou = false

  for (;;) {
    let page: Awaited<ReturnType<WorkspaceClient['listTasks']>>
    try {
      page = await client.listTasks(
        cursor === undefined
          ? { scope: 'mine', status: 'open', limit }
          : { scope: 'mine', status: 'open', limit, cursor },
        opts.signal === undefined ? {} : { signal: opts.signal },
      )
    } catch (cause) {
      // Contrato 0.1.0, seção 8.2: cursor recusado não é defeito — o cursor é assinado e
      // preso à pessoa, e a assinatura morre se o segredo de sessão do Workspace mudar.
      // A ação certa é recomeçar a listagem, uma vez. Duas seria laço.
      const cursorRecusado =
        cause instanceof WorkspaceApiError && cause.code === 'INVALID_INPUT' && cursor !== undefined
      if (!cursorRecusado || recomecou) throw cause

      recomecou = true
      cursor = undefined
      tasks.length = 0
      seenIds.clear()
      seenCursors.clear()
      pages = 0
      continue
    }
    pages += 1

    for (const task of page.items) {
      if (seenIds.has(task.id)) {
        throw new ContractViolationError(
          `paginação devolveu o id "${task.id}" mais de uma vez`,
          null,
        )
      }
      seenIds.add(task.id)
      tasks.push(task)
    }

    if (page.nextCursor === null) return { tasks, pages, completa: true }

    if (seenCursors.has(page.nextCursor)) {
      throw new ContractViolationError('paginação entrou em laço: cursor repetido', null)
    }
    seenCursors.add(page.nextCursor)
    cursor = page.nextCursor

    if (pages >= maxPages) {
      return { tasks, pages, completa: false, motivo: 'teto_de_paginas', maxPages }
    }
  }
}
