import { describe, expect, it } from 'vitest'

import { chaveDeInbox, InboxItemSchema, type InboxItem } from './inbox.js'

const itemBase: InboxItem = {
  tipo: 'tarefa',
  fonte: 'workspace:tasks',
  identificadorDoWorkspace: 'SYNTH-task-001',
  titulo: 'Conferir cadastro fictício da operadora sintética',
  status: 'PENDENTE',
  prioridade: 'NORMAL',
  prazo: null,
  vistoEm: '2026-09-10T12:00:00-03:00',
}

describe('chaveDeInbox', () => {
  it('produz a mesma chave para a mesma (fonte, identificador) em chamadas separadas', () => {
    // a chave tem de ser reproduzível: é ela que detecta "já vi esse item".
    expect(chaveDeInbox(itemBase)).toBe(chaveDeInbox({ ...itemBase }))
  })

  it('produz chaves diferentes para identificadores diferentes', () => {
    const outro: InboxItem = { ...itemBase, identificadorDoWorkspace: 'SYNTH-task-002' }
    expect(chaveDeInbox(itemBase)).not.toBe(chaveDeInbox(outro))
  })

  it('não muda quando titulo, status ou vistoEm mudam — é derivada da identidade', () => {
    // isso é o que faz "reprocessei o mesmo item" ser reconhecível: o conteúdo pode
    // mudar entre duas sincronizações, a chave não.
    const reprocessado: InboxItem = {
      ...itemBase,
      titulo: 'Título mudou depois de reprocessar',
      status: 'FAZENDO',
      vistoEm: '2026-09-10T18:00:00-03:00',
    }
    expect(chaveDeInbox(reprocessado)).toBe(chaveDeInbox(itemBase))
  })
})

describe('InboxItemSchema', () => {
  it('aceita um item do tipo tarefa válido', () => {
    expect(InboxItemSchema.safeParse(itemBase).success).toBe(true)
  })

  it('recusa tipo "card" — o discriminador só implementa "tarefa" hoje', () => {
    const cardInvalido = { ...itemBase, tipo: 'card' }
    expect(InboxItemSchema.safeParse(cardInvalido).success).toBe(false)
  })

  it('recusa tipo "evento" — o discriminador só implementa "tarefa" hoje', () => {
    const eventoInvalido = { ...itemBase, tipo: 'evento' }
    expect(InboxItemSchema.safeParse(eventoInvalido).success).toBe(false)
  })

  it('recusa identificadorDoWorkspace vazio', () => {
    const semIdentificador = { ...itemBase, identificadorDoWorkspace: '' }
    expect(InboxItemSchema.safeParse(semIdentificador).success).toBe(false)
  })
})
