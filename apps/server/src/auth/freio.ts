/**
 * Freio de tentativas de entrada.
 *
 * Sem biblioteca e sem janela deslizante sofisticada — a spec da Fase 4 põe isso fora de
 * escopo, porque há exatamente duas contas conhecidas.
 *
 * A classe conhece só **uma** chave por contador — genérica, de propósito. Dois
 * contadores independentes, no mesmo espírito do `auth.service.ts` do Workspace (citado na
 * spec como leitura de referência, não como código a copiar), nascem de quem chama esta
 * classe **duas vezes** por tentativa (Etapa 9, `rotas.ts`), com chaves diferentes:
 *
 * - `IP + e-mail`: freia quem já sabe o e-mail e está tentando adivinhar a senha.
 * - `IP` sozinho: freia quem está tentando e-mails diferentes a partir do mesmo lugar,
 *   mesmo sem repetir o e-mail — por isso o limite deste é mais largo.
 *
 * Estado em `Map`, memória de processo (decisão D3 do plano). Não precisa de limpeza
 * agendada: a janela é verificada na leitura, e o `Map` é limitado na prática por só haver
 * duas contas — não há como ele crescer sem limite dentro do uso real deste sistema.
 */

/** Limite de falhas e duração da janela padrão do freio. */
export const LIMITE_DE_FALHAS = 5
export const JANELA_MS = 15 * 60 * 1000

interface Contador {
  falhas: number
  desdeMs: number
}

export interface OpcoesFreioDeTentativas {
  now?: () => Date
  /** Falhas toleradas dentro da janela antes de bloquear. Padrão: `LIMITE_DE_FALHAS`. */
  limite?: number
  /** Duração da janela, em milissegundos. Padrão: `JANELA_MS`. */
  janelaMs?: number
}

export class FreioDeTentativas {
  private readonly now: () => Date
  private readonly limite: number
  private readonly janelaMs: number
  private readonly contadores = new Map<string, Contador>()

  constructor(opcoes: OpcoesFreioDeTentativas = {}) {
    this.now = opcoes.now ?? (() => new Date())
    this.limite = opcoes.limite ?? LIMITE_DE_FALHAS
    this.janelaMs = opcoes.janelaMs ?? JANELA_MS
  }

  /** Registra uma tentativa que falhou para a chave dada. */
  registrarFalha(chave: string): void {
    const agora = this.now().getTime()
    const existente = this.contadores.get(chave)
    if (existente === undefined || agora - existente.desdeMs >= this.janelaMs) {
      this.contadores.set(chave, { falhas: 1, desdeMs: agora })
      return
    }
    existente.falhas += 1
  }

  /** `true` se a chave estiver, dentro da janela atual, no limite de falhas ou acima. */
  estaBloqueado(chave: string): boolean {
    const contador = this.contadores.get(chave)
    if (contador === undefined) return false
    const agora = this.now().getTime()
    if (agora - contador.desdeMs >= this.janelaMs) return false
    return contador.falhas >= this.limite
  }

  /** Chamado no login bem-sucedido: apaga o contador daquela chave. */
  limpar(chave: string): void {
    this.contadores.delete(chave)
  }
}
