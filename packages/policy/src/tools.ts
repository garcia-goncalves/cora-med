import type { ActionCategory } from '@cora/contracts'

/**
 * Catálogo de ferramentas da Cora e a categoria de risco de cada uma.
 *
 * Regra estrutural: a lista é FECHADA. Ferramenta que não está aqui não executa —
 * nem por nome parecido, nem porque o modelo pediu com convicção. Não existe
 * `exec(command)` genérico neste catálogo, por decisão (briefing, seção 11).
 */

export interface ToolSpec {
  name: string
  category: ActionCategory
  /** Descrição em português, usada na prévia de aprovação mostrada ao usuário. */
  humanDescription: string
  /** Contrato remoto de onde a ferramenta vem, quando houver. */
  contract?: 'workspace-agent-v1'
}

/**
 * O catálogo diz o que EXISTE e qual o risco de cada coisa. Quem diz o que de fato roda
 * é o registro de executores (`ToolRegistry`), e ele é a fonte única dessa verdade.
 * Uma flag `implemented` aqui seria uma segunda verdade capaz de divergir da primeira.
 */

export const TOOL_CATALOG: readonly ToolSpec[] = [
  {
    name: 'workspace.tasks.list',
    category: 'read',
    humanDescription: 'Listar suas tarefas internas abertas no Workspace',
    contract: 'workspace-agent-v1',
  },
  {
    name: 'workspace.tasks.create',
    category: 'internal_write',
    humanDescription: 'Criar uma tarefa interna no Workspace',
    contract: 'workspace-agent-v1',
  },
  {
    name: 'workspace.email.send',
    category: 'external_effect',
    humanDescription: 'Enviar um e-mail em seu nome',
    contract: 'workspace-agent-v1',
  },
  {
    name: 'workspace.tasks.delete',
    category: 'external_effect',
    humanDescription: 'Excluir uma tarefa no Workspace',
    contract: 'workspace-agent-v1',
  },
  {
    name: 'system.install',
    category: 'privileged',
    humanDescription: 'Instalar software ou alterar configuração do sistema',
  },
] as const

const BY_NAME = new Map(TOOL_CATALOG.map((t) => [t.name, t]))

export function findTool(name: string): ToolSpec | undefined {
  return BY_NAME.get(name)
}

/** Categorias que só rodam depois de aprovação humana vinculada ao conteúdo. */
export function requiresApproval(category: ActionCategory): boolean {
  return category === 'external_effect'
}

/** Categoria que a assistente operacional não executa, ponto. */
export function isOutOfScope(category: ActionCategory): boolean {
  return category === 'privileged'
}
