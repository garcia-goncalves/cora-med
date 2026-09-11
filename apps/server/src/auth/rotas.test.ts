import type { AddressInfo } from 'node:net'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ToolRegistry } from '../tools/registry.js'
import { ScriptedMotor } from '../engine/scripted.js'
import { criarServidorHttp, type DependenciasHttp } from '../http/server.js'
import type { ContaConfigurada } from './contas.js'
import { ArmazemDeSessoes } from './sessao.js'
import { FreioDeTentativas } from './freio.js'
import { criarHashArgon2id, type PortaDeHashDeSenha } from './senha.js'
import type { DependenciasDeAuth } from './rotas.js'

/** `Response.json()` tipa como `unknown` nesta configuração (sem lib DOM). */
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

/** Extrai `cora_sessao=<token>` de um cabeçalho `Set-Cookie` inteiro. */
function tokenDoSetCookie(setCookie: string | null): string {
  expect(setCookie).not.toBeNull()
  const primeiraParte = (setCookie ?? '').split(';')[0] ?? ''
  return primeiraParte
}

const SENHA_CERTA = 'SYNTH-senha-correta'
let hashDaContaSynth: string
let portaDeHash: PortaDeHashDeSenha

beforeAll(async () => {
  portaDeHash = criarHashArgon2id()
  hashDaContaSynth = await portaDeHash.gerar(SENHA_CERTA)
})

function contaSynth(): ContaConfigurada {
  return {
    id: 'conta-1',
    nome: 'SYNTH-Thaís',
    email: 'synth-thais@teste.local',
    hashDeSenha: hashDaContaSynth,
    tokenDeDelegacao: 'SYNTH-delegacao-nunca-deve-vazar',
  }
}

function motorFalso() {
  const registry = new ToolRegistry()
  return {
    registryDaConta: () => registry,
    criarMotor: () => new ScriptedMotor([{ reply: 'SYNTH-resposta', proposals: [] }]),
  }
}

function montarDeps(overrides: Partial<DependenciasDeAuth> = {}): DependenciasHttp {
  const armazemDeSessoes = overrides.armazemDeSessoes ?? new ArmazemDeSessoes()
  const auth: DependenciasDeAuth = {
    contas: [contaSynth()],
    armazemDeSessoes,
    freio: overrides.freio ?? new FreioDeTentativas(),
    portaDeHash,
    ...overrides,
  }
  return { ...motorFalso(), armazemDeSessoes, auth }
}

describe('POST /auth/entrar', () => {
  it('senha certa entra e recebe cookie de sessão com os três atributos', async () => {
    const { base } = await subirServidor(montarDeps())
    const resposta = await fetch(`${base}/auth/entrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: contaSynth().email, senha: SENHA_CERTA }),
    })

    expect(resposta.status).toBe(200)
    const cookie = resposta.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('cora_sessao=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')

    const corpo = await jsonDe(resposta)
    expect(corpo.sessao.idDaConta).toBe('conta-1')
    expect(corpo.sessao.email).toBe(contaSynth().email)
  })

  it('resposta de entrada não contém token de delegação nem hash', async () => {
    const { base } = await subirServidor(montarDeps())
    const resposta = await fetch(`${base}/auth/entrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: contaSynth().email, senha: SENHA_CERTA }),
    })

    const corpoTexto = await resposta.text()
    expect(corpoTexto).not.toContain('SYNTH-delegacao-nunca-deve-vazar')
    expect(corpoTexto).not.toContain(hashDaContaSynth)
    expect(corpoTexto).not.toContain('$argon2id$')
  })

  it('senha errada dá 401 genérico', async () => {
    const { base } = await subirServidor(montarDeps())
    const resposta = await fetch(`${base}/auth/entrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: contaSynth().email, senha: 'SYNTH-senha-errada' }),
    })

    expect(resposta.status).toBe(401)
    expect((await jsonDe(resposta)).erro.categoria).toBe('credenciais_invalidas')
  })

  it('e-mail inexistente dá exatamente a mesma resposta que senha errada', async () => {
    const { base } = await subirServidor(montarDeps())

    const comEmailInexistente = await fetch(`${base}/auth/entrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'synth-nao-existe@teste.local', senha: 'SYNTH-qualquer' }),
    })
    const comSenhaErrada = await fetch(`${base}/auth/entrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: contaSynth().email, senha: 'SYNTH-senha-errada' }),
    })

    expect(comEmailInexistente.status).toBe(comSenhaErrada.status)
    expect(await jsonDe(comEmailInexistente)).toEqual(await jsonDe(comSenhaErrada))
  })

  it('o limite de falhas bloqueia com 429, antes de conferir a senha', async () => {
    const freio = new FreioDeTentativas({ limite: 3, now: () => new Date(0) })
    const { base } = await subirServidor(montarDeps({ freio }))

    for (let i = 0; i < 3; i += 1) {
      await fetch(`${base}/auth/entrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: contaSynth().email, senha: 'SYNTH-senha-errada' }),
      })
    }

    const resposta = await fetch(`${base}/auth/entrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: contaSynth().email, senha: SENHA_CERTA }),
    })

    expect(resposta.status).toBe(429)
    expect((await jsonDe(resposta)).erro.categoria).toBe('bloqueado_por_tentativas')
  })

  it('GET em /auth/entrar devolve 405 com Allow: POST', async () => {
    const { base } = await subirServidor(montarDeps())
    const resposta = await fetch(`${base}/auth/entrar`)
    expect(resposta.status).toBe(405)
    expect(resposta.headers.get('allow')).toBe('POST')
  })
})

describe('GET /auth/sessao', () => {
  it('cookie válido devolve 200 com a sessão', async () => {
    const armazemDeSessoes = new ArmazemDeSessoes()
    const { base } = await subirServidor(montarDeps({ armazemDeSessoes }))

    const entrada = await fetch(`${base}/auth/entrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: contaSynth().email, senha: SENHA_CERTA }),
    })
    const cookie = tokenDoSetCookie(entrada.headers.get('set-cookie'))

    const resposta = await fetch(`${base}/auth/sessao`, {
      headers: { Cookie: cookie },
    })
    expect(resposta.status).toBe(200)
    expect((await jsonDe(resposta)).sessao.idDaConta).toBe('conta-1')
  })

  it('sem cookie devolve 401 sessao_ausente', async () => {
    const { base } = await subirServidor(montarDeps())
    const resposta = await fetch(`${base}/auth/sessao`)
    expect(resposta.status).toBe(401)
    expect((await jsonDe(resposta)).erro.categoria).toBe('sessao_ausente')
  })

  it('token adulterado devolve 401 sessao_ausente', async () => {
    const armazemDeSessoes = new ArmazemDeSessoes()
    const { base } = await subirServidor(montarDeps({ armazemDeSessoes }))

    const entrada = await fetch(`${base}/auth/entrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: contaSynth().email, senha: SENHA_CERTA }),
    })
    const cookie = tokenDoSetCookie(entrada.headers.get('set-cookie'))
    const [nome, token] = cookie.split('=')
    const adulterado = token!.slice(0, -1) + (token!.at(-1) === 'a' ? 'b' : 'a')

    const resposta = await fetch(`${base}/auth/sessao`, {
      headers: { Cookie: `${nome}=${adulterado}` },
    })
    expect(resposta.status).toBe(401)
    expect((await jsonDe(resposta)).erro.categoria).toBe('sessao_ausente')
  })

  it('sessão expirada devolve 401 sessao_expirada', async () => {
    let agora = new Date('2026-01-01T10:00:00.000Z')
    const armazemDeSessoes = new ArmazemDeSessoes({ now: () => agora, ttlMs: 1000 })
    const { base } = await subirServidor(montarDeps({ armazemDeSessoes }))

    const entrada = await fetch(`${base}/auth/entrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: contaSynth().email, senha: SENHA_CERTA }),
    })
    const cookie = tokenDoSetCookie(entrada.headers.get('set-cookie'))

    agora = new Date('2026-01-01T10:00:01.001Z')

    const resposta = await fetch(`${base}/auth/sessao`, {
      headers: { Cookie: cookie },
    })
    expect(resposta.status).toBe(401)
    expect((await jsonDe(resposta)).erro.categoria).toBe('sessao_expirada')
  })

  it('POST em /auth/sessao devolve 405 com Allow: GET', async () => {
    const { base } = await subirServidor(montarDeps())
    const resposta = await fetch(`${base}/auth/sessao`, { method: 'POST' })
    expect(resposta.status).toBe(405)
    expect(resposta.headers.get('allow')).toBe('GET')
  })
})

describe('POST /auth/sair', () => {
  it('invalida a sessão do cookie: /auth/sessao passa a recusar depois', async () => {
    const armazemDeSessoes = new ArmazemDeSessoes()
    const { base } = await subirServidor(montarDeps({ armazemDeSessoes }))

    const entrada = await fetch(`${base}/auth/entrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: contaSynth().email, senha: SENHA_CERTA }),
    })
    const cookie = tokenDoSetCookie(entrada.headers.get('set-cookie'))

    const saida = await fetch(`${base}/auth/sair`, {
      method: 'POST',
      headers: { Cookie: cookie },
    })
    expect(saida.status).toBe(200)

    const depoisDeSair = await fetch(`${base}/auth/sessao`, {
      headers: { Cookie: cookie },
    })
    expect(depoisDeSair.status).toBe(401)
  })

  it('é idempotente: 200 mesmo sem sessão', async () => {
    const { base } = await subirServidor(montarDeps())
    const resposta = await fetch(`${base}/auth/sair`, { method: 'POST' })
    expect(resposta.status).toBe(200)
  })
})

describe('verificação de origem no POST', () => {
  it('Origin que não bate com o Host é recusada', async () => {
    const { base } = await subirServidor(montarDeps())
    const resposta = await fetch(`${base}/auth/entrar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://dominio-do-atacante.tld',
      },
      body: JSON.stringify({ email: contaSynth().email, senha: SENHA_CERTA }),
    })
    expect(resposta.status).toBe(400)
    expect((await jsonDe(resposta)).erro.categoria).toBe('host_nao_permitido')
  })

  it('Origin que bate com o Host segue normalmente', async () => {
    const { base } = await subirServidor(montarDeps())
    const resposta = await fetch(`${base}/auth/entrar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://127.0.0.1',
      },
      body: JSON.stringify({ email: contaSynth().email, senha: SENHA_CERTA }),
    })
    expect(resposta.status).toBe(200)
  })
})
