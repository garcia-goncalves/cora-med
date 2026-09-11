import type { InboxItem } from '@cora/contracts'
import { describe, expect, it } from 'vitest'

import { FilaDeEntrada } from './fila.js'

/** Item sintético de inbox — prefixo `SYNTH-`, como todo dado de teste deste repositório. */
function itemSintetico(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    tipo: 'tarefa',
    fonte: 'workspace:tasks',
    identificadorDoWorkspace: 'SYNTH-task-001',
    titulo: 'Conferir cadastro fictício da operadora sintética',
    status: 'PENDENTE',
    prioridade: 'NORMAL',
    prazo: null,
    vistoEm: '2026-09-11T10:00:00-03:00',
    ...overrides,
  }
}

describe('FilaDeEntrada', () => {
  it('dois itens diferentes entram os dois', () => {
    const fila = new FilaDeEntrada()

    expect(fila.adicionar(itemSintetico({ identificadorDoWorkspace: 'SYNTH-task-001' }))).toBe(
      'novo',
    )
    expect(fila.adicionar(itemSintetico({ identificadorDoWorkspace: 'SYNTH-task-002' }))).toBe(
      'novo',
    )
    expect(fila.tamanho()).toBe(2)
  })

  it('o mesmo (fonte, identificador) entra uma vez só', () => {
    const fila = new FilaDeEntrada()

    expect(fila.adicionar(itemSintetico())).toBe('novo')
    expect(fila.adicionar(itemSintetico())).toBe('duplicado')
    expect(fila.tamanho()).toBe(1)
  })

  it('o mesmo identificador com título diferente continua sendo duplicata, e o item guardado é o primeiro', () => {
    const fila = new FilaDeEntrada()

    fila.adicionar(itemSintetico({ titulo: 'Título original' }))
    const resultado = fila.adicionar(itemSintetico({ titulo: 'Título renomeado pelo Workspace' }))

    expect(resultado).toBe('duplicado')
    expect(fila.tamanho()).toBe(1)
    expect(fila.itens()[0]?.titulo).toBe('Título original')
  })

  it('itens() não deixa mexer na fila por fora', () => {
    const fila = new FilaDeEntrada()
    fila.adicionar(itemSintetico())

    const copia = fila.itens()
    // @ts-expect-error -- teste propositalmente muta um array que deveria ser readonly
    copia.push(itemSintetico({ identificadorDoWorkspace: 'SYNTH-task-999' }))

    expect(fila.tamanho()).toBe(1)
  })
})
