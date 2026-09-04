import { z } from 'zod'
import { RequesterContextSchema, type RequesterContext } from '@cora/contracts'

/**
 * Fronteira do corpo de `POST /turno`. Só o que está aqui existe para o cliente HTTP —
 * `.strict()` em todo nível é deliberado: um cliente que mande `runId` ou `aprovacoes`
 * recebe recusa ALTA (422), em vez de ver o campo ser silenciosamente ignorado. Não há
 * autenticação de usuário humano ainda (fora de escopo, `docs/SECURITY.md`), e um canal
 * de aprovação sem autenticação é aprovação que ninguém deu — por isso o cliente nunca
 * decide `runId` nem manda aprovação pelo corpo.
 */

/**
 * Teto de tamanho da mensagem. Mesma lógica de `MAX_CHARS_RESULTADO`
 * (`docs/ARCHITECTURE.md`): sem limite, o histórico reenviado a cada passo do turno
 * transforma cada mensagem grande em custo de token amplificado dez vezes.
 */
export const MAX_CHARS_MENSAGEM = 8000

const RequesterDoPedidoSchema = z
  .object({
    requesterUserId: z.string().min(1),
    deviceId: z.string().min(1).nullable(),
  })
  .strict()

export const PedidoDeTurnoSchema = z
  .object({
    requester: RequesterDoPedidoSchema,
    mensagem: z.string().min(1).max(MAX_CHARS_MENSAGEM),
  })
  .strict()

export type PedidoDeTurno = z.infer<typeof PedidoDeTurnoSchema>

/**
 * `runId` é identidade de auditoria — nunca escolhido pelo cliente. Deixar o cliente
 * escolher permitiria dois turnos compartilharem o mesmo id de registro.
 */
export function montarRequester(
  pedido: PedidoDeTurno,
  gerarRunId: () => string,
): RequesterContext {
  const requester = {
    requesterUserId: pedido.requester.requesterUserId,
    deviceId: pedido.requester.deviceId,
    runId: gerarRunId(),
  }
  return RequesterContextSchema.parse(requester)
}
