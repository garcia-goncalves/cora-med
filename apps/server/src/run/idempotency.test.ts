import { describe, expect, it } from 'vitest'

import {
  descreverResultado,
  novaChaveDeIdempotencia,
  pareceChaveValida,
  type ResultadoDeCriacao,
} from './idempotency.js'

describe('chave de idempotência', () => {
  it('é UUID v4', () => {
    expect(pareceChaveValida(novaChaveDeIdempotencia())).toBe(true)
  })

  it('NÃO é função dos argumentos — dois pedidos idênticos geram chaves diferentes', () => {
    // Este é o teste que trava a correção que veio do WORKSPACE. Se a chave derivasse do
    // conteúdo, duas tarefas legitimamente iguais no mesmo dia ("ligar para a clínica")
    // colidiriam, e a segunda sumiria sem ninguém saber.
    const chaves = new Set(Array.from({ length: 50 }, () => novaChaveDeIdempotencia()))
    expect(chaves.size).toBe(50)
  })

  it('rejeita o que não é UUID v4', () => {
    expect(pareceChaveValida('SYNTH-chave')).toBe(false)
    expect(pareceChaveValida('')).toBe(false)
    // UUID v1 tem '1' na posição da versão: não serve, porque carrega tempo e MAC.
    expect(pareceChaveValida('c232ab00-9414-11ec-b3c8-9f6bdeced846')).toBe(false)
  })
})

describe('o que a Cora diz sobre o resultado', () => {
  const casos: Array<[string, ResultadoDeCriacao]> = [
    ['criada', { estado: 'criada', taskId: 'SYNTH-task-1' }],
    ['ja_existia', { estado: 'ja_existia', taskId: 'SYNTH-task-1' }],
    ['conflito', { estado: 'conflito', detalhe: 'título diferente' }],
    [
      'desconhecido',
      { estado: 'desconhecido', idempotencyKey: 'SYNTH-key', motivo: 'timeout de rede' },
    ],
  ]

  it('os quatro estados produzem quatro frases distintas', () => {
    // "criei", "já estava criada", "não deu" e "não sei" são quatro fatos diferentes.
    // Juntar dois deles é como a confiança dela se perde.
    const frases = new Set(casos.map(([, r]) => descreverResultado(r)))
    expect(frases.size).toBe(4)
  })

  it('resultado desconhecido não diz que criou nem que falhou', () => {
    const frase = descreverResultado({
      estado: 'desconhecido',
      idempotencyKey: 'SYNTH-key',
      motivo: 'timeout de rede',
    })
    expect(frase).toContain('não sei se a tarefa foi criada')
    expect(frase).toContain('NÃO vou repetir')
    expect(frase).not.toMatch(/^Criei/)
  })

  it('"já existia" deixa explícito que não houve segunda tarefa', () => {
    const frase = descreverResultado({ estado: 'ja_existia', taskId: 'SYNTH-task-1' })
    expect(frase).toContain('Não criei uma segunda')
  })
})
