import { describe, expect, it } from 'vitest'
import { MAX_CHARS_MENSAGEM, PedidoDeTurnoSchema, montarRequester } from './contrato.js'

const corpoValido = {
  requester: { requesterUserId: 'SYNTH-user-1', deviceId: null },
  mensagem: 'SYNTH-crie uma tarefa para o Dr. Souza',
}

describe('PedidoDeTurnoSchema', () => {
  it('aceita o corpo mínimo válido', () => {
    const resultado = PedidoDeTurnoSchema.safeParse(corpoValido)
    expect(resultado.success).toBe(true)
  })

  it('recusa corpo sem requester', () => {
    const resultado = PedidoDeTurnoSchema.safeParse({ mensagem: 'SYNTH-oi' })
    expect(resultado.success).toBe(false)
  })

  it('recusa requesterUserId vazio', () => {
    const resultado = PedidoDeTurnoSchema.safeParse({
      ...corpoValido,
      requester: { ...corpoValido.requester, requesterUserId: '' },
    })
    expect(resultado.success).toBe(false)
  })

  it('aceita deviceId nulo', () => {
    const resultado = PedidoDeTurnoSchema.safeParse(corpoValido)
    expect(resultado.success).toBe(true)
  })

  it('recusa deviceId vazio (string vazia não é "sem dispositivo")', () => {
    const resultado = PedidoDeTurnoSchema.safeParse({
      ...corpoValido,
      requester: { ...corpoValido.requester, deviceId: '' },
    })
    expect(resultado.success).toBe(false)
  })

  it('recusa mensagem vazia', () => {
    const resultado = PedidoDeTurnoSchema.safeParse({ ...corpoValido, mensagem: '' })
    expect(resultado.success).toBe(false)
  })

  it('recusa mensagem acima do teto de caracteres', () => {
    const resultado = PedidoDeTurnoSchema.safeParse({
      ...corpoValido,
      mensagem: 'a'.repeat(MAX_CHARS_MENSAGEM + 1),
    })
    expect(resultado.success).toBe(false)
  })

  it('recusa campo desconhecido no nível raiz (runId não vem do cliente)', () => {
    const resultado = PedidoDeTurnoSchema.safeParse({ ...corpoValido, runId: 'SYNTH-forjado' })
    expect(resultado.success).toBe(false)
  })

  it('recusa campo desconhecido dentro de requester (aprovação não vem do cliente)', () => {
    const resultado = PedidoDeTurnoSchema.safeParse({
      requester: { ...corpoValido.requester, aprovacoes: [] },
      mensagem: corpoValido.mensagem,
    })
    expect(resultado.success).toBe(false)
  })
})

describe('montarRequester', () => {
  it('monta RequesterContext com o runId do gerador injetado', () => {
    const parsed = PedidoDeTurnoSchema.parse(corpoValido)
    const requester = montarRequester(parsed, () => 'SYNTH-run-fixo')

    expect(requester).toEqual({
      requesterUserId: 'SYNTH-user-1',
      deviceId: null,
      runId: 'SYNTH-run-fixo',
    })
  })

  it('produz um objeto que passa em RequesterContextSchema', async () => {
    const { RequesterContextSchema } = await import('@cora/contracts')
    const parsed = PedidoDeTurnoSchema.parse(corpoValido)
    const requester = montarRequester(parsed, () => 'SYNTH-run-2')

    expect(RequesterContextSchema.safeParse(requester).success).toBe(true)
  })
})
