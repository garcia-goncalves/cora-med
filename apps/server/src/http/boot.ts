import type { WorkspaceClient } from '@cora/workspace-client'
import { ToolRegistry } from '../tools/registry.js'
import { ArmazemDePrevias, createPreviewTaskTool } from '../tools/workspace-create-task.js'
import { createListTasksTool } from '../tools/workspace-tasks.js'

/**
 * Monta o `ToolRegistry` de produção: só entra ferramenta que tem handler E esquema em
 * `engine/tool-schemas.ts`. `workspace.tasks.create` é a PRÉVIA (leitura pura) — a
 * gravação é uma segunda chamada que ainda não tem endpoint HTTP nesta entrega (ver
 * aviso em `tools/workspace-create-task.ts`).
 */
export function montarRegistry(client: WorkspaceClient, armazem: ArmazemDePrevias): ToolRegistry {
  return new ToolRegistry()
    .register('workspace.tasks.list', createListTasksTool(client))
    .register('workspace.tasks.create', createPreviewTaskTool(client, armazem))
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
