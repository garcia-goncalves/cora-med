import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { WorkspaceApiError } from '@cora/workspace-client'
import { MotorError } from '../engine/port.js'
import {
  STATUS_POR_CATEGORIA,
  descreverParaLog,
  erroDeCategoria,
  traduzirFalha,
  type CategoriaDeErro,
} from './erros.js'

describe('traduzirFalha', () => {
  it('MotorError vira falha_do_motor sem repassar a mensagem original', () => {
    const cause = new MotorError(
      'A chamada ao modelo falhou: sk-ant-SYNTH-nao-e-chave e o texto do paciente',
      'anthropic',
    )
    const resultado = traduzirFalha(cause)

    expect(resultado.status).toBe(502)
    expect(resultado.corpo.erro.categoria).toBe('falha_do_motor')
    const serializado = JSON.stringify(resultado.corpo)
    expect(serializado).not.toContain('sk-ant')
    expect(serializado).not.toContain('paciente')
    expect(serializado).not.toContain('A chamada ao modelo falhou')
  })

  it('WorkspaceApiError vira falha_do_workspace sem repassar a mensagem original', () => {
    const cause = new WorkspaceApiError({
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'SYNTH-conteudo-sensivel do corpo da requisição',
      httpStatus: 503,
      requestId: 'SYNTH-req-1',
    })
    const resultado = traduzirFalha(cause)

    expect(resultado.status).toBe(502)
    expect(resultado.corpo.erro.categoria).toBe('falha_do_workspace')
    const serializado = JSON.stringify(resultado.corpo)
    expect(serializado).not.toContain('SYNTH-conteudo-sensivel')
    expect(serializado).toContain('UPSTREAM_UNAVAILABLE')
  })

  it('ZodError vira corpo_invalido com os caminhos dos campos, nunca o valor rejeitado', () => {
    const SchemaLocal = z.object({ requester: z.object({ nome: z.number() }) })
    const parsed = SchemaLocal.safeParse({ requester: { nome: 'SYNTH-valor-secreto-do-teste' } })
    if (parsed.success) throw new Error('fixture do teste deveria falhar o parse')

    const resultado = traduzirFalha(parsed.error)

    expect(resultado.status).toBe(422)
    expect(resultado.corpo.erro.categoria).toBe('corpo_invalido')
    expect(resultado.corpo.erro.campos).toContain('requester.nome')
    expect(JSON.stringify(resultado.corpo)).not.toContain('SYNTH-valor-secreto-do-teste')
  })

  it('erro cru vira falha_interna com mensagem genérica', () => {
    const resultado = traduzirFalha(new Error('boom'))

    expect(resultado.status).toBe(500)
    expect(resultado.corpo.erro.categoria).toBe('falha_interna')
    expect(JSON.stringify(resultado.corpo)).not.toContain('boom')
  })

  it('valor que não é nem Error vira falha_interna sem lançar', () => {
    const resultado = traduzirFalha('SYNTH-string-crua-lancada')
    expect(resultado.status).toBe(500)
    expect(resultado.corpo.erro.categoria).toBe('falha_interna')
  })
})

describe('host_nao_permitido', () => {
  it('está no mapa de status como 400', () => {
    expect(STATUS_POR_CATEGORIA.host_nao_permitido).toBe(400)
  })
})

describe('erroDeCategoria', () => {
  it('toda categoria tem status mapeado', () => {
    const categorias = Object.keys(STATUS_POR_CATEGORIA) as CategoriaDeErro[]
    expect(categorias.length).toBeGreaterThan(0)
    for (const categoria of categorias) {
      const resultado = erroDeCategoria(categoria)
      expect(typeof resultado.status).toBe('number')
      expect(resultado.status).toBeGreaterThanOrEqual(400)
      expect(resultado.corpo.erro.categoria).toBe(categoria)
    }
  })

  it('aceita mensagem e campos customizados', () => {
    const resultado = erroDeCategoria('corpo_invalido', 'texto customizado', ['a.b'])
    expect(resultado.corpo.erro.mensagem).toBe('texto customizado')
    expect(resultado.corpo.erro.campos).toEqual(['a.b'])
  })
})

describe('descreverParaLog', () => {
  it('preserva a mensagem original — é o único lugar que pode', () => {
    const cause = new MotorError('SYNTH-detalhe-que-so-pode-ir-para-o-log', 'anthropic')
    expect(descreverParaLog(cause)).toContain('SYNTH-detalhe-que-so-pode-ir-para-o-log')
  })
})
