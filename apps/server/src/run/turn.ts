import { createHmac, randomBytes } from 'node:crypto'

import { CONTRACT_VERSION } from '@cora/contracts'
import type { Approval, ExecutionRecord, RequesterContext } from '@cora/contracts'
import {
  cortarParaLimite,
  decide,
  findTool,
  hashArgs,
  requiresApproval,
  wrapUntrusted,
} from '@cora/policy'

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
        // Cancelamento entre propostas do MESMO passo: sem esta checagem, um abort que
        // chega durante a primeira ferramenta ainda deixaria a segunda executar.
        if (controller.signal.aborted) return { kind: 'cancelled', records }

        const tool = findTool(proposal.toolName)
        if (!tool) {
          return { kind: 'denied', reason: `Ferramenta desconhecida: ${proposal.toolName}`, records }
        }

        const decision = decide(
          proposal,
          approvals.get(proposal.toolName) ?? null,
          now(),
          args.requester,
        )

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
          // A constante, nunca o literal: o registro de execução tem de dizer sob qual
          // contrato a chamada rodou, e um número escrito à mão aqui congelaria a
          // auditoria na versão de ontem sem nada acusar.
          contractVersion: CONTRACT_VERSION,
          // Só registra aprovação onde houve rito de aprovação. Copiar o id numa leitura
          // sugeriria no log um passo humano que não aconteceu.
          approvalId: requiresApproval(tool.category)
            ? (approvals.get(proposal.toolName)?.approvalId ?? null)
            : null,
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

          // Aprovação vale UMA vez. Consumida assim que o efeito acontece.
          const usada = approvals.get(proposal.toolName)
          if (usada && decision.kind === 'allow' && requiresApproval(tool.category)) {
            approvals.set(proposal.toolName, { ...usada, consumedAt: now().toISOString() })
          }

          messages.push(toolResultMessage(proposal.toolName, { ok: true, result }))
        } catch (cause) {
          // Cancelar no meio de um efeito externo NÃO prova que o efeito não aconteceu.
          // Isso é reconciliação, não "cancelado" — mentir aqui polui a auditoria.
          record.state = controller.signal.aborted
            ? requiresApproval(tool.category)
              ? 'needs_reconciliation'
              : 'cancelled'
            : 'failed'

          messages.push(
            toolResultMessage(proposal.toolName, {
              ok: false,
              error: cause instanceof Error ? cause.message : 'falha desconhecida',
            }),
          )
        }
      }
    }
  } finally {
    args.signal?.removeEventListener('abort', onExternalAbort)
  }
}

/**
 * Resultado de ferramenta é DADO EXTERNO: veio do Workspace, e o Workspace tem dentro
 * dele texto escrito por pessoas — inclusive por quem não é da equipe.
 *
 * Sem este embrulho, o título de uma tarefa chega ao modelo no mesmo nível das
 * instruções da Cora, e quem consegue criar uma tarefa consegue escrever no prompt dela.
 * A mensagem de erro também: ela é texto controlado pelo outro lado.
 */
/**
 * Teto de tamanho de UM resultado de ferramenta, em caracteres.
 *
 * O contrato do Workspace não põe máximo no título da tarefa, e a listagem traz até cem.
 * Sem teto, quem consegue criar uma tarefa para a Thaís consegue encher o histórico — que
 * é reenviado inteiro a cada um dos dez passos do turno — e transformar cada pergunta
 * dela em conta de dólares, ou em requisição que estoura o contexto e não responde mais.
 */
export const MAX_CHARS_RESULTADO = 8000

function toolResultMessage(toolName: string, payload: unknown): MotorMessage {
  return {
    role: 'tool_result',
    // O corte vem ANTES do embrulho: cortar depois decepa o marcador de fechamento e o
    // bloco vaza. E o corte é visível, nunca silencioso.
    content: wrapUntrusted({
      source: `tool:${toolName}`,
      content: cortarParaLimite(JSON.stringify(payload), MAX_CHARS_RESULTADO),
    }),
  }
}

/**
 * Minimização para o log: guarda a FORMA dos argumentos e um código, nunca o conteúdo.
 *
 * O código é HMAC, não hash simples. Um SHA-256 puro de valor de baixa entropia — CPF,
 * e-mail, telefone, id de paciente — é reversível por dicionário em minutos, e o log tem
 * plateia mais ampla que o dado. Sem chave configurada, uma chave aleatória por processo:
 * o código correlaciona execuções da mesma sessão e não vaza nada fora dela.
 */
const LOG_HASH_KEY = process.env.CORA_LOG_HASH_KEY ?? randomBytes(32).toString('hex')

function minimizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  return {
    keys: Object.keys(args).sort(),
    code: createHmac('sha256', LOG_HASH_KEY).update(hashArgs('args', args)).digest('hex'),
  }
}
