import { describe, expect, it, vi } from 'vitest'

import { criarControleDeInstalacao, type EventoDeInstalacaoPwa } from './instalacao.js'

function criarEventoFalso(outcome: 'accepted' | 'dismissed' = 'accepted') {
  return {
    preventDefault: vi.fn(),
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  } satisfies EventoDeInstalacaoPwa
}

describe('criarControleDeInstalacao', () => {
  it('não permite instalar antes de qualquer evento chegar', () => {
    const controle = criarControleDeInstalacao()
    expect(controle.podeInstalar()).toBe(false)
  })

  it('passa a permitir instalar depois do evento e cancela o prompt automático do navegador', () => {
    const controle = criarControleDeInstalacao()
    const evento = criarEventoFalso()

    controle.registrarEventoDisponivel(evento)

    expect(controle.podeInstalar()).toBe(true)
    expect(evento.preventDefault).toHaveBeenCalledOnce()
  })

  it('instalar dispara o prompt nativo, aguarda a escolha e some com a possibilidade de instalar', async () => {
    const controle = criarControleDeInstalacao()
    const evento = criarEventoFalso('accepted')
    controle.registrarEventoDisponivel(evento)

    await controle.instalar()

    expect(evento.prompt).toHaveBeenCalledOnce()
    expect(controle.podeInstalar()).toBe(false)
  })

  it('instalar sem evento nenhum não faz nada', async () => {
    const controle = criarControleDeInstalacao()
    await expect(controle.instalar()).resolves.toBeUndefined()
    expect(controle.podeInstalar()).toBe(false)
  })

  it('recusar esconde a possibilidade de instalar, mesmo com evento guardado', () => {
    const controle = criarControleDeInstalacao()
    controle.registrarEventoDisponivel(criarEventoFalso())

    controle.recusar()

    expect(controle.podeInstalar()).toBe(false)
  })

  it('a recusa vale para a sessão inteira: um novo evento não volta a permitir instalar', () => {
    const controle = criarControleDeInstalacao()
    controle.registrarEventoDisponivel(criarEventoFalso())
    controle.recusar()
    expect(controle.podeInstalar()).toBe(false)

    controle.registrarEventoDisponivel(criarEventoFalso())
    expect(controle.podeInstalar()).toBe(false)
  })

  it('uma nova instância (equivalente a recarregar a página) esquece a recusa anterior', () => {
    const controleDaSessaoAnterior = criarControleDeInstalacao()
    controleDaSessaoAnterior.registrarEventoDisponivel(criarEventoFalso())
    controleDaSessaoAnterior.recusar()

    const controleDaNovaSessao = criarControleDeInstalacao()
    controleDaNovaSessao.registrarEventoDisponivel(criarEventoFalso())
    expect(controleDaNovaSessao.podeInstalar()).toBe(true)
  })
})
