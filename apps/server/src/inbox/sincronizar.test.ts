import { fixtures } from '@cora/contracts'
import { WorkspaceClient } from '@cora/workspace-client'
import { describe, expect, it } from 'vitest'

import { FilaDeEntrada } from './fila.js'
import { sincronizarTarefas } from './sincronizar.js'

/**
 * TESTES LOCAIS COM FIXTURES SINTÉTICAS — `fetchImpl` injetado, ZERO rede. Mesmo padrão de
 * `packages/workspace-client/src/client.test.ts:16-32`.
 */

function makeClient(fetchImpl: typeof fetch) {
  return new WorkspaceClient({
    baseUrl: 'http://localhost:3000',
    serviceClientId: 'SYNTH-placeholder-client',
    serviceSecret: 'SYNTH-placeholder-service',
    delegationToken: 'SYNTH-placeholder-delegation',
    fetchImpl,
    requestIdFactory: () => 'SYNTH-request-id',
  })
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('sincronizarTarefas', () => {
  it('duas tarefas entram como dois itens, com a fonte marcada', async () => {
    const client = makeClient(async () => jsonResponse(200, fixtures.respostaComDuasTarefas))
    const fila = new FilaDeEntrada()

    const resultado = await sincronizarTarefas({ client, fila })

    expect(resultado).toMatchObject({ fonte: 'workspace:tasks', estado: 'completa', itensVistos: 2 })
    expect(fila.tamanho()).toBe(2)
    expect(fila.itens().every((item) => item.fonte === 'workspace:tasks')).toBe(true)
  })

  it('sincronizar duas vezes a mesma resposta não duplica a fila', async () => {
    const client = makeClient(async () => jsonResponse(200, fixtures.respostaComDuasTarefas))
    const fila = new FilaDeEntrada()

    await sincronizarTarefas({ client, fila })
    await sincronizarTarefas({ client, fila })

    expect(fila.tamanho()).toBe(2)
  })

  it('teto de páginas vira fonte parcial, e os itens que deu para ver entram na fila', async () => {
    const tarefas = fixtures.tarefasSinteticas(3)
    let chamada = 0
    const client = makeClient(async () => {
      const tarefa = tarefas[chamada]
      chamada += 1
      return jsonResponse(200, {
        contractVersion: fixtures.respostaVazia.contractVersion,
        items: tarefa === undefined ? [] : [tarefa],
        nextCursor: `SYNTH-cursor-${chamada}`,
      })
    })
    const fila = new FilaDeEntrada()

    const resultado = await sincronizarTarefas({ client, fila, maxPages: 2 })

    expect(resultado).toMatchObject({
      fonte: 'workspace:tasks',
      estado: 'parcial',
      motivo: 'teto_de_paginas',
      itensVistos: 2,
      paginas: 2,
    })
    expect(fila.tamanho()).toBe(2)
  })

  it('403 vira fonte falhou, com a frase de describeListTasksFailure, e a fila continua vazia', async () => {
    const client = makeClient(async () =>
      jsonResponse(403, { error: { code: 'FORBIDDEN', message: 'sem acesso' } }),
    )
    const fila = new FilaDeEntrada()

    const resultado = await sincronizarTarefas({ client, fila })

    expect(resultado.estado).toBe('falhou')
    expect(resultado).toMatchObject({
      fonte: 'workspace:tasks',
      estado: 'falhou',
      frase: expect.stringContaining('FORBIDDEN'),
    })
    expect(fila.tamanho()).toBe(0)
  })

  it('sincronização completa que perdeu um item tira esse item da fila', async () => {
    // Tarefa concluída, apagada ou fora de escopo some do Workspace de uma sincronização
    // completa para a próxima — a fila tem de refletir isso, não continuar arrastando o
    // item velho para sempre.
    const tarefas = fixtures.tarefasSinteticas(2)
    let chamada = 0
    const client = makeClient(async () => {
      chamada += 1
      const restantes = chamada === 1 ? tarefas : tarefas.slice(0, 1)
      return jsonResponse(200, {
        contractVersion: fixtures.respostaVazia.contractVersion,
        items: restantes,
        nextCursor: null,
      })
    })
    const fila = new FilaDeEntrada()

    await sincronizarTarefas({ client, fila })
    expect(fila.tamanho()).toBe(2)

    await sincronizarTarefas({ client, fila })
    expect(fila.tamanho()).toBe(1)
    expect(fila.itens()[0]?.identificadorDoWorkspace).toBe(tarefas[0]?.id)
  })

  it('o vistoEm não entra na chave de dedup: agora diferente continua dando um item só', async () => {
    const client = makeClient(async () => jsonResponse(200, fixtures.respostaComDuasTarefas))
    const fila = new FilaDeEntrada()

    await sincronizarTarefas({ client, fila, agora: () => new Date('2026-01-01T00:00:00Z') })
    await sincronizarTarefas({ client, fila, agora: () => new Date('2026-06-01T00:00:00Z') })

    expect(fila.tamanho()).toBe(2)
  })
})
