import { z } from 'zod'
import { RequesterContextSchema, type RequesterContext } from '@cora/contracts'

/**
 * Fronteira do corpo de `POST /turno`. Só o que está aqui existe para o cliente HTTP —
 * `.strict()` é deliberado: um cliente que mande `runId`, `requester` ou `aprovacoes`
 * recebe recusa ALTA (422), em vez de ver o campo ser silenciosamente ignorado. A partir
 * da Etapa 10 da Fase 4 quem conversa é a pessoa autenticada pela sessão — o
 * `requesterUserId` vem do cookie de sessão, nunca do corpo — e um canal de aprovação sem
 * autenticação é aprovação que ninguém deu; por isso o cliente também nunca decide `runId`
 * nem manda aprovação pelo corpo.
 */

/**
 * Teto de tamanho da mensagem. Mesma lógica de `MAX_CHARS_RESULTADO`
 * (`docs/ARCHITECTURE.md`): sem limite, o histórico reenviado a cada passo do turno
 * transforma cada mensagem grande em custo de token amplificado dez vezes.
 */
export const MAX_CHARS_MENSAGEM = 8000

export const PedidoDeTurnoSchema = z
  .object({
    mensagem: z.string().min(1).max(MAX_CHARS_MENSAGEM),
    deviceId: z.string().min(1).nullable(),
  })
  .strict()

export type PedidoDeTurno = z.infer<typeof PedidoDeTurnoSchema>

/**
 * `runId` é identidade de auditoria — nunca escolhido pelo cliente, sempre gerado aqui.
 * `idDaConta` vem da sessão já validada pelo `server.ts`, nunca do corpo — é o que torna
 * impossível a um cliente HTTP falar em nome de outra pessoa.
 */
export function montarRequester(
  pedido: PedidoDeTurno,
  idDaConta: string,
  gerarRunId: () => string,
): RequesterContext {
  const requester = {
    requesterUserId: idDaConta,
    deviceId: pedido.deviceId,
    runId: gerarRunId(),
  }
  return RequesterContextSchema.parse(requester)
}
