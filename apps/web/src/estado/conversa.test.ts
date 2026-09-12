import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  type AcaoDaConversa,
  type EstadoDaConversa,
  estadoInicialDaConversa,
  reduzirConversa,
} from './conversa.js'

function aplicar(acoes: readonly AcaoDaConversa[]): EstadoDaConversa {
  return acoes.reduce(reduzirConversa, estadoInicialDaConversa)
}

describe('reduzirConversa', () => {
  it('enviar entra otimista, como enviando, e limpa o rascunho', () => {
    const estado = reduzirConversa(
      { ...estadoInicialDaConversa, rascunho: 'oi' },
      { tipo: 'enviar', id: 'm1', texto: 'oi' },
    )
    expect(estado.mensagens).toEqual([
      { id: 'm1', autor: 'pessoa', texto: 'oi', situacao: 'enviando' },
    ])
    expect(estado.rascunho).toBe('')
  })

  it('confirmar vira enviada e a resposta da Cora entra como recebida', () => {
    const estado = aplicar([
      { tipo: 'enviar', id: 'm1', texto: 'oi' },
      {
        tipo: 'confirmar',
        idDaMensagemEnviada: 'm1',
        resposta: { id: 'm2', texto: 'Olá!' },
      },
    ])
    expect(estado.mensagens).toEqual([
      { id: 'm1', autor: 'pessoa', texto: 'oi', situacao: 'enviada' },
      { id: 'm2', autor: 'cora', texto: 'Olá!', situacao: 'recebida' },
    ])
  })

  it('confirmar carrega o estado do resumo quando o turno trouxe um', () => {
    const estado = aplicar([
      { tipo: 'enviar', id: 'm1', texto: 'como estão minhas pendências?' },
      {
        tipo: 'confirmar',
        idDaMensagemEnviada: 'm1',
        resposta: { id: 'm2', texto: 'Você tem 3 pendências.', estadoDoResumo: 'com_pendencias' },
      },
    ])
    expect(estado.mensagens[1]?.estadoDoResumo).toBe('com_pendencias')
  })

  it('mensagem que falhou continua na lista', () => {
    const estado = aplicar([
      { tipo: 'enviar', id: 'm1', texto: 'oi' },
      { tipo: 'falhar', id: 'm1' },
    ])
    expect(estado.mensagens).toEqual([
      { id: 'm1', autor: 'pessoa', texto: 'oi', situacao: 'falhou' },
    ])
  })

  it('reenviar reaproveita o texto', () => {
    const estado = aplicar([
      { tipo: 'enviar', id: 'm1', texto: 'texto original' },
      { tipo: 'falhar', id: 'm1' },
      { tipo: 'reenviar', id: 'm1' },
    ])
    expect(estado.mensagens).toEqual([
      { id: 'm1', autor: 'pessoa', texto: 'texto original', situacao: 'enviando' },
    ])
  })

  it('rascunho atual não é limpo por falha anterior', () => {
    const comFalha = aplicar([
      { tipo: 'enviar', id: 'm1', texto: 'primeira mensagem' },
      { tipo: 'falhar', id: 'm1' },
    ])
    const estado = reduzirConversa(comFalha, {
      tipo: 'digitar_rascunho',
      texto: 'já estou digitando a próxima',
    })
    expect(estado.rascunho).toBe('já estou digitando a próxima')

    // A falha em si, sozinha, também não mexe no rascunho.
    const comRascunho: EstadoDaConversa = { ...comFalha, rascunho: 'rascunho intocado' }
    const depoisDeOutraFalha = reduzirConversa(comRascunho, { tipo: 'falhar', id: 'm1' })
    expect(depoisDeOutraFalha.rascunho).toBe('rascunho intocado')
  })

  it('cinco rótulos de estado distintos', () => {
    // Molde: apps/server/src/tools/workspace-create-task.test.ts:378-383.
    const ROTULOS = [
      'com_pendencias',
      'sem_pendencias',
      'sincronizacao_incompleta',
      'erro_de_acesso',
      'sem_registros',
    ] as const
    expect(new Set(ROTULOS).size).toBe(ROTULOS.length)
  })

  it('os cinco rótulos batem com os estados nomeados em apps/server/src/inbox/resumo.ts', () => {
    // A tela não inventa estado e não funde dois deles: os literais aqui precisam
    // continuar aparecendo, ao pé da letra, no arquivo do servidor que é a fonte deles.
    const caminhoDoResumo = fileURLToPath(
      new URL('../../../server/src/inbox/resumo.ts', import.meta.url),
    )
    const fonte = readFileSync(caminhoDoResumo, 'utf8')
    const ROTULOS = [
      'com_pendencias',
      'sem_pendencias',
      'sincronizacao_incompleta',
      'erro_de_acesso',
      'sem_registros',
    ] as const
    for (const rotulo of ROTULOS) {
      expect(fonte, rotulo).toContain(`'${rotulo}'`)
    }
  })
})
