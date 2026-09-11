/**
 * Camada de acesso ao servidor da Cora. Segue a mesma convenção de
 * `packages/workspace-client/src/client.ts`: `fetchImpl` injetável (nenhum teste desta
 * suíte usa o fetch real), caminhos relativos — nunca URL absoluta, que quebraria a
 * mesma origem em produção e o proxy do Vite em desenvolvimento (decisão D5 do plano) —,
 * e tradução de status em união discriminada, sem jogar exceção para a tela.
 *
 * Nunca devolve token de delegação nem hash: o servidor também não os envia
 * (`docs/esteira/.../spec.md`, decisão 2), e esta camada não teria onde guardá-los mesmo
 * que viessem.
 */

/** O que a tela pode saber sobre quem está logado. */
export interface SessaoDoUsuario {
  idDaConta: string
  nome: string
  email: string
}

/** Resposta de `POST /turno`. `outcome` não é validado aqui — quem interpreta o
 * resultado da conversa é a máquina de estados da Etapa 13, não esta camada. */
export interface RespostaDeTurno {
  runId: string
  outcome: unknown
}

/**
 * `sem_internet` e `servidor_indisponivel` são estados diferentes — o `design.md`
 * desenha telas diferentes para eles (banner reversível contra tela cheia). Fundi-los é
 * o erro que o repositório inteiro proíbe.
 */
export type ResultadoDoCliente<T> =
  | { status: 'sucesso'; dados: T }
  | { status: 'credenciais_invalidas' }
  | { status: 'bloqueado_por_tentativas' }
  | { status: 'sessao_expirada' }
  | { status: 'servidor_indisponivel' }
  | { status: 'sem_internet' }

type StatusDeErro = Exclude<ResultadoDoCliente<never>['status'], 'sucesso'>

export interface OpcoesDoClienteDaApi {
  /** Injetável para teste. */
  fetchImpl?: typeof fetch
  /**
   * Diz se o navegador está online. Recebido por parâmetro, nunca lido de `navigator`
   * dentro desta função — é o que deixa o teste independente de ambiente com DOM.
   */
  sinalDeConectividade?: () => boolean
}

export interface ClienteDaApi {
  entrar(email: string, senha: string): Promise<ResultadoDoCliente<SessaoDoUsuario>>
  sair(): Promise<ResultadoDoCliente<null>>
  obterSessao(): Promise<ResultadoDoCliente<SessaoDoUsuario>>
  enviarTurno(mensagem: string, deviceId: string | null): Promise<ResultadoDoCliente<RespostaDeTurno>>
}

const conectividadePadrao = (): boolean =>
  typeof navigator === 'undefined' ? true : navigator.onLine

export function criarClienteDaApi(opcoes: OpcoesDoClienteDaApi = {}): ClienteDaApi {
  const fetchImpl = opcoes.fetchImpl ?? globalThis.fetch
  const sinalDeConectividade = opcoes.sinalDeConectividade ?? conectividadePadrao

  async function chamar<T>(
    caminho: string,
    metodo: 'GET' | 'POST',
    corpo?: unknown,
  ): Promise<ResultadoDoCliente<T>> {
    let resposta: Response
    try {
      resposta = await fetchImpl(caminho, {
        method: metodo,
        credentials: 'include',
        headers: corpo === undefined ? {} : { 'Content-Type': 'application/json' },
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
      })
    } catch {
      // Falha de transporte: sem sinal de rede é "sem internet" (o design mostra um
      // banner reversível); com sinal de rede é o servidor que não respondeu (tela
      // cheia). Não dá para distinguir os dois só pelo `fetch` rejeitar.
      return { status: sinalDeConectividade() ? 'servidor_indisponivel' : 'sem_internet' }
    }

    if (resposta.ok) {
      const dados = (await lerJson(resposta)) as T
      return { status: 'sucesso', dados }
    }

    return { status: await categoriaDoErro(resposta) }
  }

  // O servidor devolve a sessão dentro de um envelope (`{ sessao: {...} }`), não solta —
  // desembrulha aqui, no único lugar que conhece o formato de transporte.
  async function chamarESairDoEnvelope(
    caminho: string,
    metodo: 'GET' | 'POST',
    corpo?: unknown,
  ): Promise<ResultadoDoCliente<SessaoDoUsuario>> {
    const resultado = await chamar<{ sessao: SessaoDoUsuario }>(caminho, metodo, corpo)
    if (resultado.status !== 'sucesso') return resultado
    return { status: 'sucesso', dados: resultado.dados.sessao }
  }

  return {
    entrar: (email, senha) => chamarESairDoEnvelope('/auth/entrar', 'POST', { email, senha }),
    sair: () => chamar('/auth/sair', 'POST'),
    obterSessao: () => chamarESairDoEnvelope('/auth/sessao', 'GET'),
    enviarTurno: (mensagem, deviceId) => chamar('/turno', 'POST', { mensagem, deviceId }),
  }
}

async function lerJson(resposta: Response): Promise<unknown> {
  try {
    return await resposta.json()
  } catch {
    return undefined
  }
}

/**
 * Traduz `{ erro: { categoria } }` (`apps/server/src/http/erros.ts`) para o estado da
 * tela. `sessao_ausente` e `sessao_expirada` viram o MESMO estado aqui: para quem usa a
 * tela, os dois pedem a mesma ação — entrar de novo.
 */
async function categoriaDoErro(resposta: Response): Promise<StatusDeErro> {
  const corpo = await lerJson(resposta)
  const categoria = categoriaDoCorpo(corpo)
  switch (categoria) {
    case 'credenciais_invalidas':
      return 'credenciais_invalidas'
    case 'bloqueado_por_tentativas':
      return 'bloqueado_por_tentativas'
    case 'sessao_ausente':
    case 'sessao_expirada':
      return 'sessao_expirada'
    default:
      return 'servidor_indisponivel'
  }
}

function categoriaDoCorpo(corpo: unknown): string | undefined {
  if (corpo === null || typeof corpo !== 'object' || !('erro' in corpo)) return undefined
  const erro = (corpo as { erro?: unknown }).erro
  if (erro === null || typeof erro !== 'object' || !('categoria' in erro)) return undefined
  const categoria = (erro as { categoria?: unknown }).categoria
  return typeof categoria === 'string' ? categoria : undefined
}
