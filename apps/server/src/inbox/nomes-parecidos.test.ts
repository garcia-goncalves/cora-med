import { describe, expect, it } from 'vitest'

import * as nomesParecidos from './nomes-parecidos.js'
import { sugerirParecidos } from './nomes-parecidos.js'

describe('sugerirParecidos', () => {
  it('sugere "Thaís Souza" e "thais souza" por igualdade normalizada', () => {
    const entradas = [
      { id: 'SYNTH-cliente-01', nome: 'Thaís Souza' },
      { id: 'SYNTH-cliente-02', nome: 'thais souza' },
    ]

    const sugestoes = sugerirParecidos(entradas)

    expect(sugestoes).toEqual([
      { idA: 'SYNTH-cliente-01', idB: 'SYNTH-cliente-02', motivo: 'igualdade_normalizada' },
    ])
  })

  it('sugere "Clínica Sol" e "Clínica Sol Nascente" por substring', () => {
    const entradas = [
      { id: 'SYNTH-cliente-03', nome: 'Clínica Sol' },
      { id: 'SYNTH-cliente-04', nome: 'Clínica Sol Nascente' },
    ]

    const sugestoes = sugerirParecidos(entradas)

    expect(sugestoes).toEqual([
      { idA: 'SYNTH-cliente-03', idB: 'SYNTH-cliente-04', motivo: 'substring' },
    ])
  })

  it('não sugere "João" e "Maria"', () => {
    const entradas = [
      { id: 'SYNTH-cliente-05', nome: 'João' },
      { id: 'SYNTH-cliente-06', nome: 'Maria' },
    ]

    expect(sugerirParecidos(entradas)).toEqual([])
  })

  it('devolve a entrada intacta: fundir sozinha é o tipo de erro que ninguém percebe até a fatura sair no nome errado', () => {
    const entradas = [
      { id: 'SYNTH-cliente-01', nome: 'Thaís Souza' },
      { id: 'SYNTH-cliente-02', nome: 'thais souza' },
    ]
    const copiaOriginal = entradas.map((entrada) => ({ ...entrada }))

    sugerirParecidos(entradas)

    expect(entradas).toEqual(copiaOriginal)
    expect(entradas).toHaveLength(2)
  })

  it('não exporta nada com nome de fusão', () => {
    const chaves = Object.keys(nomesParecidos)

    expect(chaves).not.toContain('fundir')
    expect(chaves).not.toContain('merge')
    expect(chaves).not.toContain('unificar')
  })
})
