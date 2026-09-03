import { createHash } from 'node:crypto'

import type {
  Approval,
  PolicyDecision,
  RequesterContext,
  ToolCallProposal,
} from '@cora/contracts'

import { findTool, isOutOfScope, requiresApproval } from './tools.js'

/**
 * Hash canônico dos argumentos de uma chamada.
 *
 * Serialização estável (chaves ordenadas, recursivamente) para que a MESMA intenção
 * produza o MESMO hash, e qualquer mudança material produza um hash diferente — que é
 * o que invalida a aprovação já dada.
 */
export function hashArgs(toolName: string, args: Record<string, unknown>): string {
  return createHash('sha256').update(`${toolName} ${canonicalize(args)}`).digest('hex')
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`
}

/**
 * Decide o que fazer com uma proposta do motor.
 *
 * Ordem das checagens é deliberada: existência antes de categoria, categoria antes de
 * aprovação. Negar por padrão; permitir é o caso especial.
 */
export function decide(
  proposal: ToolCallProposal,
  approval: Approval | null,
  now: Date,
  requester: RequesterContext,
): PolicyDecision {
  const tool = findTool(proposal.toolName)
  if (!tool) {
    return { kind: 'deny', reason: `Ferramenta desconhecida: ${proposal.toolName}` }
  }
  // `implemented` NÃO é checado aqui de propósito: quem sabe se algo roda é o registro
  // de executores (`ToolRegistry`), fonte única dessa verdade. A política decide risco.
  if (isOutOfScope(tool.category)) {
    return {
      kind: 'deny',
      reason: `Fora do escopo da assistente operacional: ${tool.humanDescription}`,
    }
  }

  const argsHash = hashArgs(proposal.toolName, proposal.args)

  if (!requiresApproval(tool.category)) return { kind: 'allow' }

  if (approval === null) {
    return { kind: 'needs_approval', reason: tool.humanDescription, argsHash }
  }
  if (approval.argsHash !== argsHash) {
    return {
      kind: 'needs_approval',
      reason: 'O conteúdo mudou desde a aprovação; é preciso aprovar de novo',
      argsHash,
    }
  }
  if (approval.approvedByUserId !== requester.requesterUserId) {
    // Aprovação é de uma pessoa, não de um nome de ferramenta. Sem esta checagem, uma
    // aprovação dada por A autorizaria a mesma ação no turno de B.
    return { kind: 'deny', reason: 'Esta aprovação foi dada por outra pessoa' }
  }
  if (approval.consumedAt !== null) {
    return { kind: 'deny', reason: 'Esta aprovação já foi usada' }
  }
  if (Date.parse(approval.expiresAt) <= now.getTime()) {
    return { kind: 'deny', reason: 'A aprovação expirou' }
  }

  return { kind: 'allow' }
}
