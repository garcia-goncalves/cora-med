import { describe, expect, it } from 'vitest'

import { ArmazemDeSessoes } from './sessao.js'

const UM_MINUTO_MS = 60 * 1000

describe('ArmazemDeSessoes', () => {
  it('sessão recém-criada é válida', () => {
    const armazem = new ArmazemDeSessoes({ now: () => new Date('2026-01-01T10:00:00Z') })
    const { token } = armazem.criar('conta-1')

    const resultado = armazem.validar(token)

    expect(resultado.estado).toBe('valida')
    if (resultado.estado === 'valida') {
      expect(resultado.sessao.idDaConta).toBe('conta-1')
    }
  })

  it('expira um milissegundo depois do TTL', () => {
    let agora = new Date('2026-01-01T10:00:00.000Z')
    const armazem = new ArmazemDeSessoes({ now: () => agora, ttlMs: UM_MINUTO_MS })
    const { token } = armazem.criar('conta-1')

    agora = new Date('2026-01-01T10:01:00.001Z')

    expect(armazem.validar(token).estado).toBe('expirada')
  })

  it('expira EXATAMENTE no instante do TTL — a fronteira é fechada', () => {
    let agora = new Date('2026-01-01T10:00:00.000Z')
    const armazem = new ArmazemDeSessoes({ now: () => agora, ttlMs: UM_MINUTO_MS })
    const { token } = armazem.criar('conta-1')

    agora = new Date('2026-01-01T10:01:00.000Z')

    expect(armazem.validar(token).estado).toBe('expirada')
  })

  it('um milissegundo ANTES do TTL ainda é válida', () => {
    let agora = new Date('2026-01-01T10:00:00.000Z')
    const armazem = new ArmazemDeSessoes({ now: () => agora, ttlMs: UM_MINUTO_MS })
    const { token } = armazem.criar('conta-1')

    agora = new Date('2026-01-01T10:00:59.999Z')

    expect(armazem.validar(token).estado).toBe('valida')
  })

  it('token que nunca existiu é "inexistente", não "expirada"', () => {
    const armazem = new ArmazemDeSessoes()

    expect(armazem.validar('token-nunca-emitido').estado).toBe('inexistente')
  })

  it('token adulterado de mesmo tamanho é "inexistente"', () => {
    const armazem = new ArmazemDeSessoes()
    const { token } = armazem.criar('conta-1')
    const adulterado = token.slice(0, -1) + (token.at(-1) === 'a' ? 'b' : 'a')

    expect(adulterado.length).toBe(token.length)
    expect(armazem.validar(adulterado).estado).toBe('inexistente')
  })

  it('encerrar invalida a sessão na hora', () => {
    const armazem = new ArmazemDeSessoes()
    const { token } = armazem.criar('conta-1')

    armazem.encerrar(token)

    expect(armazem.validar(token).estado).toBe('inexistente')
  })

  it('encerrar token desconhecido não lança', () => {
    const armazem = new ArmazemDeSessoes()

    expect(() => armazem.encerrar('token-que-nao-existe')).not.toThrow()
  })

  it('duas sessões criadas em sequência recebem tokens diferentes', () => {
    const armazem = new ArmazemDeSessoes()
    const primeira = armazem.criar('conta-1')
    const segunda = armazem.criar('conta-2')

    expect(primeira.token).not.toBe(segunda.token)
  })

  it('criar() varre e remove sessão expirada de antes — o Map não cresce para sempre', () => {
    let agora = new Date('2026-01-01T10:00:00.000Z')
    let contadorDeTokens = 0
    const armazem = new ArmazemDeSessoes({
      now: () => agora,
      ttlMs: UM_MINUTO_MS,
      gerarToken: () => {
        contadorDeTokens += 1
        return `SYNTH-token-${contadorDeTokens}`
      },
    })

    const primeira = armazem.criar('conta-1')
    agora = new Date('2026-01-01T10:02:00.000Z') // passou o TTL da primeira
    armazem.criar('conta-2') // dispara a varredura

    // A sessão expirada foi removida de verdade do Map, não só recusada na leitura.
    expect(armazem.validar(primeira.token).estado).toBe('inexistente')
  })
})
