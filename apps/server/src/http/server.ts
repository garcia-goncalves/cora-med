import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { CONTRACT_VERSION } from '@cora/contracts'

import type { MotorPort } from '../engine/port.js'
import { runTurn, DEFAULT_LIMITS, type TurnLimits } from '../run/turn.js'
import type { ToolRegistry } from '../tools/registry.js'
import { type DependenciasDeAuth, tratarEntrar, tratarSair, tratarSessao } from '../auth/rotas.js'
import { NOME_COOKIE_SESSAO, lerCookie } from '../auth/cookie.js'
import type { ArmazemDeSessoes } from '../auth/sessao.js'
import { PedidoDeTurnoSchema, montarRequester } from './contrato.js'
import { descreverParaLog, erroDeCategoria, traduzirFalha, type RespostaDeErro } from './erros.js'
import { resolverArquivoEstatico, type ResultadoEstatico } from './estaticos.js'

/** Teto do corpo de `POST /turno`. Sem isto, a primeira porta de rede desta casa é
 * derrubável com um único POST grande — antes de o motor ou o Zod verem qualquer coisa. */
export const MAX_BYTES_CORPO = 64 * 1024

export interface DependenciasHttp {
  /**
   * Devolve o `ToolRegistry` da conta autenticada, ou `undefined` se o id não corresponde a
   * nenhuma conta configurada (ex.: sessão emitida para uma conta removida depois). Um
   * registry por conta (decisão D2 da Fase 4) — nunca compartilhado entre pessoas, porque
   * cada um fala com o Workspace pelo token de delegação daquela conta.
   */
  registryDaConta: (idDaConta: string) => ToolRegistry | undefined
  /** Onde `POST /turno` valida o cookie de sessão. Obrigatório: a partir da Etapa 10 da
   * Fase 4, quem conversa com a Cora é sempre a pessoa autenticada. */
  armazemDeSessoes: ArmazemDeSessoes
  /** Chamado UMA VEZ por requisição de turno. Nunca reaproveitar entre requisições —
   * ver o comentário dentro do handler de `POST /turno`. */
  criarMotor: () => MotorPort
  limits?: TurnLimits
  now?: () => Date
  gerarRunId?: () => string
  /** Destino do texto de log — mensagem original de erro, nunca exposta ao cliente HTTP. */
  registrar?: (linha: string) => void
  /**
   * Nomes de host aceitos no cabeçalho `Host` (sem porta). Padrão: `127.0.0.1` e
   * `localhost`. Existe por causa de DNS rebinding: bind em `127.0.0.1` sozinho NÃO
   * impede que uma página em `http://dominio-do-atacante:PORTA` (DNS reapontado para
   * 127.0.0.1 depois do primeiro acesso) fale com este servidor como se fosse
   * same-origin — o navegador olha esquema+host+porta, não para onde o socket resolve.
   * Sem esta checagem, "escuta só em 127.0.0.1" (`docs/OPERATIONS.md`) seria uma garantia
   * falsa: o socket é local, mas a origem que consegue falar com ele não precisa ser.
   */
  hostsPermitidos?: readonly string[]
  /**
   * Ausente: `/auth/*` some do roteamento (404 `rota_desconhecida`), como os 20 testes
   * existentes deste arquivo já esperam. Presente: entra `POST /auth/entrar`,
   * `POST /auth/sair` e `GET /auth/sessao`.
   */
  auth?: DependenciasDeAuth
  /**
   * Pasta com o build da SPA (Etapa 11 da Fase 4). Ausente: nenhuma rota estática existe,
   * e qualquer caminho não reconhecido continua sendo `rota_desconhecida`, 404 tipado —
   * o comportamento que os testes desta suíte já esperavam antes desta etapa. Presente:
   * todo caminho que não bate com `/health`, `/turno` nem `/auth/*` passa por
   * `resolverArquivoEstatico` (`estaticos.ts`), que decide entre servir o arquivo, cair
   * no `index.html` (SPA) ou recusar.
   */
  raizEstatica?: string
}

/** Exportado para `boot.ts`: a lista configurável por `CORA_HOSTS_PERMITIDOS` (Etapa 11
 * da Fase 4) sempre ACRESCENTA a esta lista, nunca a substitui — perder `localhost` ou
 * `127.0.0.1` quebraria o desenvolvimento local. */
export const HOSTS_PERMITIDOS_PADRAO = ['127.0.0.1', 'localhost', '[::1]', '::1']

function enviar(res: ServerResponse, status: number, corpo: unknown): void {
  const texto = JSON.stringify(corpo)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(texto)
}

function enviarErro(res: ServerResponse, resposta: RespostaDeErro, cabecalhos?: Record<string, string>): void {
  if (cabecalhos) {
    for (const [nome, valor] of Object.entries(cabecalhos)) res.setHeader(nome, valor)
  }
  enviar(res, resposta.status, resposta.corpo)
}

async function lerCorpo(req: IncomingMessage): Promise<string> {
  const pedacos: Buffer[] = []
  let total = 0
  for await (const pedaco of req) {
    const buf = pedaco as Buffer
    total += buf.length
    if (total > MAX_BYTES_CORPO) {
      // NÃO destrua o socket aqui: `req` e `res` compartilham a mesma conexão em
      // HTTP/1.1, e destruir o socket derruba a conexão antes de o 413 sair — o
      // cliente veria "conexão fechada", não uma resposta. Só para de ler; a resposta
      // sai normalmente pelo `catch` de quem chamou.
      throw new CorpoGrandeDemaisError()
    }
    pedacos.push(buf)
  }
  return Buffer.concat(pedacos).toString('utf8')
}

class CorpoGrandeDemaisError extends Error {}

/** Transmite o arquivo já resolvido por `resolverArquivoEstatico`. Não usa `enviar()`
 * (fixa `Content-Type: application/json`) nem carrega o arquivo inteiro em memória antes
 * de escrever — `createReadStream` + `pipe` funciona igual para o HTML de alguns KB e
 * para um asset maior, sem duplicar o conteúdo em memória. */
async function enviarArquivoEstatico(
  res: ServerResponse,
  resultado: Extract<ResultadoEstatico, { estado: 'resolvido' }>,
): Promise<void> {
  res.writeHead(200, {
    'Content-Type': resultado.tipoDeConteudo,
    'Cache-Control': resultado.cacheControl,
  })
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const leitura = createReadStream(resultado.caminhoAbsoluto)
    leitura.on('error', rejectPromise)
    leitura.on('end', resolvePromise)
    leitura.pipe(res)
  })
}

async function tratarTurno(req: IncomingMessage, res: ServerResponse, deps: DependenciasHttp): Promise<void> {
  const registrar = deps.registrar ?? ((linha: string) => console.error(linha))
  const controller = new AbortController()
  const onClose = () => controller.abort()
  res.on('close', onClose)

  try {
    // A identidade de quem fala vem SEMPRE da sessão, nunca do corpo — checado antes de
    // ler ou validar o corpo, para que um pedido sem sessão nunca chegue a gastar tempo
    // com Zod nem com o motor.
    const token = lerCookie(req.headers.cookie, NOME_COOKIE_SESSAO)
    if (!token) {
      enviarErro(res, erroDeCategoria('sessao_ausente'))
      return
    }

    const resultadoDaSessao = deps.armazemDeSessoes.validar(token)
    if (resultadoDaSessao.estado === 'inexistente') {
      enviarErro(res, erroDeCategoria('sessao_ausente'))
      return
    }
    if (resultadoDaSessao.estado === 'expirada') {
      enviarErro(res, erroDeCategoria('sessao_expirada'))
      return
    }

    const idDaConta = resultadoDaSessao.sessao.idDaConta
    const registry = deps.registryDaConta(idDaConta)
    if (!registry) {
      // Sessão válida, mas a conta some da configuração de quem chama — trata como se
      // nunca tivesse existido, mesma disciplina de `auth/rotas.ts:tratarSessao`.
      enviarErro(res, erroDeCategoria('sessao_ausente'))
      return
    }

    const contentType = req.headers['content-type'] ?? ''
    if (!contentType.toLowerCase().startsWith('application/json')) {
      enviarErro(res, erroDeCategoria('tipo_nao_suportado'))
      return
    }

    let corpoTexto: string
    try {
      corpoTexto = await lerCorpo(req)
    } catch (cause) {
      if (cause instanceof CorpoGrandeDemaisError) {
        enviarErro(res, erroDeCategoria('corpo_grande_demais'))
        return
      }
      throw cause
    }

    let corpoBruto: unknown
    try {
      corpoBruto = JSON.parse(corpoTexto)
    } catch {
      enviarErro(res, erroDeCategoria('corpo_ilegivel'))
      return
    }

    const parsed = PedidoDeTurnoSchema.safeParse(corpoBruto)
    if (!parsed.success) {
      enviarErro(res, traduzirFalha(parsed.error))
      return
    }

    const requester = montarRequester(parsed.data, idDaConta, deps.gerarRunId ?? randomUUID)

    // Um motor NOVO por requisição, criado aqui dentro — nunca fora do handler. Um motor
    // de processo único (ex.: `const motor = deps.criarMotor()` no boot) levaria o
    // histórico de uma conversa para a resposta de outra pessoa: ver o comentário de
    // `exigirMesmoTurno` em `engine/anthropic-adapter.ts`.
    const motor = deps.criarMotor()

    const outcome = await runTurn({
      motor,
      registry,
      requester,
      messages: [{ role: 'user', content: parsed.data.mensagem }],
      limits: deps.limits ?? DEFAULT_LIMITS,
      now: deps.now,
      signal: controller.signal,
    })

    enviar(res, 200, { runId: requester.runId, outcome })
  } catch (cause) {
    registrar(descreverParaLog(cause))
    if (!res.headersSent) {
      enviarErro(res, traduzirFalha(cause))
    }
  } finally {
    res.off('close', onClose)
  }
}

/**
 * Cria o servidor HTTP da Cora. Node `http` nativo — sem framework novo, porque não há
 * nenhum instalado no monorepo hoje e o gargalo real de qualquer chamada é o provedor de
 * modelo (segundos), não o roteamento HTTP (microssegundos).
 *
 * ⚠️ Quem chama `.listen()` neste servidor tem de passar o host explicitamente
 * (`server.listen(porta, '127.0.0.1', ...)`, como `http/main.ts` já faz). `.listen(porta)`
 * sozinho aceita conexão de `0.0.0.0` — todas as interfaces, não só local.
 */
export function criarServidorHttp(deps: DependenciasHttp) {
  const server = createServer((req, res) => {
    void handleRequest(req, res, deps)
  })

  // `requestTimeout` maior que o teto de tempo do turno (`maxRunSeconds`, padrão 120s):
  // sem isso o Node cortaria a requisição ANTES de o teto da aplicação atuar, e o
  // cancelamento pareceria vir do teto quando na verdade veio do Node.
  server.requestTimeout = 150_000
  server.headersTimeout = 155_000

  return server
}

/** Extrai só o hostname do cabeçalho `Host` (`exemplo.com:4320` → `exemplo.com`). */
function hostnameDoCabecalho(hostHeader: string | undefined): string {
  if (!hostHeader) return ''
  if (hostHeader.startsWith('[')) {
    // IPv6 entre colchetes: "[::1]:4320" ou "[::1]".
    const fim = hostHeader.indexOf(']')
    return fim === -1 ? hostHeader : hostHeader.slice(0, fim + 1)
  }
  const doisPontos = hostHeader.indexOf(':')
  return doisPontos === -1 ? hostHeader : hostHeader.slice(0, doisPontos)
}

async function handleRequest(req: IncomingMessage, res: ServerResponse, deps: DependenciasHttp): Promise<void> {
  // Nada do que este processo serve é indexável — nem a SPA, nem `/health`, nem `/turno`
  // (`estrategia_de_aquisicao`, item 1). Um lugar só, antes de qualquer roteamento, para
  // que nenhuma resposta escape sem o cabeçalho.
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')

  try {
    const hostsPermitidos = deps.hostsPermitidos ?? HOSTS_PERMITIDOS_PADRAO
    const hostname = hostnameDoCabecalho(req.headers.host)
    if (!hostsPermitidos.includes(hostname)) {
      enviarErro(res, erroDeCategoria('host_nao_permitido'))
      return
    }

    const url = new URL(req.url ?? '/', 'http://localhost')
    const metodo = req.method ?? 'GET'

    // Verificação de origem no POST (decisão 8 da spec da Fase 4) — a parte de CSRF que
    // `SameSite=Lax` não cobre. `Origin` AUSENTE não é recusa: cliente não-navegador,
    // como o teste e o `curl`, não manda esse cabeçalho.
    if (metodo === 'POST') {
      const origem = req.headers.origin
      if (origem) {
        let hostnameDaOrigem: string
        try {
          hostnameDaOrigem = new URL(origem).hostname
        } catch {
          enviarErro(res, erroDeCategoria('host_nao_permitido'))
          return
        }
        if (hostnameDaOrigem !== hostname) {
          enviarErro(res, erroDeCategoria('host_nao_permitido'))
          return
        }
      }
    }

    if (url.pathname === '/health') {
      if (metodo !== 'GET') {
        enviarErro(res, erroDeCategoria('metodo_nao_permitido'), { Allow: 'GET' })
        return
      }
      enviar(res, 200, { status: 'ok', contrato: CONTRACT_VERSION })
      return
    }

    if (url.pathname === '/turno') {
      if (metodo !== 'POST') {
        enviarErro(res, erroDeCategoria('metodo_nao_permitido'), { Allow: 'POST' })
        return
      }
      await tratarTurno(req, res, deps)
      return
    }

    if (deps.auth) {
      if (url.pathname === '/auth/entrar') {
        if (metodo !== 'POST') {
          enviarErro(res, erroDeCategoria('metodo_nao_permitido'), { Allow: 'POST' })
          return
        }
        await tratarEntrar(req, res, deps.auth)
        return
      }

      if (url.pathname === '/auth/sair') {
        if (metodo !== 'POST') {
          enviarErro(res, erroDeCategoria('metodo_nao_permitido'), { Allow: 'POST' })
          return
        }
        tratarSair(req, res, deps.auth)
        return
      }

      if (url.pathname === '/auth/sessao') {
        if (metodo !== 'GET') {
          enviarErro(res, erroDeCategoria('metodo_nao_permitido'), { Allow: 'GET' })
          return
        }
        tratarSessao(req, res, deps.auth)
        return
      }
    }

    // Fallback estático: só chega aqui quando o caminho não é `/health`, `/turno` nem
    // `/auth/*`. Sem `raizEstatica` configurada, comportamento inalterado — 404 tipado,
    // como os testes existentes desta suíte já esperam.
    if (deps.raizEstatica && metodo === 'GET') {
      const resultado = await resolverArquivoEstatico(url.pathname, deps.raizEstatica)
      if (resultado.estado === 'resolvido') {
        await enviarArquivoEstatico(res, resultado)
        return
      }
      // 'nao_encontrado' e 'recusado' (tentativa de travessia de caminho) saem os dois
      // como 404 tipado — quem tentou `..` não recebe pista nenhuma de que a defesa foi
      // essa e não outra.
      enviarErro(res, erroDeCategoria('rota_desconhecida'))
      return
    }

    enviarErro(res, erroDeCategoria('rota_desconhecida'))
  } catch (cause) {
    const registrar = deps.registrar ?? ((linha: string) => console.error(linha))
    registrar(descreverParaLog(cause))
    if (!res.headersSent) {
      enviarErro(res, traduzirFalha(cause))
    } else {
      res.end()
    }
  }
}
