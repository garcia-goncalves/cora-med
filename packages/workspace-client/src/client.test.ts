import { CONTRACT_VERSION, fixtures } from '@cora/contracts'
import { describe, expect, it } from 'vitest'

import { WorkspaceClient } from './client.js'
import { ContractViolationError, WorkspaceApiError } from './errors.js'
import { collectAllTasks } from './pagination.js'

/**
 * TESTES LOCAIS COM FIXTURES SINTÉTICAS.
 *
 * Nenhum destes testes faz rede: `fetchImpl` é injetado. Eles provam o comportamento do
 * CLIENTE, não a integração com o Workspace — essa depende do ticket CORA-001 e será
 * feita por HTTP real, com evidência própria.
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

describe('WorkspaceClient.listTasks — caminho feliz', () => {
  it('valida a resposta contra o contrato e devolve as tarefas', async () => {
    const client = makeClient(async () => jsonResponse(200, fixtures.respostaComDuasTarefas))
    const page = await client.listTasks({ scope: 'mine', status: 'open', limit: 20 })

    expect(page.items).toHaveLength(2)
    expect(page.items[0]?.id).toBe('SYNTH-task-001')
    expect(page.nextCursor).toBeNull()
  })

  it('monta a URL e os headers acordados', async () => {
    let capturedUrl = ''
    let capturedHeaders: Headers | undefined
    const client = makeClient(async (url, init) => {
      capturedUrl = String(url)
      capturedHeaders = new Headers(init?.headers)
      return jsonResponse(200, fixtures.respostaVazia)
    })

    await client.listTasks({ scope: 'mine', status: 'open', limit: 5, cursor: 'SYNTH-cursor' })

    expect(capturedUrl).toBe(
      'http://localhost:3000/api/agent/v1/tasks?scope=mine&status=open&limit=5&cursor=SYNTH-cursor',
    )
    expect(capturedHeaders?.get('x-request-id')).toBe('SYNTH-request-id')
    // As DUAS metades da credencial, conforme o contrato.
    expect(capturedHeaders?.get('x-agent-client')).toBe('SYNTH-placeholder-client')
    expect(capturedHeaders?.get('x-agent-secret')).toBe('SYNTH-placeholder-service')
    expect(capturedHeaders?.get('authorization')).toBe('Bearer SYNTH-placeholder-delegation')
  })

  it('usa limit 20 quando ele não é informado', async () => {
    let capturedUrl = ''
    const client = makeClient(async (url) => {
      capturedUrl = String(url)
      return jsonResponse(200, fixtures.respostaVazia)
    })
    await client.listTasks({ scope: 'mine', status: 'open' } as never)
    expect(capturedUrl).toContain('limit=20')
  })
})

describe('WorkspaceClient.listTasks — parâmetros inválidos não viram requisição', () => {
  it.each([
    ['limit 0', { scope: 'mine', status: 'open', limit: 0 }],
    ['limit 101', { scope: 'mine', status: 'open', limit: 101 }],
    ['limit fracionário', { scope: 'mine', status: 'open', limit: 1.5 }],
    ['scope diferente de mine', { scope: 'all', status: 'open', limit: 20 }],
    ['status diferente de open', { scope: 'mine', status: 'qualquer', limit: 20 }],
  ])('%s → INVALID_INPUT sem chamar a rede', async (_nome, params) => {
    let chamou = false
    const client = makeClient(async () => {
      chamou = true
      return jsonResponse(200, fixtures.respostaVazia)
    })

    await expect(client.listTasks(params as never)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
    expect(chamou).toBe(false)
  })
})

describe('WorkspaceClient.listTasks — erros do Workspace', () => {
  it.each([
    [401, 'UNAUTHENTICATED'],
    [401, 'DELEGATION_EXPIRED'],
    [403, 'FORBIDDEN'],
    [429, 'RATE_LIMITED'],
    [503, 'UPSTREAM_UNAVAILABLE'],
  ])('HTTP %i com code %s vira WorkspaceApiError', async (status, code) => {
    const client = makeClient(async () =>
      jsonResponse(status, {
        error: { code, message: 'mensagem sintética', requestId: 'SYNTH-req' },
      }),
    )

    const erro = await client
      .listTasks({ scope: 'mine', status: 'open', limit: 20 })
      .catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(WorkspaceApiError)
    expect((erro as WorkspaceApiError).code).toBe(code)
    expect((erro as WorkspaceApiError).requestId).toBe('SYNTH-req')
  })

  it('401 exige reautenticação e não é transitório', async () => {
    const client = makeClient(async () =>
      jsonResponse(401, { error: { code: 'DELEGATION_EXPIRED', message: 'expirou' } }),
    )
    const erro = (await client
      .listTasks({ scope: 'mine', status: 'open', limit: 20 })
      .catch((e: unknown) => e)) as WorkspaceApiError

    expect(erro.requiresReauth).toBe(true)
    expect(erro.transient).toBe(false)
  })

  it('erro sem corpo padronizado é decidido pelo status HTTP', async () => {
    const client = makeClient(async () => jsonResponse(502, { qualquer: 'coisa do proxy' }))
    const erro = (await client
      .listTasks({ scope: 'mine', status: 'open', limit: 20 })
      .catch((e: unknown) => e)) as WorkspaceApiError

    expect(erro.code).toBe('UPSTREAM_UNAVAILABLE')
  })

  it('INDISPONIBILIDADE NUNCA VIRA LISTA VAZIA: 503 lança, não devolve items:[]', async () => {
    const client = makeClient(async () =>
      jsonResponse(503, { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'banco fora' } }),
    )
    await expect(client.listTasks({ scope: 'mine', status: 'open', limit: 20 })).rejects.toThrow()
  })

  it('falha de rede vira UPSTREAM_UNAVAILABLE, não lista vazia', async () => {
    const client = makeClient(async () => {
      throw new TypeError('fetch failed')
    })
    const erro = (await client
      .listTasks({ scope: 'mine', status: 'open', limit: 20 })
      .catch((e: unknown) => e)) as WorkspaceApiError

    expect(erro.code).toBe('UPSTREAM_UNAVAILABLE')
  })
})

describe('WorkspaceClient.listTasks — cancelamento externo', () => {
  it('signal já abortado impede a requisição de sair', async () => {
    const controller = new AbortController()
    controller.abort()
    const client = makeClient(async (_url, init) => {
      // O fetch recebe um signal já abortado; simulamos o que o runtime faz.
      if (init?.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
      return jsonResponse(200, fixtures.respostaVazia)
    })

    const erro = (await client
      .listTasks({ scope: 'mine', status: 'open', limit: 20 }, { signal: controller.signal })
      .catch((e: unknown) => e)) as WorkspaceApiError

    expect(erro.code).toBe('UPSTREAM_UNAVAILABLE')
    expect(erro.message).toMatch(/cancelada/i)
  })

  it('cancelamento durante a requisição aborta o fetch', async () => {
    const controller = new AbortController()
    const client = makeClient(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          )
          setTimeout(() => controller.abort(), 5)
        }),
    )

    const erro = (await client
      .listTasks({ scope: 'mine', status: 'open', limit: 20 }, { signal: controller.signal })
      .catch((e: unknown) => e)) as WorkspaceApiError

    expect(erro.message).toMatch(/cancelada/i)
  })

  it('timeout continua sendo relatado como timeout, não como cancelamento', async () => {
    const client = new WorkspaceClient({
      baseUrl: 'http://localhost:3000',
      serviceClientId: 'SYNTH-placeholder-client',
      serviceSecret: 'SYNTH-placeholder-service',
      delegationToken: 'SYNTH-placeholder-delegation',
      timeoutMs: 5,
      requestIdFactory: () => 'SYNTH-request-id',
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          )
        }),
    })

    const erro = (await client
      .listTasks({ scope: 'mine', status: 'open', limit: 20 })
      .catch((e: unknown) => e)) as WorkspaceApiError

    expect(erro.message).toMatch(/não respondeu em 5ms/i)
  })
})

describe('WorkspaceClient.listTasks — resposta fora do contrato', () => {
  it('status desconhecido é recusado', async () => {
    const client = makeClient(async () =>
      jsonResponse(200, {
        contractVersion: CONTRACT_VERSION,
        items: [{ ...fixtures.tarefaDeA, status: 'ARQUIVADA' }],
        nextCursor: null,
      }),
    )
    await expect(
      client.listTasks({ scope: 'mine', status: 'open', limit: 20 }),
    ).rejects.toBeInstanceOf(ContractViolationError)
  })

  it('campo obrigatório faltando é recusado', async () => {
    const { title: _title, ...semTitulo } = fixtures.tarefaDeA
    const client = makeClient(async () =>
      jsonResponse(200, { contractVersion: CONTRACT_VERSION, items: [semTitulo], nextCursor: null }),
    )
    await expect(
      client.listTasks({ scope: 'mine', status: 'open', limit: 20 }),
    ).rejects.toBeInstanceOf(ContractViolationError)
  })

  it('contractVersion diferente da fixada é recusada', async () => {
    const client = makeClient(async () =>
      jsonResponse(200, { ...fixtures.respostaVazia, contractVersion: '9.9.9' }),
    )
    await expect(
      client.listTasks({ scope: 'mine', status: 'open', limit: 20 }),
    ).rejects.toBeInstanceOf(ContractViolationError)
  })

  it('corpo que não é JSON é recusado', async () => {
    const client = makeClient(async () => new Response('<html>erro do proxy</html>', { status: 200 }))
    await expect(
      client.listTasks({ scope: 'mine', status: 'open', limit: 20 }),
    ).rejects.toBeInstanceOf(ContractViolationError)
  })
})

describe('paginação', () => {
  it('percorre 25 tarefas em páginas de 10 sem duplicar nem omitir', async () => {
    const todas = fixtures.tarefasSinteticas(25)
    const client = makeClient(async (url) => {
      const cursor = new URL(String(url)).searchParams.get('cursor')
      const inicio = cursor === null ? 0 : Number(cursor)
      const pagina = todas.slice(inicio, inicio + 10)
      const proximo = inicio + 10 < todas.length ? String(inicio + 10) : null
      return jsonResponse(200, {
        contractVersion: CONTRACT_VERSION,
        items: pagina,
        nextCursor: proximo,
      })
    })

    const { tasks, pages } = await collectAllTasks(client, { limit: 10 })

    expect(pages).toBe(3)
    expect(tasks).toHaveLength(25)
    expect(new Set(tasks.map((t) => t.id)).size).toBe(25)
    expect(tasks.map((t) => t.id)).toEqual(todas.map((t) => t.id))
  })

  it('cursor recusado no meio da listagem faz RECOMEÇAR, não falhar', async () => {
    // Contrato §8.2: o cursor é assinado e preso à pessoa; trocar o segredo de
    // sessão do Workspace invalida os cursores em voo. Isso não é defeito — é recomeço.
    const todas = fixtures.tarefasSinteticas(15)
    let jaRecusou = false
    const client = makeClient(async (url) => {
      const cursor = new URL(String(url)).searchParams.get('cursor')
      if (cursor !== null && !jaRecusou) {
        jaRecusou = true
        return jsonResponse(400, {
          error: { code: 'INVALID_INPUT', message: 'cursor inválido', requestId: 'SYNTH-req' },
        })
      }
      const inicio = cursor === null ? 0 : Number(cursor)
      const pagina = todas.slice(inicio, inicio + 10)
      return jsonResponse(200, {
        contractVersion: CONTRACT_VERSION,
        items: pagina,
        nextCursor: inicio + 10 < todas.length ? String(inicio + 10) : null,
      })
    })

    const { tasks } = await collectAllTasks(client, { limit: 10 })

    expect(jaRecusou).toBe(true)
    expect(tasks).toHaveLength(15)
    expect(new Set(tasks.map((t) => t.id)).size).toBe(15)
  })

  it('cursor recusado DUAS vezes desiste, em vez de girar para sempre', async () => {
    const client = makeClient(async (url) => {
      const cursor = new URL(String(url)).searchParams.get('cursor')
      if (cursor !== null) {
        return jsonResponse(400, {
          error: { code: 'INVALID_INPUT', message: 'cursor inválido', requestId: 'SYNTH-req' },
        })
      }
      return jsonResponse(200, {
        contractVersion: CONTRACT_VERSION,
        items: fixtures.tarefasSinteticas(10),
        nextCursor: 'p2',
      })
    })

    await expect(collectAllTasks(client, { limit: 10 })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
  })

  it('id repetido entre páginas é violação de contrato, não lista inflada', async () => {
    const client = makeClient(async (url) => {
      const cursor = new URL(String(url)).searchParams.get('cursor')
      return jsonResponse(200, {
        contractVersion: CONTRACT_VERSION,
        items: [fixtures.tarefaDeA],
        nextCursor: cursor === null ? 'p2' : null,
      })
    })

    await expect(collectAllTasks(client, { limit: 10 })).rejects.toBeInstanceOf(
      ContractViolationError,
    )
  })

  it('cursor que se repete para o laço em vez de girar para sempre', async () => {
    const client = makeClient(async () =>
      jsonResponse(200, {
        contractVersion: CONTRACT_VERSION,
        items: [],
        nextCursor: 'sempre-o-mesmo',
      }),
    )
    const erro = (await collectAllTasks(client, { limit: 10 }).catch(
      (e: unknown) => e,
    )) as ContractViolationError
    expect(erro).toBeInstanceOf(ContractViolationError)
    expect(erro.details).toMatch(/laço|páginas/)
  })
})
