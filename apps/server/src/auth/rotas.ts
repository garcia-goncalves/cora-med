import type { IncomingMessage, ServerResponse } from 'node:http'
import { PedidoDeEntradaSchema, type RespostaDeEntrada, type SessaoDoUsuario } from '@cora/contracts'

import { erroDeCategoria, traduzirFalha, type RespostaDeErro } from '../http/erros.js'
import type { ContaConfigurada } from './contas.js'
import { lerCookie, nomeCookieSessao, serializarCookieDeSaida, serializarCookieDeSessao } from './cookie.js'
import type { FreioDeTentativas } from './freio.js'
import { conferirGastandoTempo, type PortaDeHashDeSenha } from './senha.js'
import type { ArmazemDeSessoes } from './sessao.js'

/**
 * Handlers de `POST /auth/entrar`, `POST /auth/sair` e `GET /auth/sessao`. O `server.ts`
 * só despacha para cá depois de confirmar Host, origem e método — nada disso é
 * responsabilidade destes handlers.
 */

/** Teto de tamanho do corpo de `POST /auth/entrar`: e-mail e senha nunca precisam disto. */
const MAX_BYTES_CORPO_AUTH = 8 * 1024

export interface DependenciasDeAuth {
  readonly contas: readonly ContaConfigurada[]
  readonly armazemDeSessoes: ArmazemDeSessoes
  readonly freio: FreioDeTentativas
  /** Terceiro contador (item 2 da revisão de segurança), chaveado só por e-mail
   * normalizado — freia quem troca de IP a cada tentativa. Instância separada porque o
   * limite é outro (`LIMITE_DE_FALHAS_POR_EMAIL`, mais largo). */
  readonly freioPorEmail: FreioDeTentativas
  readonly portaDeHash: PortaDeHashDeSenha
  /** `true` só em desenvolvimento (`CORA_COOKIE_INSEGURO=1`). Padrão: cookie `Secure`. */
  readonly cookieInseguro?: boolean
  /**
   * `true` só quando o processo roda atrás de um proxy reverso confiável
   * (`CORA_PROXY_CONFIAVEL=1`, publicação na TineHost — `docs/publicacao/tinehost.md`).
   * Nesse caso `ipDaRequisicao` lê `X-Forwarded-For`, porque `req.socket.remoteAddress`
   * seria sempre o IP do proxy, o mesmo para toda requisição — o que faria o freio
   * bloquear todo mundo com 5 tentativas de qualquer um. Sem a variável, comportamento
   * inalterado: `req.socket.remoteAddress`, porque sem proxy confirmado o cabeçalho
   * `X-Forwarded-For` pode ser forjado por qualquer cliente.
   */
  readonly proxyConfiavel?: boolean
}

class CorpoGrandeDemaisError extends Error {}

function enviar(res: ServerResponse, status: number, corpo: unknown, cabecalhos?: Record<string, string>): void {
  if (cabecalhos) {
    for (const [nome, valor] of Object.entries(cabecalhos)) res.setHeader(nome, valor)
  }
  const texto = JSON.stringify(corpo)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(texto)
}

function enviarErro(res: ServerResponse, resposta: RespostaDeErro): void {
  enviar(res, resposta.status, resposta.corpo)
}

async function lerCorpo(req: IncomingMessage): Promise<string> {
  const pedacos: Buffer[] = []
  let total = 0
  for await (const pedaco of req) {
    const buf = pedaco as Buffer
    total += buf.length
    if (total > MAX_BYTES_CORPO_AUTH) {
      throw new CorpoGrandeDemaisError()
    }
    pedacos.push(buf)
  }
  return Buffer.concat(pedacos).toString('utf8')
}

/**
 * Primeiro endereço de uma lista `X-Forwarded-For` (`cliente, proxy1, proxy2, ...`).
 * Cabeçalho ausente ou vazio devolve `undefined` — quem chama cai de volta no socket.
 */
function primeiroIpEncaminhado(cabecalho: string | string[] | undefined): string | undefined {
  const valor = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho
  if (!valor) return undefined
  const primeiro = valor.split(',')[0]?.trim()
  return primeiro || undefined
}

function ipDaRequisicao(req: IncomingMessage, proxyConfiavel?: boolean): string {
  if (proxyConfiavel) {
    const encaminhado = primeiroIpEncaminhado(req.headers['x-forwarded-for'])
    if (encaminhado) return encaminhado
  }
  return req.socket.remoteAddress ?? 'desconhecido'
}

function sessaoParaCliente(conta: ContaConfigurada): SessaoDoUsuario {
  return { idDaConta: conta.id, nome: conta.nome, email: conta.email }
}

export async function tratarEntrar(
  req: IncomingMessage,
  res: ServerResponse,
  deps: DependenciasDeAuth,
): Promise<void> {
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

  const parsed = PedidoDeEntradaSchema.safeParse(corpoBruto)
  if (!parsed.success) {
    enviarErro(res, traduzirFalha(parsed.error))
    return
  }

  const { email, senha } = parsed.data
  const emailNormalizado = email.trim().toLowerCase()
  const ip = ipDaRequisicao(req, deps.proxyConfiavel)

  const conta = deps.contas.find((c) => c.email === emailNormalizado)
  // Chave de e-mail (par com IP e sozinha) só existe para conta conhecida — e-mail
  // inventado por um atacante não cria entrada nenhuma nesses dois `Map`s (item 7 da
  // revisão de segurança: sem isso, e-mails distintos fariam o freio crescer sem limite).
  const chaveIpEmail = conta ? `${ip}:${emailNormalizado}` : undefined
  const chaveEmail = conta ? `email:${emailNormalizado}` : undefined

  // Registro ATÔMICO, ANTES do `await` de verificação de senha (CPU-bound): se o registro
  // só acontecesse depois, tentativas paralelas com a mesma chave passariam todas pela
  // checagem antes de qualquer uma registrar (item 6 da revisão de segurança). Não há
  // defesa de tempo a manter aqui — a resposta já diz "bloqueado", nunca "senha errada".
  const bloqueadoPorIp = deps.freio.tentarRegistrar(ip)
  const bloqueadoPorIpEmail = chaveIpEmail ? deps.freio.tentarRegistrar(chaveIpEmail) : false
  const bloqueadoPorEmail = chaveEmail ? deps.freioPorEmail.tentarRegistrar(chaveEmail) : false

  if (bloqueadoPorIp || bloqueadoPorIpEmail || bloqueadoPorEmail) {
    enviarErro(res, erroDeCategoria('bloqueado_por_tentativas'))
    return
  }

  let senhaConfere: boolean
  if (conta) {
    senhaConfere = await deps.portaDeHash.conferir(conta.hashDeSenha, senha)
  } else {
    // Conta inexistente: confere contra o hash-isca para gastar o mesmo tempo — quem
    // ataca não aprende, pelo relógio, se o e-mail existe.
    await conferirGastandoTempo(deps.portaDeHash, senha)
    senhaConfere = false
  }

  if (!conta || !senhaConfere) {
    enviarErro(res, erroDeCategoria('credenciais_invalidas'))
    return
  }

  // Login certo desfaz o incremento que `tentarRegistrar` fez para esta própria
  // tentativa — o freio só deve lembrar de FALHAS.
  deps.freio.limpar(ip)
  if (chaveIpEmail) deps.freio.limpar(chaveIpEmail)
  if (chaveEmail) deps.freioPorEmail.limpar(chaveEmail)

  const { token, sessao } = deps.armazemDeSessoes.criar(conta.id)
  const maxIdadeSegundos = Math.max(
    0,
    Math.round((sessao.expiraEm.getTime() - sessao.criadaEm.getTime()) / 1000),
  )
  const cookie = serializarCookieDeSessao(token, {
    maxIdadeSegundos,
    inseguro: deps.cookieInseguro,
  })

  const resposta: RespostaDeEntrada = { sessao: sessaoParaCliente(conta) }
  enviar(res, 200, resposta, { 'Set-Cookie': cookie })
}

export function tratarSair(req: IncomingMessage, res: ServerResponse, deps: DependenciasDeAuth): void {
  const token = lerCookie(req.headers.cookie, nomeCookieSessao(deps.cookieInseguro))
  if (token) {
    deps.armazemDeSessoes.encerrar(token)
  }
  const cookie = serializarCookieDeSaida({ inseguro: deps.cookieInseguro })
  enviar(res, 200, { ok: true }, { 'Set-Cookie': cookie })
}

export function tratarSessao(req: IncomingMessage, res: ServerResponse, deps: DependenciasDeAuth): void {
  const token = lerCookie(req.headers.cookie, nomeCookieSessao(deps.cookieInseguro))
  if (!token) {
    enviarErro(res, erroDeCategoria('sessao_ausente'))
    return
  }

  const resultado = deps.armazemDeSessoes.validar(token)
  if (resultado.estado === 'inexistente') {
    enviarErro(res, erroDeCategoria('sessao_ausente'))
    return
  }
  if (resultado.estado === 'expirada') {
    enviarErro(res, erroDeCategoria('sessao_expirada'))
    return
  }

  const conta = deps.contas.find((c) => c.id === resultado.sessao.idDaConta)
  if (!conta) {
    // Conta removida da configuração depois de a sessão ter sido emitida: trata como se
    // nunca tivesse existido, nunca vaza o motivo.
    enviarErro(res, erroDeCategoria('sessao_ausente'))
    return
  }

  enviar(res, 200, { sessao: sessaoParaCliente(conta) })
}
