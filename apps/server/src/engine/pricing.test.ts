import { describe, expect, it } from 'vitest'

import {
  calcularCusto,
  diasDesdeVerificacao,
  PRECO_VALIDADE_DIAS,
  PRECOS_VERIFICADOS_EM,
  precoDe,
} from './pricing.js'

describe('preço de modelo', () => {
  it('calcula o custo de um passo com a tabela verificada', () => {
    // 3.000 tokens de entrada a $5/milhão = $0,015
    // 500 tokens de saída a $25/milhão   = $0,0125
    const custo = calcularCusto('claude-opus-5', {
      entrada: 3000,
      saida: 500,
      leituraCache: 0,
      escritaCache: 0,
    })
    expect(custo.custoUsd).toBeCloseTo(0.0275, 10)
    expect(custo.precoVerificadoEm).toBe(PRECOS_VERIFICADOS_EM)
  })

  it('cobra leitura e escrita de cache pelas suas próprias tarifas', () => {
    // 10.000 lidos do cache a $0,50/milhão = $0,005
    // 2.000 escritos no cache a $6,25/milhão = $0,0125
    const custo = calcularCusto('claude-opus-5', {
      entrada: 0,
      saida: 0,
      leituraCache: 10_000,
      escritaCache: 2000,
    })
    expect(custo.custoUsd).toBeCloseTo(0.0175, 10)
  })

  it('modelo sem preço conhecido produz custo NULO, nunca zero', () => {
    // Esta é a regra do briefing §12, e é o motivo deste módulo existir: um zero aqui
    // vira relatório de custo que mente para baixo, e ninguém audita um número bom.
    const custo = calcularCusto('modelo-que-nao-existe', {
      entrada: 999_999,
      saida: 999_999,
      leituraCache: 0,
      escritaCache: 0,
    })
    expect(custo.custoUsd).toBeNull()
    expect(custo.custoUsd).not.toBe(0)
    expect(custo.precoVerificadoEm).toBeNull()
  })

  it('distingue "não gastou nada" de "não sei o preço"', () => {
    const semGasto = calcularCusto('claude-opus-5', {
      entrada: 0,
      saida: 0,
      leituraCache: 0,
      escritaCache: 0,
    })
    expect(semGasto.custoUsd).toBe(0)
    expect(semGasto.precoVerificadoEm).toBe(PRECOS_VERIFICADOS_EM)
  })

  it('conhece os três modelos citados na ADR 0002', () => {
    expect(precoDe('claude-opus-5')).toEqual({
      entrada: 5,
      saida: 25,
      escritaCache5m: 6.25,
      leituraCache: 0.5,
    })
    expect(precoDe('claude-sonnet-5')?.entrada).toBe(2)
    expect(precoDe('claude-haiku-4-5')?.saida).toBe(5)
  })

  it('a tabela de preço ainda está dentro da validade declarada', () => {
    // Este teste NÃO adivinha preço novo. Ele obriga alguém a ir conferir a página
    // oficial quando a tabela envelhece — porque preço velho afirmado com confiança é
    // pior do que preço ausente.
    const dias = diasDesdeVerificacao(new Date())
    expect(
      dias,
      `A tabela de preços foi verificada em ${PRECOS_VERIFICADOS_EM}, há ${dias} dias. ` +
        `Passou de ${PRECO_VALIDADE_DIAS}. Confira a página oficial de preços e atualize ` +
        'apps/server/src/engine/pricing.ts junto com a data.',
    ).toBeLessThanOrEqual(PRECO_VALIDADE_DIAS)
  })
})
