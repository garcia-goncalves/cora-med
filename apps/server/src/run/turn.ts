import type { Approval, ExecutionRecord, RequesterContext } from '@cora/contracts'
import { decide, hashArgs } from '@cora/policy'

import type { MotorMessage, MotorPort } from '../engine/port.js'
import type { ToolRegistry } from '../tools/registry.js'

/**
 * O laço de execução da Cora.
 *
 * Tudo que o briefing chama de "código validado decide se e como executar" acontece
 * aqui. Três limites são aplicados PELA APLICAÇÃO, não pelo motor nem pelo provedor:
 * número de chamadas de modelo, tempo de parede e cancelamento externo.
 */

export interface TurnLimits {
  /** Padrão inicial do briefing, seção 12. Ajustável. */
  maxModelCalls: number
  maxRunSeconds: number
}

export const DEFAULT_LIMITS: TurnLimits = { maxModelCalls: 10, maxRunSeconds: 120 }

export type TurnOutcome =
  | { kind: 'replied'; reply: string; records: ExecutionRecord[] }
  | {
      kind: 'needs_approval'
      toolName: string
      reason: string
      argsHash: string
      records: ExecutionRecord[]
    }
  | { kind: 'denied'; reason: string; records: ExecutionRecord[] }
  | { kind: 'limit_reached'; limit: 'model_calls' | 'time'; records: ExecutionRecord[] }
  | { kind: 'cancelled'; records: ExecutionRecord[] }

export interface RunTurnArgs {
  motor: MotorPort
  registry: ToolRegistry
  requester: RequesterContext
  messages: MotorMessage[]
  /** Aprovações já dadas, indexadas por nome de ferramenta. */
  approvals?: Map<string, Approval>
  limits?: TurnLimits
  signal?: AbortSignal
  now?: () => Date
}

export async function runTurn(args: RunTurnArgs): Promise<TurnOutcome> {
  const limits = args.limits ?? DEFAULT_LIMITS
  const now = args.now ?? (() => new Date())
  const approvals = args.approvals ?? new Map<string, Approval>()
  const records: ExecutionRecord[] = []

  const startedAtMs = now().getTime()
  const controller = new AbortController()
  const onExternalAbort = () => controller.abort()
  args.signal?.addEventListener('abort', onExternalAbort, { once: true })
  if (args.signal?.aborted) controller.abort()

  const messages: MotorMessage[] = [...args.messages]

  try {
    for (let modelCalls = 0; ; modelCalls += 1) {
      if (controller.signal.aborted) return { kind: 'cancelled', records }
      if (modelCalls >= limits.maxModelCalls) {
        return { kind: 'limit_reached', limit: 'model_calls', records }
      }
      if ((now().getTime() - startedAtMs) / 1000 >= limits.maxRunSeconds) {
        return { kind: 'limit_reached', limit: 'time', records }
      }

      const step = await args.motor.step({
        requester: args.requester,
        messages,
        availableTools: args.registry.availableToolNames(),
        signal: controller.signal,
      })

      if (step.proposals.length === 0) {
        return { kind: 'replied', reply: step.reply ?? '', records }
      }

      for (const proposal of step.proposals) {
        const decision = decide(proposal, approvals.get(proposal.toolName) ?? null, now())

        if (decision.kind === 'deny') {
          return { kind: 'denied', reason: decision.reason, records }
        }
        if (decision.kind === 'needs_approval') {
          return {
            kind: 'needs_approval',
            toolName: proposal.toolName,
            reason: decision.reason,
            argsHash: decision.argsHash,
            records,
          }
        }

        const handler = args.registry.get(proposal.toolName)
        if (!handler) {
          // Catálogo e registro divergiram. Nega, não improvisa.
          return {
            kind: 'denied',
            reason: `Ferramenta "${proposal.toolName}" não tem executor registrado`,
            records,
          }
        }

        const record: ExecutionRecord = {
          runId: args.requester.runId,
          requesterUserId: args.requester.requesterUserId,
          deviceId: args.requester.deviceId,
          toolName: proposal.toolName,
          argsMinimized: minimizeArgs(proposal.args),
          contractVersion: '0.1.0',
          approvalId: approvals.get(proposal.toolName)?.approvalId ?? null,
          startedAt: now().toISOString(),
          state: 'running',
          resultRef: null,
        }
        records.push(record)

        try {
          const result = await handler({
            args: proposal.args,
            requester: args.requester,
            signal: controller.signal,
          })
          record.state = 'succeeded'
          messages.push({
            role: 'tool_result',
            content: JSON.stringify({ tool: proposal.toolName, ok: true, result }),
          })
        } catch (cause) {
          record.state = controller.signal.aborted ? 'cancelled' : 'failed'
          messages.push({
            role: 'tool_result',
            content: JSON.stringify({
              tool: proposal.toolName,
              ok: false,
              error: cause instanceof Error ? cause.message : 'falha desconhecida',
            }),
          })
        }
      }
    }
  } finally {
    args.signal?.removeEventListener('abort', onExternalAbort)
  }
}

/**
 * Minimização para o log: guarda a FORMA dos argumentos e o hash, nunca o conteúdo.
 * Não queremos título de tarefa, nome de paciente ou texto de e-mail em log por padrão.
 */
function minimizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  return {
    keys: Object.keys(args).sort(),
    hash: hashArgs('args', args),
  }
}
