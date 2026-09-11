import type { WorkspaceClient } from '@cora/workspace-client'
import type { ContaConfigurada } from '../auth/contas.js'
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
 * Um `ToolRegistry` por conta nomeada (decisão D2 do plano da Fase 4) — a única maneira de
 * a chamada ao Workspace usar o token de delegação da pessoa que está de fato conversando.
 *
 * Devolve um `Map` de id da conta para `ToolRegistry`, montado **uma vez no boot**, não por
 * requisição: a `FilaDeEntrada` de cada conta (dentro de `montarRegistry`) precisa
 * sobreviver entre turnos da mesma pessoa, como já sobrevive hoje no processo único.
 *
 * `criarClient` recebe cada conta e devolve o `WorkspaceClient` dela — é o ponto de
 * injeção que permite testar esta função sem rede real.
 */
export function montarRegistryPorConta(
  contas: readonly ContaConfigurada[],
  criarClient: (conta: ContaConfigurada) => WorkspaceClient,
): Map<string, ToolRegistry> {
  const registryPorConta = new Map<string, ToolRegistry>()
  for (const conta of contas) {
    registryPorConta.set(conta.id, montarRegistry(criarClient(conta), new ArmazemDePrevias()))
  }
  return registryPorConta
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
