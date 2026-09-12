import { z } from 'zod'
import { WorkspaceApiError } from '@cora/workspace-client'
import { MotorError } from '../engine/port.js'

/**
 * Toda falha que pode acontecer entre receber um `POST /turno` e devolver a resposta,
 * traduzida numa categoria fechada. `MotorError.message` e `WorkspaceApiError.message`
 * podem ecoar trecho da própria requisição (ver comentário em
 * `engine/anthropic-adapter.ts`) — por isso NUNCA saem daqui para o corpo HTTP. Esse
 * texto vai só para `descreverParaLog`, destino stderr.
 */
export type CategoriaDeErro =
  | 'corpo_ilegivel'
  | 'corpo_invalido'
  | 'requester_ausente'
  | 'corpo_grande_demais'
  | 'tipo_nao_suportado'
  | 'metodo_nao_permitido'
  | 'rota_desconhecida'
  | 'host_nao_permitido'
  | 'credenciais_invalidas'
  | 'bloqueado_por_tentativas'
  | 'sessao_ausente'
  | 'sessao_expirada'
  | 'falha_do_motor'
  | 'falha_do_workspace'
  | 'falha_interna'

export interface RespostaDeErro {
  status: number
  corpo: {
    erro: {
      categoria: CategoriaDeErro
      mensagem: string
      campos?: string[]
    }
  }
}

/**
 * Erro de upstream (motor de IA, Workspace) vira 502: quem falhou foi o provedor, não o
 * cliente HTTP — devolver 4xx diria "seu pedido estava errado" quando não estava.
 */
export const STATUS_POR_CATEGORIA: Record<CategoriaDeErro, number> = {
  corpo_ilegivel: 400,
  requester_ausente: 400,
  corpo_invalido: 422,
  corpo_grande_demais: 413,
  tipo_nao_suportado: 415,
  metodo_nao_permitido: 405,
  rota_desconhecida: 404,
  host_nao_permitido: 400,
  credenciais_invalidas: 401,
  bloqueado_por_tentativas: 429,
  sessao_ausente: 401,
  sessao_expirada: 401,
  falha_do_motor: 502,
  falha_do_workspace: 502,
  falha_interna: 500,
}

const MENSAGEM_POR_CATEGORIA: Record<CategoriaDeErro, string> = {
  corpo_ilegivel: 'O corpo da requisição não é um JSON válido.',
  requester_ausente: 'O campo "requester" é obrigatório.',
  corpo_invalido: 'O corpo da requisição não corresponde ao formato esperado.',
  corpo_grande_demais: 'O corpo da requisição é maior que o permitido.',
  tipo_nao_suportado: 'O cabeçalho Content-Type precisa ser application/json.',
  metodo_nao_permitido: 'Método não permitido para esta rota.',
  rota_desconhecida: 'Rota não encontrada.',
  host_nao_permitido: 'Cabeçalho Host não corresponde a este servidor.',
  credenciais_invalidas: 'E-mail ou senha inválidos.',
  bloqueado_por_tentativas: 'Muitas tentativas. Tente novamente mais tarde.',
  sessao_ausente: 'Nenhuma sessão ativa.',
  sessao_expirada: 'A sessão expirou. Entre novamente.',
  falha_do_motor: 'O motor de conversa falhou ao processar o turno.',
  falha_do_workspace: 'A comunicação com o Workspace falhou.',
  falha_interna: 'Falha interna inesperada.',
}

export function erroDeCategoria(
  categoria: CategoriaDeErro,
  mensagem?: string,
  campos?: string[],
): RespostaDeErro {
  return {
    status: STATUS_POR_CATEGORIA[categoria],
    corpo: {
      erro: {
        categoria,
        mensagem: mensagem ?? MENSAGEM_POR_CATEGORIA[categoria],
        ...(campos ? { campos } : {}),
      },
    },
  }
}

/** Traduz qualquer causa capturada num handler em resposta HTTP segura de expor. */
export function traduzirFalha(cause: unknown): RespostaDeErro {
  if (cause instanceof z.ZodError) {
    const campos = cause.issues.map((issue) => issue.path.join('.'))
    return erroDeCategoria('corpo_invalido', undefined, campos)
  }
  if (cause instanceof MotorError) {
    return erroDeCategoria('falha_do_motor')
  }
  if (cause instanceof WorkspaceApiError) {
    return erroDeCategoria(
      'falha_do_workspace',
      `A comunicação com o Workspace falhou (${cause.code}).`,
    )
  }
  return erroDeCategoria('falha_interna')
}

/** Texto para stderr. É o único lugar autorizado a carregar a mensagem original. */
export function descreverParaLog(cause: unknown): string {
  if (cause instanceof Error) {
    return `${cause.name}: ${cause.message}`
  }
  return `causa não-Error: ${String(cause)}`
}
