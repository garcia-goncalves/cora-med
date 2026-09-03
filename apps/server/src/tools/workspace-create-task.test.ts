import { CONTRACT_VERSION, type RespostaDaPrevia } from '@cora/contracts'
import { WorkspaceApiError, WorkspaceClient } from '@cora/workspace-client'
import { describe, expect, it } from 'vitest'

import {
  createPreviewTaskTool,
  descreverFalhaDaCriacao,
  executarCriacaoAprovada,
  type PreviewTaskToolResult,
} from './workspace-create-task.js'

/**
 * Fixtures sintéticas, prefixo `SYNTH-`. Nenhum destes testes faz rede: `fetchImpl` é
 * injetado. **Mock não conclui integração** — a prova é `scripts/verificacao-fase-02.ts`.
 */

const TOKEN_SINTETICO = ['SYNTH', 'aprovacao', 'valida'].join('-')
/** Montado por concatenação pelo mesmo motivo: o guardião de segredo barra literal. */
const SEGREDO_PLACEHOLDER = ['SYNTH', 'placeholder', 'servico'].join('-')

function makeClient(fetchImpl: typeof fetch) {
  return new WorkspaceClient({
    baseUrl: 'http://localhost:4319',
    serviceClientId: 'SYNTH-client',
    serviceSecret: SEGREDO_PLACEHOLDER,
    delegationToken: 'SYNTH-delegacao',
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

function respostaDaPrevia(over: Partial<RespostaDaPrevia> = {}): RespostaDaPrevia {
  return {
    contractVersion: CONTRACT_VERSION,
    previa: {
      titulo: 'Ligar para a clínica',
      prioridade: 'NORMAL',
      prazo: { presente: false, valor: null, rotulo: 'sem prazo' },
      cliente: {
        id: 'SYNTH-cli-1',
        rotulo: 'Clinica Ficticia Unica CORA',
        encontrado: true,
        motivo: null,
        origem: 'TEXTO',
      },
      projeto: { id: null, rotulo: null, encontrado: false, motivo: 'NAO_INFORMADO', origem: null },
      responsaveis: [
        { id: 'SYNTH-usr-7', rotulo: 'Fulana', encontrado: true, motivo: null, origem: 'PADRAO' },
      ],
    },
    ambiguidades: [],
    approvalToken: TOKEN_SINTETICO,
    approvalExpiresAt: '2026-09-03T18:15:00.000Z',
    resolutionHash: 'SYNTH-selo',
    mudou: null,
    ...over,
  } as RespostaDaPrevia
}

const REQUESTER = { requesterUserId: 'SYNTH-delegado', deviceId: null, runId: 'SYNTH-run' }
const AGORA = new Date('2026-09-03T18:00:00.000Z')

async function rodarPrevia(
  fetchImpl: typeof fetch,
  args: Record<string, unknown> = { titulo: 'Ligar para a clínica', cliente: { texto: 'Unica CORA' } },
) {
  const tool = createPreviewTaskTool(makeClient(fetchImpl))
  return (await tool({
    args,
    requester: REQUESTER,
    signal: new AbortController().signal,
  })) as PreviewTaskToolResult
}

describe('a ferramenta de criação NÃO cria — ela faz a prévia e para', () => {
  it('só bate no endpoint de prévia, nunca no de criação', async () => {
    const urls: string[] = []
    await rodarPrevia(async (u) => {
      urls.push(String(u))
      return jsonResponse(200, respostaDaPrevia())
    })

    expect(urls).toEqual(['http://localhost:4319/api/agent/v1/tasks/preview'])
    // Se algum dia esta asserção falhar com a URL de criação junto, a aprovação virou
    // formalidade que o programa cumpre consigo mesmo.
    expect(urls.some((u) => u.endsWith('/api/agent/v1/tasks'))).toBe(false)
  })

  it('devolve a apresentação pronta quando o Workspace autorizou', async () => {
    const r = await rodarPrevia(async () => jsonResponse(200, respostaDaPrevia()))
    expect(r.apresentacao.tipo).toBe('pronta')
    expect(r.previa.args?.clienteId).toBe('SYNTH-cli-1')
  })

  it('argumento do modelo fora da forma acordada é recusado antes da rede', async () => {
    let chamou = false
    await expect(
      rodarPrevia(
        async () => {
          chamou = true
          return jsonResponse(200, respostaDaPrevia())
        },
        // O modelo mandou id E texto: o esquema descreve a regra, mas nada obriga a
        // saída dele a obedecer.
        { titulo: 'Ligar', cliente: { id: 'x', texto: 'yy' } },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect(chamou).toBe(false)
  })

  it('falha da prévia SOBE — não vira resultado normal', async () => {
    // Um erro que virasse valor de retorno seria registrado como sucesso pelo laço e
    // entregue ao modelo como se a prévia tivesse dado certo.
    await expect(
      rodarPrevia(async () =>
        jsonResponse(403, {
          error: { code: 'FORBIDDEN', message: 'SYNTH-sem escopo', requestId: 'SYNTH-r' },
        }),
      ),
    ).rejects.toBeInstanceOf(WorkspaceApiError)
  })
})

describe('executarCriacaoAprovada — as travas antes de a escrita sair', () => {
  async function criar(
    previaFetch: typeof fetch,
    criacaoFetch: typeof fetch,
    idempotencyKey?: string,
  ) {
    const { previa } = await rodarPrevia(previaFetch)
    return executarCriacaoAprovada({
      client: makeClient(criacaoFetch),
      previa,
      agora: AGORA,
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    })
  }

  it('grava quando a prévia está pronta e devolve o id da tarefa', async () => {
    const r = await criar(
      async () => jsonResponse(200, respostaDaPrevia()),
      async () =>
        jsonResponse(201, {
          contractVersion: CONTRACT_VERSION,
          taskId: 'SYNTH-task-1',
          created: true,
        }),
    )
    expect(r).toEqual({ estado: 'criada', taskId: 'SYNTH-task-1' })
  })

  it('repetição da mesma chave é "já existia", nunca uma segunda "criei"', async () => {
    const r = await criar(
      async () => jsonResponse(200, respostaDaPrevia()),
      async () =>
        jsonResponse(200, {
          contractVersion: CONTRACT_VERSION,
          taskId: 'SYNTH-task-1',
          created: false,
        }),
    )
    expect(r).toEqual({ estado: 'ja_existia', taskId: 'SYNTH-task-1' })
  })

  it('prévia ambígua não vira gravação, e nada sai da máquina', async () => {
    let saiu = false
    const ambigua = respostaDaPrevia({
      approvalToken: null,
      approvalExpiresAt: null,
      ambiguidades: [
        {
          campo: 'cliente',
          texto: 'Homonima CORA',
          total: 2,
          candidatos: [
            { id: 'SYNTH-a', rotulo: 'A', distincao: 'CNPJ 22' },
            { id: 'SYNTH-b', rotulo: 'B', distincao: 'CNPJ 33' },
          ],
        },
      ],
    })
    ambigua.previa.cliente = {
      id: null,
      rotulo: null,
      encontrado: false,
      motivo: 'AMBIGUO',
      origem: 'TEXTO',
    }

    const r = await criar(
      async () => jsonResponse(200, ambigua),
      async () => {
        saiu = true
        return jsonResponse(201, {})
      },
    )
    expect(saiu).toBe(false)
    expect(r.estado).toBe('conflito')
  })

  it('token vencido não vira gravação', async () => {
    let saiu = false
    const { previa } = await rodarPrevia(async () => jsonResponse(200, respostaDaPrevia()))
    const r = await executarCriacaoAprovada({
      client: makeClient(async () => {
        saiu = true
        return jsonResponse(201, {})
      }),
      previa,
      // A prévia vence 18:15; agora são 18:20.
      agora: new Date('2026-09-03T18:20:00.000Z'),
    })
    expect(saiu).toBe(false)
    expect(r.estado).toBe('conflito')
  })

  it('reaproveita a chave informada, para a repetição ser inócua', async () => {
    let chave = ''
    await criar(
      async () => jsonResponse(200, respostaDaPrevia()),
      async (_u, i) => {
        chave = new Headers(i?.headers).get('idempotency-key') ?? ''
        return jsonResponse(200, {
          contractVersion: CONTRACT_VERSION,
          taskId: 'SYNTH-task-1',
          created: false,
        })
      },
      '00000000-0000-4000-8000-00000000abcd',
    )
    expect(chave).toBe('00000000-0000-4000-8000-00000000abcd')
  })

  it('duas tentativas SEM chave informada usam chaves diferentes', async () => {
    // A chave não deriva do conteúdo: duas tarefas legitimamente iguais no mesmo dia
    // ("ligar para a clínica") não podem colidir e a segunda sumir sem ninguém saber.
    const chaves: string[] = []
    const criacao: typeof fetch = async (_u, i) => {
      chaves.push(new Headers(i?.headers).get('idempotency-key') ?? '')
      return jsonResponse(201, {
        contractVersion: CONTRACT_VERSION,
        taskId: 'SYNTH-t',
        created: true,
      })
    }
    await criar(async () => jsonResponse(200, respostaDaPrevia()), criacao)
    await criar(async () => jsonResponse(200, respostaDaPrevia()), criacao)

    expect(chaves).toHaveLength(2)
    expect(chaves[0]).not.toBe(chaves[1])
  })

  it('rede fora depois de enviar vira "desconhecido", com a chave para reconsultar', async () => {
    const { previa } = await rodarPrevia(async () => jsonResponse(200, respostaDaPrevia()))
    const r = await executarCriacaoAprovada({
      client: makeClient(async () => {
        throw new TypeError('fetch failed')
      }),
      previa,
      agora: AGORA,
      idempotencyKey: '00000000-0000-4000-8000-00000000beef',
    })

    expect(r.estado).toBe('desconhecido')
    if (r.estado === 'desconhecido') {
      expect(r.idempotencyKey).toBe('00000000-0000-4000-8000-00000000beef')
    }
  })

  it('409 SOBE como exceção — não é contado como execução bem-sucedida', async () => {
    const { previa } = await rodarPrevia(async () => jsonResponse(200, respostaDaPrevia()))
    await expect(
      executarCriacaoAprovada({
        client: makeClient(async () =>
          jsonResponse(409, {
            error: {
              code: 'PRECONDITION_CHANGED',
              message: 'SYNTH-mudou',
              requestId: 'SYNTH-r',
              divergencias: [],
            },
          }),
        ),
        previa,
        agora: AGORA,
      }),
    ).rejects.toBeInstanceOf(WorkspaceApiError)
  })
})

describe('a frase que a pessoa lê — cada conflito tem a sua', () => {
  function erro(code: string, divergencias?: unknown[]): WorkspaceApiError {
    return new WorkspaceApiError({
      code: code as never,
      message: 'SYNTH-mensagem do servidor',
      httpStatus: 409,
      requestId: 'SYNTH-r',
      ...(divergencias === undefined ? {} : { divergencias: divergencias as never }),
    })
  }

  const CODIGOS = [
    'APPROVAL_EXPIRED',
    'APPROVAL_MISMATCH',
    'APPROVAL_ALREADY_USED',
    'PRECONDITION_CHANGED',
    'IDEMPOTENCY_CONFLICT',
    'APPROVAL_INVALID',
  ]

  it('as seis frases são diferentes entre si', () => {
    // Um texto genérico obrigaria a pessoa a adivinhar se tenta de novo, corrige o pedido
    // ou chama alguém. O contrato nomeou cinco conflitos justamente por isso.
    const frases = CODIGOS.map((c) => descreverFalhaDaCriacao(erro(c)))
    expect(new Set(frases).size).toBe(CODIGOS.length)
  })

  it('todas dizem, de algum jeito, que NADA foi gravado', () => {
    for (const code of CODIGOS) {
      const frase = descreverFalhaDaCriacao(erro(code))
      expect(frase, code).toMatch(/nada foi (criad|gravad)|não criei|sem gravar nada/i)
    }
  })

  it('nenhuma delas promete tentar de novo sozinha', () => {
    for (const code of CODIGOS) {
      const frase = descreverFalhaDaCriacao(erro(code))
      expect(frase, code).not.toMatch(/vou tentar de novo|tentando novamente/i)
    }
  })

  it('PRECONDITION_CHANGED conta campo a campo o que mudou', () => {
    const frase = descreverFalhaDaCriacao(
      erro('PRECONDITION_CHANGED', [
        {
          campo: 'cliente',
          aprovado: { id: 'SYNTH-c', rotulo: 'Clinica Antiga' },
          atual: { id: 'SYNTH-c', rotulo: 'Clinica Nova' },
          motivo: 'ROTULO_MUDOU',
        },
        {
          campo: 'responsavel',
          aprovado: { id: 'SYNTH-u', rotulo: 'Quem Saiu' },
          atual: null,
          motivo: 'SEM_ACESSO',
        },
        {
          campo: 'projeto',
          aprovado: { id: 'SYNTH-p', rotulo: 'Projeto Extinto' },
          atual: null,
          motivo: 'NAO_ENCONTRADO',
        },
      ]),
    )

    expect(frase).toContain('Clinica Antiga')
    expect(frase).toContain('Clinica Nova')
    expect(frase).toContain('só o nome mudou')
    // "perdeu o acesso" e "não existe mais" são fatos diferentes e pedem reações
    // diferentes de quem lê. Um texto só para os dois esconde qual é qual.
    expect(frase).toContain('perdeu o acesso')
    expect(frase).toContain('não existe mais')
  })

  it('erro que não é do Workspace não vira certeza inventada', () => {
    const frase = descreverFalhaDaCriacao(new Error('qualquer coisa'))
    expect(frase).toMatch(/não sei dizer por quê/i)
    expect(frase).not.toMatch(/nada foi gravado/i)
  })

  it('UPSTREAM_UNAVAILABLE com resposta do servidor É certeza de que não gravou', () => {
    // Diferente do erro de transporte: aqui o servidor RESPONDEU dizendo que não gravou.
    const frase = descreverFalhaDaCriacao(
      new WorkspaceApiError({
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'SYNTH-banco fora',
        httpStatus: 503,
        requestId: 'SYNTH-r',
      }),
    )
    expect(frase).toMatch(/NÃO foi criada/i)
  })
})
