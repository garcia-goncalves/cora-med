/**
 * Verificação da Fase 4 (CORA) — login, sessão e o servimento estático, ponta a ponta.
 *
 * Diferente das Fases 1 e 2, este script NÃO precisa de um Workspace real: sobe o
 * `criarServidorHttp` da própria Cora em porta efêmera, com duas contas sintéticas
 * (`SYNTH-`), hash de senha gerado na hora com o Argon2id de produção, um `ScriptedMotor`
 * roteirizado no lugar do provedor de IA e `now` controlado onde a verificação precisa de
 * um relógio previsível. Continua FORA de `pnpm run test` por subir servidor de verdade,
 * no mesmo espírito de `verificacao-fase-01.ts` e `verificacao-fase-02.ts`.
 *
 * Nenhum valor de senha, hash de senha ou token de delegação é impresso em lugar nenhum —
 * só o resultado (estado HTTP, categoria de erro, atributo presente/ausente) de cada
 * verificação.
 *
 * Uso:
 *   pnpm run verificacao:fase04
 *   (ou diretamente) pnpm exec tsx scripts/verificacao-fase-04.ts
 */

import { randomBytes } from 'node:crypto'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { fixtures } from '@cora/contracts'
import { WorkspaceClient } from '@cora/workspace-client'

import type { ContaConfigurada } from '../apps/server/src/auth/contas.js'
import { NOME_COOKIE_SESSAO } from '../apps/server/src/auth/cookie.js'
import { FreioDeTentativas, LIMITE_DE_FALHAS } from '../apps/server/src/auth/freio.js'
import { criarHashArgon2id } from '../apps/server/src/auth/senha.js'
import { ArmazemDeSessoes } from '../apps/server/src/auth/sessao.js'
import { ScriptedMotor } from '../apps/server/src/engine/scripted.js'
import { criarServidorHttp, type DependenciasHttp } from '../apps/server/src/http/server.js'
import { ToolRegistry } from '../apps/server/src/tools/registry.js'
import { createListTasksTool } from '../apps/server/src/tools/workspace-tasks.js'

/** Instante fixo usado como relógio da maior parte da verificação — previsível, sem
 * depender de quanto tempo o script leva para rodar. */
const AGORA = new Date('2026-09-11T12:00:00.000Z')

/** Senhas de mentira, só para este script. Nunca impressas. */
const SENHA_CONTA_1 = 'SYNTH-senha-conta-1'
const SENHA_CONTA_2 = 'SYNTH-senha-conta-2'

interface Resultado {
  id: string
  descricao: string
  esperado: string
  obtido: string
  passou: boolean
}

const resultados: Resultado[] = []
const servidoresAbertos: Server[] = []

async function checar(
  id: string,
  descricao: string,
  esperado: string,
  fn: () => Promise<string>,
): Promise<void> {
  let obtido: string
  try {
    obtido = await fn()
  } catch (cause) {
    obtido = `EXCEÇÃO: ${cause instanceof Error ? cause.message : String(cause)}`
  }
  resultados.push({ id, descricao, esperado, obtido, passou: obtido === esperado })
}

/** Sobe um `criarServidorHttp` em porta efêmera. Todo servidor aberto aqui é fechado no
 * `finally` do `main()` — sem isso o processo nunca sairia sozinho. */
async function subir(deps: DependenciasHttp): Promise<{ base: string }> {
  const server = criarServidorHttp(deps)
  await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise))
  servidoresAbertos.push(server)
  const { port } = server.address() as AddressInfo
  return { base: `http://127.0.0.1:${port}` }
}

async function fecharServidores(): Promise<void> {
  await Promise.all(
    servidoresAbertos.splice(0).map((s) => new Promise<void>((resolvePromise) => s.close(() => resolvePromise()))),
  )
}

/** As duas contas sintéticas, com hash gerado pelo Argon2id de produção — a mesma porta
 * que `apps/server/src/auth/rotas.ts` usa. */
async function criarContas(): Promise<ContaConfigurada[]> {
  const portaDeHash = criarHashArgon2id()
  const [hash1, hash2] = await Promise.all([
    portaDeHash.gerar(SENHA_CONTA_1),
    portaDeHash.gerar(SENHA_CONTA_2),
  ])
  return [
    {
      id: 'conta-1',
      nome: 'SYNTH Conta Um',
      email: 'synth.conta1@verificacao.cora.local',
      hashDeSenha: hash1,
      tokenDeDelegacao: 'SYNTH-delegacao-conta-1',
    },
    {
      id: 'conta-2',
      nome: 'SYNTH Conta Dois',
      email: 'synth.conta2@verificacao.cora.local',
      hashDeSenha: hash2,
      tokenDeDelegacao: 'SYNTH-delegacao-conta-2',
    },
  ]
}

/**
 * Um `ToolRegistry` por conta, cada um com um `WorkspaceClient` de `fetchImpl` falso — sem
 * rede real, no molde de `server.test.ts`. `capturas` recebe o cabeçalho `Authorization`
 * visto por cada conta, o que é o que prova o item 07 (tokens de delegação diferentes) sem
 * nunca imprimir o valor do token em si.
 */
function montarRegistryDaConta(
  contas: readonly ContaConfigurada[],
  capturas: Map<string, string>,
): (idDaConta: string) => ToolRegistry | undefined {
  const porConta = new Map<string, ToolRegistry>()
  for (const conta of contas) {
    const fetchFalso = (async (_input, init) => {
      const cabecalhos = new Headers(init?.headers)
      capturas.set(conta.id, cabecalhos.get('authorization') ?? '')
      return new Response(JSON.stringify(fixtures.respostaVazia), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch
    const client = new WorkspaceClient({
      baseUrl: 'http://workspace.invalido.local',
      serviceClientId: 'SYNTH-client',
      serviceSecret: 'SYNTH-secret',
      delegationToken: conta.tokenDeDelegacao,
      fetchImpl: fetchFalso,
    })
    porConta.set(conta.id, new ToolRegistry().register('workspace.tasks.list', createListTasksTool(client)))
  }
  return (idDaConta) => porConta.get(idDaConta)
}

/** Motor roteirizado que sempre propõe uma chamada de ferramenta antes de responder — é o
 * que gera um `ExecutionRecord`, necessário para os itens 06 e 07. */
function criarMotorComFerramenta(): ScriptedMotor {
  return new ScriptedMotor([
    { reply: null, proposals: [{ toolName: 'workspace.tasks.list', args: {} }] },
    { reply: 'SYNTH-pronto', proposals: [] },
  ])
}

async function existeArquivo(caminho: string): Promise<boolean> {
  try {
    return (await stat(caminho)).isFile()
  } catch {
    return false
  }
}

/**
 * Raiz estática para os itens 11 e 12. Prefere o build real de `apps/web/dist` (Etapa 17);
 * se ele não existir — porque a Etapa 17 não rodou nesta árvore, ou porque este script foi
 * chamado sozinho —, cai numa pasta temporária com um `index.html` de mentira, e a saída
 * final avisa isso com todas as letras em vez de fingir que testou o build de verdade.
 */
async function prepararRaizEstatica(): Promise<{ caminho: string; temporaria: boolean }> {
  const distReal = resolve(process.cwd(), 'apps/web/dist')
  if (await existeArquivo(join(distReal, 'index.html'))) {
    return { caminho: distReal, temporaria: false }
  }
  const pasta = await mkdtemp(join(tmpdir(), 'cora-verificacao-fase-04-'))
  await writeFile(join(pasta, 'index.html'), 'SYNTH-index-de-verificacao')
  return { caminho: pasta, temporaria: true }
}

/** Atributos de cookie exigidos pela decisão D4 do plano da Fase 4. Nunca inclui o valor
 * do cookie na saída — só quais atributos faltam, se faltarem. */
function atributosAusentes(setCookie: string): string[] {
  return ['HttpOnly', 'SameSite=Lax', 'Secure'].filter((atributo) => !setCookie.includes(atributo))
}

async function main(): Promise<void> {
  console.log('--- VERIFICAÇÃO DA FASE 4 (CORA, login e sessão) ---')
  console.log(`data: ${new Date().toISOString()}`)
  console.log('')

  const contas = await criarContas()
  const [conta1, conta2] = contas as [ContaConfigurada, ContaConfigurada]
  const capturasDeAutorizacao = new Map<string, string>()
  const registryDaConta = montarRegistryDaConta(contas, capturasDeAutorizacao)

  const armazemDeSessoes = new ArmazemDeSessoes({ now: () => AGORA })
  const freio = new FreioDeTentativas({ now: () => AGORA })
  const portaDeHash = criarHashArgon2id()

  const raizEstatica = await prepararRaizEstatica()

  const deps: DependenciasHttp = {
    registryDaConta,
    armazemDeSessoes,
    criarMotor: criarMotorComFerramenta,
    gerarRunId: () => `SYNTH-run-${randomBytes(4).toString('hex')}`,
    auth: { contas, armazemDeSessoes, freio, portaDeHash },
    raizEstatica: raizEstatica.caminho,
  }

  try {
    const { base } = await subir(deps)

    // -----------------------------------------------------------------------------------
    // 01 — login com senha certa
    // -----------------------------------------------------------------------------------
    let cookieConta1 = ''
    await checar(
      '01',
      'Senha certa entra e recebe cookie com HttpOnly, SameSite=Lax e Secure',
      '200, cookie completo',
      async () => {
        const r = await fetch(`${base}/auth/entrar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: conta1.email, senha: SENHA_CONTA_1 }),
        })
        const setCookie = r.headers.get('set-cookie') ?? ''
        cookieConta1 = setCookie.split(';')[0] ?? ''
        const faltando = atributosAusentes(setCookie)
        return faltando.length === 0
          ? `${r.status}, cookie completo`
          : `${r.status}, faltando: ${faltando.join(',')}`
      },
    )

    // Login da segunda conta — preparo para os itens 06/07, não é verificação numerada em
    // si (o item 01 já prova que o login em si funciona).
    const respostaConta2 = await fetch(`${base}/auth/entrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: conta2.email, senha: SENHA_CONTA_2 }),
    })
    const cookieConta2 = (respostaConta2.headers.get('set-cookie') ?? '').split(';')[0] ?? ''

    // -----------------------------------------------------------------------------------
    // 02 — senha errada
    // -----------------------------------------------------------------------------------
    let statusSenhaErrada = 0
    let categoriaSenhaErrada = ''
    await checar('02', 'Senha errada recusa', '401 credenciais_invalidas', async () => {
      const r = await fetch(`${base}/auth/entrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: conta1.email, senha: 'SYNTH-senha-errada' }),
      })
      const corpo = (await r.json()) as { erro?: { categoria?: string } }
      statusSenhaErrada = r.status
      categoriaSenhaErrada = corpo.erro?.categoria ?? ''
      return `${r.status} ${categoriaSenhaErrada}`
    })

    // -----------------------------------------------------------------------------------
    // 03 — e-mail inexistente dá a MESMA resposta que senha errada
    // -----------------------------------------------------------------------------------
    await checar(
      '03',
      'E-mail inexistente dá resposta idêntica à de senha errada',
      `${statusSenhaErrada} ${categoriaSenhaErrada}`,
      async () => {
        const r = await fetch(`${base}/auth/entrar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'synth.inexistente@verificacao.cora.local',
            senha: 'SYNTH-qualquer-coisa',
          }),
        })
        const corpo = (await r.json()) as { erro?: { categoria?: string } }
        return `${r.status} ${corpo.erro?.categoria ?? ''}`
      },
    )

    // -----------------------------------------------------------------------------------
    // 04 — o limite de falhas bloqueia (deps isolados, para não turvar os outros itens)
    // -----------------------------------------------------------------------------------
    await checar(
      '04',
      'O limite de falhas bloqueia',
      `${LIMITE_DE_FALHAS}× credenciais_invalidas, depois bloqueado_por_tentativas`,
      async () => {
        const armazemIsolado = new ArmazemDeSessoes({ now: () => AGORA })
        const freioIsolado = new FreioDeTentativas({ now: () => AGORA })
        const depsIsolado: DependenciasHttp = {
          registryDaConta: () => undefined,
          armazemDeSessoes: armazemIsolado,
          criarMotor: () => new ScriptedMotor([]),
          auth: { contas, armazemDeSessoes: armazemIsolado, freio: freioIsolado, portaDeHash },
        }
        const { base: baseIsolada } = await subir(depsIsolado)
        const categorias: string[] = []
        for (let i = 0; i < LIMITE_DE_FALHAS + 1; i += 1) {
          const r = await fetch(`${baseIsolada}/auth/entrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: conta2.email, senha: 'SYNTH-senha-errada-repetida' }),
          })
          const corpo = (await r.json()) as { erro?: { categoria?: string } }
          categorias.push(corpo.erro?.categoria ?? '?')
        }
        const antesDoLimite = categorias.slice(0, LIMITE_DE_FALHAS)
        const naUltima = categorias[LIMITE_DE_FALHAS]
        const todasAsAnteriores = antesDoLimite.every((c) => c === 'credenciais_invalidas')
        return todasAsAnteriores && naUltima === 'bloqueado_por_tentativas'
          ? `${LIMITE_DE_FALHAS}× credenciais_invalidas, depois bloqueado_por_tentativas`
          : categorias.join(', ')
      },
    )

    // -----------------------------------------------------------------------------------
    // 05 — /turno sem cookie
    // -----------------------------------------------------------------------------------
    await checar('05', '/turno sem cookie é recusado', '401 sessao_ausente', async () => {
      const r = await fetch(`${base}/turno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: 'SYNTH-oi', deviceId: null }),
      })
      const corpo = (await r.json()) as { erro?: { categoria?: string } }
      return `${r.status} ${corpo.erro?.categoria ?? ''}`
    })

    // -----------------------------------------------------------------------------------
    // 06 — /turno com cookie funciona; requesterUserId do registro é o id da conta
    // -----------------------------------------------------------------------------------
    await checar(
      '06',
      '/turno com cookie funciona e o requesterUserId do registro é o id da conta',
      '200 replied conta-1',
      async () => {
        const r = await fetch(`${base}/turno`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookieConta1 },
          body: JSON.stringify({ mensagem: 'SYNTH-crie uma tarefa', deviceId: null }),
        })
        const corpo = (await r.json()) as {
          outcome?: { kind?: string; records?: Array<{ requesterUserId?: string }> }
        }
        const requesterId = corpo.outcome?.records?.[0]?.requesterUserId ?? ''
        return `${r.status} ${corpo.outcome?.kind} ${requesterId}`
      },
    )

    // -----------------------------------------------------------------------------------
    // 07 — as duas contas usam tokens de delegação diferentes
    // -----------------------------------------------------------------------------------
    await checar('07', 'As duas contas usam tokens de delegação diferentes', 'diferentes', async () => {
      await fetch(`${base}/turno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieConta2 },
        body: JSON.stringify({ mensagem: 'SYNTH-crie uma tarefa', deviceId: null }),
      })
      const tokenConta1 = capturasDeAutorizacao.get('conta-1') ?? ''
      const tokenConta2 = capturasDeAutorizacao.get('conta-2') ?? ''
      if (!tokenConta1 || !tokenConta2) return 'CAPTURA AUSENTE'
      return tokenConta1 !== tokenConta2 ? 'diferentes' : 'IGUAIS (regressão)'
    })

    // -----------------------------------------------------------------------------------
    // 08 — sessão expirada (deps isolados, com TTL curto e relógio próprio)
    // -----------------------------------------------------------------------------------
    await checar('08', 'Sessão expirada é recusada com sessao_expirada', '401 sessao_expirada', async () => {
      let agoraIsolado = new Date(AGORA)
      const armazemExpira = new ArmazemDeSessoes({ now: () => agoraIsolado, ttlMs: 1000 })
      const { token } = armazemExpira.criar('conta-1')
      agoraIsolado = new Date(AGORA.getTime() + 2000) // passa do TTL de 1s
      const depsExpira: DependenciasHttp = {
        registryDaConta: () => undefined,
        armazemDeSessoes: armazemExpira,
        criarMotor: () => new ScriptedMotor([]),
      }
      const { base: baseExpira } = await subir(depsExpira)
      const r = await fetch(`${baseExpira}/turno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `${NOME_COOKIE_SESSAO}=${token}` },
        body: JSON.stringify({ mensagem: 'SYNTH-oi', deviceId: null }),
      })
      const corpo = (await r.json()) as { erro?: { categoria?: string } }
      return `${r.status} ${corpo.erro?.categoria ?? ''}`
    })

    // -----------------------------------------------------------------------------------
    // 09 — cookie adulterado
    // -----------------------------------------------------------------------------------
    await checar('09', 'Cookie adulterado é recusado', '401 sessao_ausente', async () => {
      const valorOriginal = cookieConta1.split('=')[1] ?? ''
      if (!valorOriginal) return 'COOKIE AUSENTE (item 01 falhou antes)'
      // Mesmo tamanho, um caractere trocado — prova que o token é comparado de verdade, e
      // não só "existe algum cookie".
      const ultimo = valorOriginal.at(-1)
      const alterado = valorOriginal.slice(0, -1) + (ultimo === 'a' ? 'b' : 'a')
      const r = await fetch(`${base}/turno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `${NOME_COOKIE_SESSAO}=${alterado}` },
        body: JSON.stringify({ mensagem: 'SYNTH-oi', deviceId: null }),
      })
      const corpo = (await r.json()) as { erro?: { categoria?: string } }
      return `${r.status} ${corpo.erro?.categoria ?? ''}`
    })

    // -----------------------------------------------------------------------------------
    // 10 — X-Robots-Tag
    // -----------------------------------------------------------------------------------
    await checar('10', 'X-Robots-Tag presente', 'noindex, nofollow', async () => {
      const r = await fetch(`${base}/health`)
      return r.headers.get('x-robots-tag') ?? 'AUSENTE'
    })

    // -----------------------------------------------------------------------------------
    // 11 — travessia de caminho no servimento estático é recusada
    // -----------------------------------------------------------------------------------
    await checar(
      '11',
      'Travessia de caminho no servimento estático é recusada',
      '404 rota_desconhecida',
      async () => {
        // `%5c` (barra invertida) sobrevive à normalização de `..` que `new URL()` já faz
        // sozinho — é o vetor que de fato exercita `resolverArquivoEstatico` (Etapa 8).
        const r = await fetch(`${base}/%2e%2e%5c%2e%2e%5cetc%5cpasswd`)
        const corpo = (await r.json()) as { erro?: { categoria?: string } }
        return `${r.status} ${corpo.erro?.categoria ?? ''}`
      },
    )

    // -----------------------------------------------------------------------------------
    // 12 — index.html servido para rota de SPA desconhecida
    // -----------------------------------------------------------------------------------
    await checar('12', 'index.html é servido para uma rota de SPA desconhecida', '200 text/html', async () => {
      const r = await fetch(`${base}/conversa/qualquer-coisa`)
      const tipo = r.headers.get('content-type') ?? ''
      return `${r.status} ${tipo.startsWith('text/html') ? 'text/html' : tipo}`
    })

    // -----------------------------------------------------------------------------------
    // Tabela final
    // -----------------------------------------------------------------------------------
    console.log('| # | verificação | esperado | obtido | |')
    console.log('|---|---|---|---|---|')
    for (const r of resultados) {
      console.log(
        `| ${r.id} | ${r.descricao} | \`${r.esperado}\` | \`${r.obtido}\` | ${r.passou ? 'OK' : 'FALHOU'} |`,
      )
    }
    console.log('')

    if (raizEstatica.temporaria) {
      console.log(
        'AVISO: apps/web/dist não existe nesta árvore (rode a Etapa 17 antes, se quiser testar o build ' +
          'de verdade) — os itens 11 e 12 rodaram contra uma pasta temporária com um index.html de mentira.',
      )
      console.log('')
    }

    const falhas = resultados.filter((r) => !r.passou)
    if (falhas.length > 0) {
      console.log(`FALHARAM ${falhas.length} de ${resultados.length}: ${falhas.map((f) => f.id).join(', ')}`)
      process.exitCode = 1
    } else {
      console.log(`TODAS AS ${resultados.length} VERIFICAÇÕES PASSARAM`)
      process.exitCode = 0
    }
  } finally {
    await fecharServidores()
    if (raizEstatica.temporaria) {
      await rm(raizEstatica.caminho, { recursive: true, force: true })
    }
  }
}

await main()
