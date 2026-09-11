import type { WorkspaceClient } from '@cora/workspace-client'
import { FilaDeEntrada } from '../inbox/fila.js'
import { ToolRegistry } from '../tools/registry.js'
import { ArmazemDePrevias, createPreviewTaskTool } from '../tools/workspace-create-task.js'
import { createInboxSummaryTool } from '../tools/workspace-inbox.js'
import { createListTasksTool } from '../tools/workspace-tasks.js'

/**
 * Monta o `ToolRegistry` de produção: só entra ferramenta que tem handler E esquema em
 * `engine/tool-schemas.ts`. `workspace.tasks.create` é a PRÉVIA (leitura pura) — a
 * gravação é uma segunda chamada que ainda não tem endpoint HTTP nesta entrega (ver
 * aviso em `tools/workspace-create-task.ts`).
 *
 * A `FilaDeEntrada` nasce aqui dentro, uma por registro — estado em memória de processo,
 * como `approvals`/`records` em `apps/server/src/run/turn.ts:61-62`. Não é módulo
 * singleton: cada chamada a `montarRegistry` tem a sua.
 */
export function montarRegistry(client: WorkspaceClient, armazem: ArmazemDePrevias): ToolRegistry {
  const fila = new FilaDeEntrada()
  return new ToolRegistry()
    .register('workspace.tasks.list', createListTasksTool(client))
    .register('workspace.tasks.create', createPreviewTaskTool(client, armazem))
    .register('workspace.inbox.resumo', createInboxSummaryTool(client, fila))
}

/**
 * Porta de escuta. Padrão 4320 — 4319 é a porta do Workspace local (`docs/OPERATIONS.md`),
 * e usar a mesma seria confundir os dois processos.
 *
 * `Number('abc')` é `NaN`, e passar `NaN` para `server.listen()` falha de um jeito que
 * pareceria bug de rede, não erro de configuração — por isso a validação explícita.
 */
export function porta(): number {
  const bruto = process.env.CORA_PORT
  if (bruto === undefined || bruto === '') return 4320
  const valor = Number(bruto)
  if (!Number.isInteger(valor) || valor < 1 || valor > 65535) {
    throw new Error(`CORA_PORT precisa ser um inteiro entre 1 e 65535: "${bruto}"`)
  }
  return valor
}
