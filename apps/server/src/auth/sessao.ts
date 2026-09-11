import { randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Sessão em memória de processo (decisão D3 do plano da Fase 4): sem banco, porque não há
 * banco neste repositório e a spec não pede um. Reiniciar o servidor derruba as duas
 * sessões e as duas pessoas entram de novo — custo aceito, documentado em `docs/SECURITY.md`.
 *
 * Token opaco: 32 bytes aleatórios em base64url. Não carrega nenhum dado — não é JWT, não
 * dá para decodificar nada dele.
 */

export interface SessaoDeConta {
  readonly idDaConta: string
  readonly criadaEm: Date
  readonly expiraEm: Date
}

export type ResultadoDeValidacao =
  | { estado: 'valida'; sessao: SessaoDeConta }
  /** Existiu e o TTL passou. Diferente de "nunca existiu": a tela mostra frases distintas. */
  | { estado: 'expirada' }
  /** Token desconhecido — nunca criado, já encerrado, ou adulterado. */
  | { estado: 'inexistente' }

const TTL_PADRAO_MS = 12 * 60 * 60 * 1000 // 12 horas

function gerarTokenPadrao(): string {
  return randomBytes(32).toString('base64url')
}

/** Compara dois tokens em tempo constante. Tamanhos diferentes são tratados como
 * recusa ANTES de comparar — `timingSafeEqual` lança se os buffers não tiverem o mesmo
 * tamanho, e deixar isso vazar por exceção seria voltar a vazar a diferença de tamanho. */
function tokensIguais(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export class ArmazemDeSessoes {
  private readonly sessoes = new Map<string, SessaoDeConta>()
  private readonly now: () => Date
  private readonly ttlMs: number
  private readonly gerarToken: () => string

  constructor(opcoes?: { now?: () => Date; ttlMs?: number; gerarToken?: () => string }) {
    this.now = opcoes?.now ?? (() => new Date())
    this.ttlMs = opcoes?.ttlMs ?? TTL_PADRAO_MS
    this.gerarToken = opcoes?.gerarToken ?? gerarTokenPadrao
  }

  criar(idDaConta: string): { token: string; sessao: SessaoDeConta } {
    this.limparExpiradas()
    const token = this.gerarToken()
    const criadaEm = this.now()
    const sessao: SessaoDeConta = {
      idDaConta,
      criadaEm,
      expiraEm: new Date(criadaEm.getTime() + this.ttlMs),
    }
    this.sessoes.set(token, sessao)
    return { token, sessao }
  }

  /** Varredura simples: remove do `Map` toda sessão cujo `expiraEm` já passou. Chamada em
   * `criar()` — sem isso, o `Map` só cresce, e nunca há um momento natural em que um
   * token expirado precise sumir sozinho (ele já é recusado por `validar()`). */
  private limparExpiradas(): void {
    const agora = this.now().getTime()
    for (const [token, sessao] of this.sessoes) {
      if (agora >= sessao.expiraEm.getTime()) this.sessoes.delete(token)
    }
  }

  /** A fronteira é fechada: expirar EXATAMENTE no instante do TTL já conta como expirada.
   * "Ainda válida" exige `agora < expiraEm`, nunca `<=` — o instante do limite não é mais
   * seguro que o instante seguinte. */
  validar(token: string): ResultadoDeValidacao {
    let encontrada: SessaoDeConta | undefined
    for (const [tokenArmazenado, sessao] of this.sessoes) {
      if (tokensIguais(tokenArmazenado, token)) {
        encontrada = sessao
        break
      }
    }
    if (!encontrada) return { estado: 'inexistente' }

    const agora = this.now()
    if (agora.getTime() >= encontrada.expiraEm.getTime()) return { estado: 'expirada' }

    return { estado: 'valida', sessao: encontrada }
  }

  encerrar(token: string): void {
    for (const tokenArmazenado of this.sessoes.keys()) {
      if (tokensIguais(tokenArmazenado, token)) {
        this.sessoes.delete(tokenArmazenado)
        return
      }
    }
  }
}
