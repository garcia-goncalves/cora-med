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

  it('o mesmo identificador com título diferente continua sendo duplicata, e o item guardado é o mais recente', () => {
    // Uma integração real mostrou que "o primeiro registro é o que vale" congela a
    // tarefa: se ela sai de PENDENTE para FAZENDO, a fila nunca atualiza e o resumo
    // repete o status velho para sempre, enquanto o processo viver. Por isso `adicionar`
    // agora faz upsert — o registro mais novo substitui o mais velho.
    const fila = new FilaDeEntrada()

    fila.adicionar(itemSintetico({ titulo: 'Título original', status: 'PENDENTE' }))
    const resultado = fila.adicionar(
      itemSintetico({ titulo: 'Título renomeado pelo Workspace', status: 'FAZENDO' }),
    )

    expect(resultado).toBe('duplicado')
    expect(fila.tamanho()).toBe(1)
    expect(fila.itens()[0]?.titulo).toBe('Título renomeado pelo Workspace')
    expect(fila.itens()[0]?.status).toBe('FAZENDO')
  })

  it('substituirFonte remove item que não veio na sincronização completa mais recente', () => {
    // Cenário da revisão de segurança: tarefa criada, vista numa sincronização, e apagada
    // (ou tirada de escopo) antes da próxima. Uma sincronização completa que não trouxe
    // mais o item tem de tirá-lo da fila — upsert sozinho não resolve exclusão.
    const fila = new FilaDeEntrada()
    fila.adicionar(itemSintetico({ identificadorDoWorkspace: 'SYNTH-task-001' }))
    fila.adicionar(itemSintetico({ identificadorDoWorkspace: 'SYNTH-task-002' }))

    fila.substituirFonte('workspace:tasks', [
      itemSintetico({ identificadorDoWorkspace: 'SYNTH-task-001' }),
    ])

    expect(fila.tamanho()).toBe(1)
    expect(fila.itens()[0]?.identificadorDoWorkspace).toBe('SYNTH-task-001')
  })

  it('substituirFonte com lista vazia esvazia a fila daquela fonte', () => {
    const fila = new FilaDeEntrada()
    fila.adicionar(itemSintetico({ identificadorDoWorkspace: 'SYNTH-task-001' }))

    fila.substituirFonte('workspace:tasks', [])

    expect(fila.tamanho()).toBe(0)
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
