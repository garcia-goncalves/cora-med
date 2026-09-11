import { describe, expect, it } from 'vitest'
import { MAX_CHARS_MENSAGEM, PedidoDeTurnoSchema, montarRequester } from './contrato.js'

const corpoValido = {
  mensagem: 'SYNTH-crie uma tarefa para o Dr. Souza',
  deviceId: null,
}

describe('PedidoDeTurnoSchema', () => {
  it('aceita o corpo mínimo válido', () => {
    const resultado = PedidoDeTurnoSchema.safeParse(corpoValido)
    expect(resultado.success).toBe(true)
  })

  it('recusa corpo sem mensagem', () => {
    const resultado = PedidoDeTurnoSchema.safeParse({ deviceId: null })
    expect(resultado.success).toBe(false)
  })

  it('recusa corpo sem deviceId', () => {
    const resultado = PedidoDeTurnoSchema.safeParse({ mensagem: 'SYNTH-oi' })
    expect(resultado.success).toBe(false)
  })

  it('aceita deviceId nulo', () => {
    const resultado = PedidoDeTurnoSchema.safeParse(corpoValido)
    expect(resultado.success).toBe(true)
  })

  it('recusa deviceId vazio (string vazia não é "sem dispositivo")', () => {
    const resultado = PedidoDeTurnoSchema.safeParse({ ...corpoValido, deviceId: '' })
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

  it('recusa "requester" (a identidade agora vem da sessão, nunca do corpo)', () => {
    const resultado = PedidoDeTurnoSchema.safeParse({
      ...corpoValido,
      requester: { requesterUserId: 'SYNTH-user-forjado', deviceId: null },
    })
    expect(resultado.success).toBe(false)
  })
})

describe('montarRequester', () => {
  it('monta RequesterContext com o id da conta vindo da sessão, não do corpo', () => {
    const parsed = PedidoDeTurnoSchema.parse(corpoValido)
    const requester = montarRequester(parsed, 'conta-1', () => 'SYNTH-run-fixo')

    expect(requester).toEqual({
      requesterUserId: 'conta-1',
      deviceId: null,
      runId: 'SYNTH-run-fixo',
    })
  })

  it('produz um objeto que passa em RequesterContextSchema', async () => {
    const { RequesterContextSchema } = await import('@cora/contracts')
    const parsed = PedidoDeTurnoSchema.parse(corpoValido)
    const requester = montarRequester(parsed, 'conta-2', () => 'SYNTH-run-2')

    expect(RequesterContextSchema.safeParse(requester).success).toBe(true)
  })
})
