/**
 * Serialização do cookie de sessão. `HttpOnly` e `SameSite=Lax` sempre presentes — não são
 * opção. `Secure` é o padrão e só cai por decisão explícita (decisão D4 do plano da Fase 4):
 * ausência de opção significa `Secure` ligado, nunca o contrário.
 *
 * Nome do cookie: `__Host-cora_sessao` por padrão. O prefixo `__Host-` (RFC exige `Secure`,
 * `Path=/` e proíbe `Domain`) é o que impede outro projeto no mesmo domínio raiz
 * `medconsultoria.com.br`, fora do controle deste repositório, de gravar um cookie de
 * mesmo nome com `Domain` mais amplo e ser aceito antes do legítimo. `CORA_COOKIE_INSEGURO`
 * remove `Secure`, o que quebraria a regra do prefixo — nesse modo o nome muda para
 * `cora_sessao_dev`, sem prefixo, documentado como uso só local.
 */

export const NOME_COOKIE_SESSAO_SEGURO = '__Host-cora_sessao'
export const NOME_COOKIE_SESSAO_INSEGURO = 'cora_sessao_dev'

/** Nome do cookie de sessão a usar, conforme `CORA_COOKIE_INSEGURO`. */
export function nomeCookieSessao(inseguro?: boolean): string {
  return inseguro ? NOME_COOKIE_SESSAO_INSEGURO : NOME_COOKIE_SESSAO_SEGURO
}

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
    `${nomeCookieSessao(opcoes.inseguro)}=${token}`,
    atributosComuns(opcoes),
    `Max-Age=${opcoes.maxIdadeSegundos}`,
  ].join('; ')
}

export function serializarCookieDeSaida(opcoes?: { inseguro?: boolean }): string {
  return [`${nomeCookieSessao(opcoes?.inseguro)}=`, atributosComuns(opcoes), 'Max-Age=0'].join('; ')
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
