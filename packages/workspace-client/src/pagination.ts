import type { Task } from '@cora/contracts'

import type { WorkspaceClient } from './client.js'
import { ContractViolationError } from './errors.js'

/**
 * Percorre todas as páginas de tarefas.
 *
 * Duas proteções que existem porque paginação quebrada é silenciosa:
 * - id repetido entre páginas -> `ContractViolationError` em vez de lista inflada;
 * - cursor que se repete ou número de páginas acima do teto -> para e erra,
 *   em vez de girar para sempre.
 */
export async function collectAllTasks(
  client: WorkspaceClient,
  opts: { limit?: number; maxPages?: number; signal?: AbortSignal } = {},
): Promise<{ tasks: Task[]; pages: number }> {
  const limit = opts.limit ?? 20
  const maxPages = opts.maxPages ?? 50

  const tasks: Task[] = []
  const seenIds = new Set<string>()
  const seenCursors = new Set<string>()
  let cursor: string | undefined
  let pages = 0

  for (;;) {
    const page = await client.listTasks(
      cursor === undefined
        ? { scope: 'mine', status: 'open', limit }
        : { scope: 'mine', status: 'open', limit, cursor },
      opts.signal === undefined ? {} : { signal: opts.signal },
    )
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

    if (page.nextCursor === null) return { tasks, pages }

    if (seenCursors.has(page.nextCursor)) {
      throw new ContractViolationError('paginação entrou em laço: cursor repetido', null)
    }
    seenCursors.add(page.nextCursor)
    cursor = page.nextCursor

    if (pages >= maxPages) {
      throw new ContractViolationError(
        `paginação passou de ${maxPages} páginas sem terminar`,
        null,
      )
    }
  }
}
