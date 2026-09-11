import { fixtures } from '@cora/contracts'
import { WorkspaceClient } from '@cora/workspace-client'
import { describe, expect, it } from 'vitest'

import { esquemaDe, montarFerramentas, nomesComEsquema } from '../engine/tool-schemas.js'
import { FilaDeEntrada } from '../inbox/fila.js'
import { ToolRegistry } from './registry.js'
import { createInboxSummaryTool, type InboxSummaryToolResult } from './workspace-inbox.js'

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

const REQUESTER = { requesterUserId: 'SYNTH-delegado', deviceId: null, runId: 'SYNTH-run' }

describe('workspace.inbox.resumo — catálogo, registro e esquema', () => {
  it('o registro aceita a ferramenta', () => {
    const client = makeClient(async () => jsonResponse(200, fixtures.respostaVazia))
    const registry = new ToolRegistry().register(
      'workspace.inbox.resumo',
      createInboxSummaryTool(client, new FilaDeEntrada()),
    )
    expect(registry.get('workspace.inbox.resumo')).toBeDefined()
  })

  it('montarFerramentas com esse nome não estoura e usa a descrição do catálogo', () => {
    const [ferramenta] = montarFerramentas(['workspace.inbox.resumo'])
    expect(ferramenta?.name).toBe('workspace.inbox.resumo')
    expect(ferramenta?.description).toBe(
      'Resumir o que está pendente para você, dizendo de onde veio cada item',
    )
  })

  it('o esquema não oferece argumento nenhum', () => {
    expect(nomesComEsquema()).toContain('workspace.inbox.resumo')
    const esquema = esquemaDe('workspace.inbox.resumo')
    expect(esquema?.properties).toEqual({})
    expect(esquema?.required).toEqual([])
    expect(esquema?.additionalProperties).toBe(false)
  })
})

describe('workspace.inbox.resumo — o handler', () => {
  it('caminho feliz com pendência: outcome ok e resumo com_pendencias', async () => {
    const client = makeClient(async () => jsonResponse(200, fixtures.respostaComDuasTarefas))
    const tool = createInboxSummaryTool(client, new FilaDeEntrada())

    const resultado = (await tool({
      args: {},
      requester: REQUESTER,
      signal: new AbortController().signal,
    })) as InboxSummaryToolResult

    expect(resultado.outcome).toBe('ok')
    expect(resultado.resumo.estado).toBe('com_pendencias')
  })

  it('403 devolve resumo em erro_de_acesso, e a frase não diz que está sem pendências', async () => {
    const client = makeClient(async () =>
      jsonResponse(403, { error: { code: 'FORBIDDEN', message: 'sem acesso' } }),
    )
    const tool = createInboxSummaryTool(client, new FilaDeEntrada())

    const resultado = (await tool({
      args: {},
      requester: REQUESTER,
      signal: new AbortController().signal,
    })) as InboxSummaryToolResult

    expect(resultado.outcome).toBe('ok')
    expect(resultado.resumo.estado).toBe('erro_de_acesso')
    if (resultado.resumo.estado === 'erro_de_acesso') {
      const falha = resultado.resumo.fontes.find((f) => f.estado === 'falhou')
      expect(falha).toBeDefined()
    }
  })

  it('duas chamadas seguidas não duplicam a fila', async () => {
    const client = makeClient(async () => jsonResponse(200, fixtures.respostaComDuasTarefas))
    const fila = new FilaDeEntrada()
    const tool = createInboxSummaryTool(client, fila)

    await tool({ args: {}, requester: REQUESTER, signal: new AbortController().signal })
    await tool({ args: {}, requester: REQUESTER, signal: new AbortController().signal })

    expect(fila.tamanho()).toBe(2)
  })
})
