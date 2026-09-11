import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONTRACT_VERSION, type RequesterContext } from '@cora/contracts'
import { WorkspaceApiError, WorkspaceClient } from '@cora/workspace-client'
import { criarServidorHttp, type DependenciasHttp } from './server.js'
import { ToolRegistry } from '../tools/registry.js'
import { createListTasksTool } from '../tools/workspace-tasks.js'
import { ScriptedMotor } from '../engine/scripted.js'
import { MotorError } from '../engine/port.js'
import { criarMotorPorTurno, type AnthropicMessagesApi } from '../engine/anthropic-adapter.js'
import { ArmazemDeSessoes } from '../auth/sessao.js'
import { NOME_COOKIE_SESSAO } from '../auth/cookie.js'

/** `Response.json()` tipa como `unknown` nesta configuração (sem lib DOM). Teste confia no formato. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function jsonDe(resposta: Response): Promise<any> {
  return resposta.json()
}

let servidorAtivo: import('node:http').Server | undefined

async function subirServidor(deps: DependenciasHttp) {
  const server = criarServidorHttp(deps)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  servidorAtivo = server
  const { port } = server.address() as AddressInfo
  return { server, base: `http://127.0.0.1:${port}`, port }
}

afterEach(async () => {
  if (servidorAtivo) {
    await new Promise<void>((resolve) => servidorAtivo!.close(() => resolve()))
    servidorAtivo = undefined
  }
})

const corpoValido = {
  mensagem: 'SYNTH-crie uma tarefa para o Dr. Souza',
  deviceId: null,
}

// A partir da Etapa 10 da Fase 4, `POST /turno` exige sessão: quem conversa é sempre a
// pessoa autenticada, e o `requesterUserId` vem do cookie, nunca do corpo. Os testes desta
// suíte que não são sobre sessão em si usam este cookie fixo (token gerado por um
// `gerarToken` injetado, sem aleatoriedade) para não misturar o que cada um prova.
const TOKEN_SESSAO_PADRAO = 'SYNTH-token-sessao-conta-1'
const COOKIE_SESSAO_PADRAO = `${NOME_COOKIE_SESSAO}=${TOKEN_SESSAO_PADRAO}`

/** `ArmazemDeSessoes` com uma sessão já criada para `idDaConta`, token fixo e previsível. */
function armazemComSessao(idDaConta: string, token: string = TOKEN_SESSAO_PADRAO): ArmazemDeSessoes {
  const armazem = new ArmazemDeSessoes({ gerarToken: () => token })
  armazem.criar(idDaConta)
  return armazem
}

function motorFalso(): DependenciasHttp {
  const registry = new ToolRegistry()
  return {
    registryDaConta: () => registry,
    armazemDeSessoes: armazemComSessao('conta-1'),
    criarMotor: () => new ScriptedMotor([{ reply: 'SYNTH-resposta', proposals: [] }]),
    gerarRunId: () => 'SYNTH-run-fixo',
  }
}

describe('GET /health', () => {
  it('responde 200 com status ok e a versão do contrato', async () => {
    const { base } = await subirServidor(motorFalso())
    const resposta = await fetch(`${base}/health`)
    expect(resposta.status).toBe(200)
    expect(await jsonDe(resposta)).toEqual({ status: 'ok', contrato: CONTRACT_VERSION })
  })
})

describe('roteamento', () => {
  it('rota desconhecida devolve 404 tipado', async () => {
    const { base } = await subirServidor(motorFalso())
    const resposta = await fetch(`${base}/desconhecido`)
    expect(resposta.status).toBe(404)
    expect((await jsonDe(resposta)).erro.categoria).toBe('rota_desconhecida')
  })

  it('GET em /turno devolve 405 com Allow: POST', async () => {
    const { base } = await subirServidor(motorFalso())
    const resposta = await fetch(`${base}/turno`)
    expect(resposta.status).toBe(405)
    expect(resposta.headers.get('allow')).toBe('POST')
    expect((await jsonDe(resposta)).erro.categoria).toBe('metodo_nao_permitido')
  })
})

describe('POST /turno — sessão (Etapa 10 da Fase 4)', () => {
  it('sem cookie de sessão devolve 401 sessao_ausente, antes de olhar o corpo', async () => {
    const { base } = await subirServidor(motorFalso())
    const resposta = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpoValido),
    })
    expect(resposta.status).toBe(401)
    expect((await jsonDe(resposta)).erro.categoria).toBe('sessao_ausente')
  })

  it('cookie com token desconhecido (adulterado) devolve 401 sessao_ausente', async () => {
    const { base } = await subirServidor(motorFalso())
    const resposta = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${NOME_COOKIE_SESSAO}=SYNTH-token-nunca-emitido`,
      },
      body: JSON.stringify(corpoValido),
    })
    expect(resposta.status).toBe(401)
    expect((await jsonDe(resposta)).erro.categoria).toBe('sessao_ausente')
  })

  it('sessão expirada devolve 401 sessao_expirada', async () => {
    const registry = new ToolRegistry()
    const deps: DependenciasHttp = {
      registryDaConta: () => registry,
      // TTL negativo: a sessão nasce já expirada, sem precisar mexer no relógio.
      armazemDeSessoes: new ArmazemDeSessoes({ gerarToken: () => TOKEN_SESSAO_PADRAO, ttlMs: -1 }),
      criarMotor: () => new ScriptedMotor([{ reply: 'SYNTH-resposta', proposals: [] }]),
      gerarRunId: () => 'SYNTH-run-expirado',
    }
    deps.armazemDeSessoes.criar('conta-1')

    const { base } = await subirServidor(deps)
    const resposta = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify(corpoValido),
    })
    expect(resposta.status).toBe(401)
    expect((await jsonDe(resposta)).erro.categoria).toBe('sessao_expirada')
  })

  it('sessão válida, mas sem registry para a conta, devolve 401 sessao_ausente', async () => {
    const deps: DependenciasHttp = {
      registryDaConta: () => undefined,
      armazemDeSessoes: armazemComSessao('conta-removida'),
      criarMotor: () => new ScriptedMotor([{ reply: 'SYNTH-resposta', proposals: [] }]),
      gerarRunId: () => 'SYNTH-run-sem-registry',
    }
    const { base } = await subirServidor(deps)
    const resposta = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify(corpoValido),
    })
    expect(resposta.status).toBe(401)
    expect((await jsonDe(resposta)).erro.categoria).toBe('sessao_ausente')
  })

  it('sessão válida usa o registry da própria conta — dois registries de mentira, distinguíveis', async () => {
    const chamadasRegistryDaConta1: string[] = []
    const chamadasRegistryDaConta2: string[] = []
    const registryDaConta1 = new ToolRegistry().register('workspace.tasks.list', async () => {
      chamadasRegistryDaConta1.push('chamado')
      return { ok: true }
    })
    const registryDaConta2 = new ToolRegistry().register('workspace.tasks.list', async () => {
      chamadasRegistryDaConta2.push('chamado')
      return { ok: true }
    })

    const deps: DependenciasHttp = {
      registryDaConta: (idDaConta) =>
        idDaConta === 'conta-1' ? registryDaConta1 : registryDaConta2,
      armazemDeSessoes: armazemComSessao('conta-1'),
      criarMotor: () =>
        new ScriptedMotor([
          { reply: null, proposals: [{ toolName: 'workspace.tasks.list', args: {} }] },
          { reply: 'SYNTH-pronto', proposals: [] },
        ]),
      gerarRunId: () => 'SYNTH-run-conta-1',
    }

    const { base } = await subirServidor(deps)
    const resposta = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify(corpoValido),
    })

    expect(resposta.status).toBe(200)
    expect(chamadasRegistryDaConta1).toEqual(['chamado'])
    expect(chamadasRegistryDaConta2).toEqual([])
  })

  it('requesterUserId do registro de execução é o id da conta, nunca o e-mail', async () => {
    let requesterRecebido: RequesterContext | undefined
    const registry = new ToolRegistry().register('workspace.tasks.list', async ({ requester }) => {
      requesterRecebido = requester
      return { ok: true }
    })
    const deps: DependenciasHttp = {
      registryDaConta: () => registry,
      armazemDeSessoes: armazemComSessao('conta-1'),
      criarMotor: () =>
        new ScriptedMotor([
          { reply: null, proposals: [{ toolName: 'workspace.tasks.list', args: {} }] },
          { reply: 'SYNTH-pronto', proposals: [] },
        ]),
      gerarRunId: () => 'SYNTH-run-requester',
    }

    const { base } = await subirServidor(deps)
    await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify(corpoValido),
    })

    expect(requesterRecebido?.requesterUserId).toBe('conta-1')
    expect(requesterRecebido?.requesterUserId).not.toContain('@')
  })

  it('corpo com "requester" devolve 422 — a identidade não vem mais do cliente', async () => {
    const { base } = await subirServidor(motorFalso())
    const resposta = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify({
        ...corpoValido,
        requester: { requesterUserId: 'SYNTH-forjado', deviceId: null },
      }),
    })
    expect(resposta.status).toBe(422)
    expect((await jsonDe(resposta)).erro.categoria).toBe('corpo_invalido')
  })
})

describe('POST /turno — validação do corpo', () => {
  it('Content-Type diferente de application/json devolve 415', async () => {
    const { base } = await subirServidor(motorFalso())
    const resposta = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Cookie: COOKIE_SESSAO_PADRAO },
      body: 'oi',
    })
    expect(resposta.status).toBe(415)
    expect((await jsonDe(resposta)).erro.categoria).toBe('tipo_nao_suportado')
  })

  it('corpo que não é JSON válido devolve 400 corpo_ilegivel, sem stack', async () => {
    const { base } = await subirServidor(motorFalso())
    const resposta = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: 'nao e json',
    })
    expect(resposta.status).toBe(400)
    const corpo = await resposta.text()
    expect(JSON.parse(corpo).erro.categoria).toBe('corpo_ilegivel')
    expect(corpo).not.toMatch(/at .*\.ts:\d+/)
  })

  it('corpo sem mensagem devolve 422 corpo_invalido', async () => {
    const { base } = await subirServidor(motorFalso())
    const resposta = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify({ deviceId: null }),
    })
    expect(resposta.status).toBe(422)
    expect((await jsonDe(resposta)).erro.categoria).toBe('corpo_invalido')
  })

  it('deviceId malformado devolve 422 corpo_invalido, sem o valor rejeitado', async () => {
    const { base } = await subirServidor(motorFalso())
    const resposta = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify({ mensagem: 'SYNTH-oi', deviceId: 123 }),
    })
    expect(resposta.status).toBe(422)
    const corpo = await jsonDe(resposta)
    expect(corpo.erro.categoria).toBe('corpo_invalido')
    expect(corpo.erro.campos).toBeDefined()
  })

  it('campo extra no corpo (runId forjado) devolve 422 — prova o .strict()', async () => {
    const { base } = await subirServidor(motorFalso())
    const resposta = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify({ ...corpoValido, runId: 'SYNTH-forjado' }),
    })
    expect(resposta.status).toBe(422)
  })

  it('corpo maior que o teto devolve 413 e o servidor continua atendendo', async () => {
    const { base } = await subirServidor(motorFalso())
    const grande = JSON.stringify({
      mensagem: 'a'.repeat(100_000),
      deviceId: null,
    })
    const resposta = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: grande,
    })
    expect(resposta.status).toBe(413)

    const segunda = await fetch(`${base}/health`)
    expect(segunda.status).toBe(200)
  })
})

describe('POST /turno — caminho feliz', () => {
  it('sem ferramenta: devolve outcome replied com o runId gerado', async () => {
    const { base } = await subirServidor(motorFalso())
    const resposta = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify(corpoValido),
    })
    expect(resposta.status).toBe(200)
    const corpo = await jsonDe(resposta)
    expect(corpo.runId).toBe('SYNTH-run-fixo')
    expect(corpo.outcome.kind).toBe('replied')
    expect(corpo.outcome.reply).toBe('SYNTH-resposta')
  })

  it('com ferramenta: outcome traz o registro succeeded, sem rede real', async () => {
    const client = new WorkspaceClient({
      baseUrl: 'http://workspace.invalido',
      serviceClientId: 'SYNTH-client',
      serviceSecret: 'SYNTH-secret',
      delegationToken: 'SYNTH-token',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ contractVersion: CONTRACT_VERSION, items: [], nextCursor: null }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    })
    const registry = new ToolRegistry().register('workspace.tasks.list', createListTasksTool(client))

    const deps: DependenciasHttp = {
      registryDaConta: () => registry,
      armazemDeSessoes: armazemComSessao('conta-1'),
      criarMotor: () =>
        new ScriptedMotor([
          { reply: null, proposals: [{ toolName: 'workspace.tasks.list', args: {} }] },
          { reply: 'SYNTH-pronto', proposals: [] },
        ]),
      gerarRunId: () => 'SYNTH-run-ferramenta',
    }

    const { base } = await subirServidor(deps)
    const resposta = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify(corpoValido),
    })
    expect(resposta.status).toBe(200)
    const corpo = await jsonDe(resposta)
    expect(corpo.outcome.kind).toBe('replied')
    expect(corpo.outcome.records[0].toolName).toBe('workspace.tasks.list')
    expect(corpo.outcome.records[0].state).toBe('succeeded')
  })

  it('proposta de efeito externo devolve needs_approval', async () => {
    const deps: DependenciasHttp = {
      registryDaConta: () => new ToolRegistry(),
      armazemDeSessoes: armazemComSessao('conta-1'),
      criarMotor: () =>
        new ScriptedMotor([
          { reply: null, proposals: [{ toolName: 'workspace.email.send', args: { para: 'x' } }] },
        ]),
      gerarRunId: () => 'SYNTH-run-aprovacao',
    }
    const { base } = await subirServidor(deps)
    const resposta = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify(corpoValido),
    })
    expect(resposta.status).toBe(200)
    const corpo = await jsonDe(resposta)
    expect(corpo.outcome.kind).toBe('needs_approval')
    expect(corpo.outcome.toolName).toBe('workspace.email.send')
    expect(corpo.outcome.argsHash).toBeDefined()
  })
})

describe('POST /turno — um motor novo por requisição', () => {
  it('criarMotor é chamado uma vez por requisição, com instâncias diferentes', async () => {
    const instancias: ScriptedMotor[] = []
    const runIds = ['SYNTH-run-a', 'SYNTH-run-b']
    let chamada = 0
    const deps: DependenciasHttp = {
      registryDaConta: () => new ToolRegistry(),
      armazemDeSessoes: armazemComSessao('conta-1'),
      criarMotor: () => {
        const motor = new ScriptedMotor([{ reply: 'SYNTH-ok', proposals: [] }])
        instancias.push(motor)
        return motor
      },
      gerarRunId: () => runIds[chamada++] ?? 'SYNTH-run-extra',
    }
    const { base } = await subirServidor(deps)

    const r1 = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify(corpoValido),
    })
    const r2 = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify(corpoValido),
    })

    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
    expect(instancias).toHaveLength(2)
    expect(instancias[0]).not.toBe(instancias[1])
    const c1 = await jsonDe(r1)
    const c2 = await jsonDe(r2)
    expect(c1.runId).not.toBe(c2.runId)
  })

  it('com AnthropicMotor real via criarMotorPorTurno: duas requisições sequenciais funcionam as duas', async () => {
    let vezes = 0
    const apiFalsa: AnthropicMessagesApi = {
      create: async () => {
        vezes += 1
        return {
          id: `SYNTH-msg-${vezes}`,
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-5',
          content: [{ type: 'text', text: 'SYNTH-resposta-real' }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 5 },
        } as unknown as Awaited<ReturnType<AnthropicMessagesApi['create']>>
      },
    }
    const fabrica = criarMotorPorTurno({ messages: apiFalsa })
    let runId = 0
    const deps: DependenciasHttp = {
      registryDaConta: () => new ToolRegistry(),
      armazemDeSessoes: armazemComSessao('conta-1'),
      criarMotor: fabrica,
      gerarRunId: () => `SYNTH-run-real-${runId++}`,
    }
    const { base } = await subirServidor(deps)

    const r1 = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify(corpoValido),
    })
    const r2 = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify(corpoValido),
    })

    // Se a criação do motor fosse hoisted para fora do handler (motor único de processo),
    // exigirMesmoTurno lançaria na segunda chamada e ela viraria 502 — é exatamente esse
    // defeito que este teste está aqui para pegar.
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
  })
})

describe('POST /turno — falha do motor não vaza', () => {
  it('MotorError vira 502 tipado; o motivo original só vai para o log injetado', async () => {
    const logs: string[] = []
    const deps: DependenciasHttp = {
      registryDaConta: () => new ToolRegistry(),
      armazemDeSessoes: armazemComSessao('conta-1'),
      criarMotor: () => ({
        name: 'motor-que-falha',
        step: async () => {
          throw new MotorError(
            'A chamada ao modelo falhou: sk-ant-SYNTH-segredo / SYNTH-conteudo-da-conversa',
            'anthropic',
          )
        },
      }),
      gerarRunId: () => 'SYNTH-run-falha',
      registrar: (linha: string) => logs.push(linha),
    }
    const { base } = await subirServidor(deps)
    const resposta = await fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify(corpoValido),
    })
    expect(resposta.status).toBe(502)
    const corpoTexto = await resposta.text()
    expect(corpoTexto).not.toContain('sk-ant')
    expect(corpoTexto).not.toContain('SYNTH-segredo')
    expect(corpoTexto).not.toContain('SYNTH-conteudo-da-conversa')
    expect(corpoTexto).not.toContain('A chamada ao modelo falhou')
    expect(logs.some((l) => l.includes('SYNTH-segredo'))).toBe(true)
  })
})

describe('POST /turno — variável de ambiente nunca aparece no corpo', () => {
  it('percorre os desfechos de erro e confirma ausência de segredo de ambiente', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'SYNTH-chave-que-nao-pode-vazar')
    vi.stubEnv('WORKSPACE_AGENT_SECRET', 'SYNTH-segredo-que-nao-pode-vazar')
    try {
      const { base } = await subirServidor(motorFalso())
      const corpos: string[] = []

      corpos.push(
        await (
          await fetch(`${base}/turno`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain', Cookie: COOKIE_SESSAO_PADRAO },
            body: 'x',
          })
        ).text(),
      )
      corpos.push(
        await (
          await fetch(`${base}/turno`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
            body: 'nao e json',
          })
        ).text(),
      )
      corpos.push(
        await (
          await fetch(`${base}/turno`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
            body: JSON.stringify({ deviceId: null }),
          })
        ).text(),
      )

      for (const corpo of corpos) {
        expect(corpo).not.toContain('SYNTH-chave-que-nao-pode-vazar')
        expect(corpo).not.toContain('SYNTH-segredo-que-nao-pode-vazar')
      }
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('POST /turno — nenhum 500 não tratado nos casos de erro do cliente', () => {
  it('todas as respostas de erro parseiam como JSON com erro.categoria', async () => {
    const { base } = await subirServidor(motorFalso())
    const casos = [
      { path: '/desconhecido', init: {} },
      { path: '/turno', init: { method: 'GET' } },
      { path: '/turno', init: { method: 'POST' } },
      {
        path: '/turno',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain', Cookie: COOKIE_SESSAO_PADRAO },
          body: 'x',
        },
      },
      {
        path: '/turno',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
          body: 'nao e json',
        },
      },
      {
        path: '/turno',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
          body: JSON.stringify({ deviceId: null }),
        },
      },
    ] as const

    for (const caso of casos) {
      const resposta = await fetch(`${base}${caso.path}`, caso.init as RequestInit)
      expect(resposta.status).not.toBe(500)
      const corpo = await jsonDe(resposta)
      expect(corpo.erro.categoria).toBeDefined()
    }
  })
})

describe('Host — defesa contra DNS rebinding', () => {
  it('Host forjado (domínio de atacante) é recusado antes de chegar ao roteamento', async () => {
    const { base, port } = await subirServidor(motorFalso())
    // fetch() não deixa forjar o cabeçalho Host diretamente; conecta-se via socket cru
    // simulando o que um navegador manda depois de um DNS rebinding.
    const net = await import('node:net')
    const resposta = await new Promise<string>((resolve, reject) => {
      const socket = net.connect(port, '127.0.0.1', () => {
        socket.write(
          'GET /health HTTP/1.1\r\nHost: dominio-do-atacante.tld:' + port + '\r\nConnection: close\r\n\r\n',
        )
      })
      let dados = ''
      socket.on('data', (d) => (dados += d.toString()))
      socket.on('end', () => resolve(dados))
      socket.on('error', reject)
    })

    expect(resposta).toContain('400')
    expect(resposta).toContain('host_nao_permitido')
    void base
  })

  it('Host 127.0.0.1 (o caso normal) continua funcionando', async () => {
    const { base } = await subirServidor(motorFalso())
    const resposta = await fetch(`${base}/health`)
    expect(resposta.status).toBe(200)
  })
})

describe('POST /turno — desconexão do cliente cancela o turno', () => {
  it('abortar o fetch propaga o signal até o handler da ferramenta', async () => {
    let deferredResolveChamado: (() => void) | undefined
    const chamadoPeloHandler = new Promise<void>((resolve) => {
      deferredResolveChamado = resolve
    })
    let signalVistoPeloHandler: AbortSignal | undefined

    const registry = new ToolRegistry().register('workspace.tasks.list', async ({ signal }) => {
      signalVistoPeloHandler = signal
      deferredResolveChamado?.()
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true })
      })
      throw new Error('cancelado no meio do handler')
    })

    const deps: DependenciasHttp = {
      registryDaConta: () => registry,
      armazemDeSessoes: armazemComSessao('conta-1'),
      criarMotor: () =>
        new ScriptedMotor([
          { reply: null, proposals: [{ toolName: 'workspace.tasks.list', args: {} }] },
        ]),
      gerarRunId: () => 'SYNTH-run-cancelado',
    }
    const { base } = await subirServidor(deps)

    const controller = new AbortController()
    const requisicao = fetch(`${base}/turno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE_SESSAO_PADRAO },
      body: JSON.stringify(corpoValido),
      signal: controller.signal,
    }).catch(() => undefined)

    await chamadoPeloHandler
    controller.abort()
    await requisicao

    await vi.waitFor(() => {
      expect(signalVistoPeloHandler?.aborted).toBe(true)
    })
  })
})

// Regressão de assinatura: garante que a categoria WorkspaceApiError segue disponível
// para o teste de erros.test.ts (import cruzado não usado em runtime, só typecheck).
void WorkspaceApiError
