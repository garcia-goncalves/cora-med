import { describe, expect, it } from 'vitest'

import { lerCookie, serializarCookieDeSaida, serializarCookieDeSessao } from './cookie.js'

describe('serializarCookieDeSessao', () => {
  it('cookie de sessão sai com HttpOnly, Secure e SameSite=Lax', () => {
    const cookie = serializarCookieDeSessao('token-abc', { maxIdadeSegundos: 3600 })

    expect(cookie).toContain('cora_sessao=token-abc')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('Max-Age=3600')
  })

  it('perde só o Secure quando pedido explicitamente (CORA_COOKIE_INSEGURO)', () => {
    const cookie = serializarCookieDeSessao('token-abc', {
      maxIdadeSegundos: 3600,
      inseguro: true,
    })

    expect(cookie).not.toContain('Secure')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
  })
})

describe('serializarCookieDeSaida', () => {
  it('expira o cookie com Max-Age=0 e mantém Secure por padrão', () => {
    const cookie = serializarCookieDeSaida()

    expect(cookie).toContain('cora_sessao=;')
    expect(cookie).toContain('Max-Age=0')
    expect(cookie).toContain('Secure')
  })
})

describe('lerCookie', () => {
  it('devolve indefinido para cabeçalho ausente', () => {
    expect(lerCookie(undefined, 'cora_sessao')).toBeUndefined()
  })

  it('devolve indefinido para cabeçalho vazio', () => {
    expect(lerCookie('', 'cora_sessao')).toBeUndefined()
  })

  it('devolve indefinido para cabeçalho malformado', () => {
    expect(lerCookie('isso-nao-e-um-cookie-valido', 'cora_sessao')).toBeUndefined()
  })

  it('lê o valor certo entre outros cookies', () => {
    const cabecalho = 'outro=1; cora_sessao=token-xyz; mais_um=2'

    expect(lerCookie(cabecalho, 'cora_sessao')).toBe('token-xyz')
  })

  it('devolve indefinido quando o nome não está presente', () => {
    expect(lerCookie('outro=1', 'cora_sessao')).toBeUndefined()
  })
})
