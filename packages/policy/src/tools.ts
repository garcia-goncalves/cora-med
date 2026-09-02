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
  /** `false` = declarada, mas ainda não implementada. Aparece como indisponível na UI. */
  implemented: boolean
}

export const TOOL_CATALOG: readonly ToolSpec[] = [
  {
    name: 'workspace.tasks.list',
    category: 'read',
    humanDescription: 'Listar suas tarefas internas abertas no Workspace',
    contract: 'workspace-agent-v1',
    // Código pronto; alvo HTTP real ainda depende do ticket CORA-001.
    implemented: true,
  },
  {
    name: 'workspace.tasks.create',
    category: 'internal_write',
    humanDescription: 'Criar uma tarefa interna no Workspace',
    contract: 'workspace-agent-v1',
    implemented: false,
  },
  {
    name: 'workspace.email.send',
    category: 'external_effect',
    humanDescription: 'Enviar um e-mail em seu nome',
    contract: 'workspace-agent-v1',
    implemented: false,
  },
  {
    name: 'workspace.tasks.delete',
    category: 'external_effect',
    humanDescription: 'Excluir uma tarefa no Workspace',
    contract: 'workspace-agent-v1',
    implemented: false,
  },
  {
    name: 'system.install',
    category: 'privileged',
    humanDescription: 'Instalar software ou alterar configuração do sistema',
    implemented: false,
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
