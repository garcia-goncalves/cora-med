import { describe, expect, it } from 'vitest'

import {
  MotivoDeRecusaDeEntradaSchema,
  PedidoDeEntradaSchema,
  RespostaDeEntradaSchema,
  SessaoDoUsuarioSchema,
} from './auth.js'

describe('PedidoDeEntradaSchema', () => {
  it('aceita o caso feliz', () => {
    const pedido = { email: 'thais@medconsultoria.example', senha: 'SYNTH-senha-de-teste' }
    expect(PedidoDeEntradaSchema.safeParse(pedido).success).toBe(true)
  })

  it('recusa campo extra', () => {
    const pedido = {
      email: 'thais@medconsultoria.example',
      senha: 'SYNTH-senha-de-teste',
      requesterUserId: 'conta-1',
    }
    expect(PedidoDeEntradaSchema.safeParse(pedido).success).toBe(false)
  })

  it('recusa e-mail malformado', () => {
    const pedido = { email: 'não-é-email', senha: 'SYNTH-senha-de-teste' }
    expect(PedidoDeEntradaSchema.safeParse(pedido).success).toBe(false)
  })

  it('recusa senha vazia', () => {
    const pedido = { email: 'thais@medconsultoria.example', senha: '' }
    expect(PedidoDeEntradaSchema.safeParse(pedido).success).toBe(false)
  })
})

describe('SessaoDoUsuarioSchema', () => {
  it('aceita o caso feliz e não carrega nenhum campo de segredo', () => {
    const sessao = {
      idDaConta: 'conta-1',
      nome: 'Thaís',
      email: 'thais@medconsultoria.example',
    }
    expect(SessaoDoUsuarioSchema.safeParse(sessao).success).toBe(true)
  })

  it('recusa campo extra — é aqui que um token de delegação vazado seria pego', () => {
    const sessao = {
      idDaConta: 'conta-1',
      nome: 'Thaís',
      email: 'thais@medconsultoria.example',
      delegationToken: 'SYNTH-token',
    }
    expect(SessaoDoUsuarioSchema.safeParse(sessao).success).toBe(false)
  })
})

describe('RespostaDeEntradaSchema', () => {
  it('aceita o envelope com a sessão', () => {
    const resposta = {
      sessao: { idDaConta: 'conta-1', nome: 'Thaís', email: 'thais@medconsultoria.example' },
    }
    expect(RespostaDeEntradaSchema.safeParse(resposta).success).toBe(true)
  })
})

describe('MotivoDeRecusaDeEntradaSchema', () => {
  it('tem exatamente dois motivos de recusa, e são distintos entre si', () => {
    const motivos = MotivoDeRecusaDeEntradaSchema.options
    expect(motivos).toHaveLength(2)
    expect(new Set(motivos).size).toBe(2)
  })

  it('não aceita motivo fora da união fechada — a tela nunca aprende se o e-mail existe', () => {
    expect(MotivoDeRecusaDeEntradaSchema.safeParse('email_nao_encontrado').success).toBe(false)
  })
})
