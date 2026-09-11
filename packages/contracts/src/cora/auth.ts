import { z } from 'zod'

/**
 * Contrato de sessão da Cora: o formato do pedido de entrada, da sessão que a tela
 * conhece e da resposta de `POST /auth/entrar`. Servidor e tela compartilham este único
 * schema — a tela não duplica validação em `apps/web`.
 *
 * `.strict()` em todo nível, mesma disciplina de `apps/server/src/http/contrato.ts`: um
 * cliente que mande campo a mais recebe recusa ALTA (422), em vez de ver o campo ser
 * silenciosamente ignorado.
 */

/** Teto de tamanho do e-mail digitado no formulário. */
export const MAX_CHARS_EMAIL = 254

/** Teto de tamanho da senha digitada no formulário. */
export const MAX_CHARS_SENHA = 200

export const PedidoDeEntradaSchema = z
  .object({
    email: z.string().min(1).max(MAX_CHARS_EMAIL).email(),
    senha: z.string().min(1).max(MAX_CHARS_SENHA),
  })
  .strict()
export type PedidoDeEntrada = z.infer<typeof PedidoDeEntradaSchema>

/**
 * O que a tela pode saber sobre quem está logado. **Nunca** inclui token de autorização,
 * segredo de senha nem qualquer outro dado sensível — só id da conta, nome e e-mail.
 */
export const SessaoDoUsuarioSchema = z
  .object({
    idDaConta: z.string().min(1),
    nome: z.string().min(1),
    email: z.string().min(1).max(MAX_CHARS_EMAIL).email(),
  })
  .strict()
export type SessaoDoUsuario = z.infer<typeof SessaoDoUsuarioSchema>

export const RespostaDeEntradaSchema = z
  .object({
    sessao: SessaoDoUsuarioSchema,
  })
  .strict()
export type RespostaDeEntrada = z.infer<typeof RespostaDeEntradaSchema>

/**
 * União fechada dos motivos de recusa de `POST /auth/entrar`. Nada além destes dois: a
 * tela nunca aprende se o e-mail existe — o `design.md` fixa que o erro não diz qual
 * campo errou.
 */
export const MotivoDeRecusaDeEntradaSchema = z.enum([
  'credenciais_invalidas',
  'bloqueado_por_tentativas',
])
export type MotivoDeRecusaDeEntrada = z.infer<typeof MotivoDeRecusaDeEntradaSchema>
