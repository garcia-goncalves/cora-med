/**
 * Serialização do cookie de sessão. `HttpOnly` e `SameSite=Lax` sempre presentes — não são
 * opção. `Secure` é o padrão e só cai por decisão explícita (decisão D4 do plano da Fase 4):
 * ausência de opção significa `Secure` ligado, nunca o contrário.
 */

export const NOME_COOKIE_SESSAO = 'cora_sessao'

export interface OpcoesDeCookieDeSessao {
  /** Segundos até expirar, coerente com o TTL da sessão. */
  maxIdadeSegundos: number
  /** `true` só em desenvolvimento (`CORA_COOKIE_INSEGURO=1`). Padrão: `Secure` ligado. */
  inseguro?: boolean
}

function atributosComuns(opcoes?: { inseguro?: boolean }): string {
  const partes = ['Path=/', 'HttpOnly', 'SameSite=Lax']
  if (!opcoes?.inseguro) partes.push('Secure')
  return partes.join('; ')
}

export function serializarCookieDeSessao(token: string, opcoes: OpcoesDeCookieDeSessao): string {
  return [
    `${NOME_COOKIE_SESSAO}=${token}`,
    atributosComuns(opcoes),
    `Max-Age=${opcoes.maxIdadeSegundos}`,
  ].join('; ')
}

export function serializarCookieDeSaida(opcoes?: { inseguro?: boolean }): string {
  return [`${NOME_COOKIE_SESSAO}=`, atributosComuns(opcoes), 'Max-Age=0'].join('; ')
}

/**
 * Parser tolerante do cabeçalho `Cookie`. Nunca lança: cabeçalho ausente, vazio ou
 * malformado devolvem `undefined`, nunca uma exceção que derrubaria a requisição inteira
 * por causa de um cookie mal formado mandado por outra parte.
 */
export function lerCookie(cabecalho: string | undefined, nome: string): string | undefined {
  if (!cabecalho) return undefined
  for (const par of cabecalho.split(';')) {
    const indice = par.indexOf('=')
    if (indice === -1) continue
    const chave = par.slice(0, indice).trim()
    if (chave !== nome) continue
    return par.slice(indice + 1).trim()
  }
  return undefined
}
