/**
 * Freio de tentativas de entrada.
 *
 * Sem biblioteca e sem janela deslizante sofisticada — a spec da Fase 4 põe isso fora de
 * escopo, porque há exatamente duas contas conhecidas.
 *
 * A classe conhece só **uma** chave por contador — genérica, de propósito. Três
 * contadores independentes, no mesmo espírito do `auth.service.ts` do Workspace (citado na
 * spec como leitura de referência, não como código a copiar), nascem de quem chama esta
 * classe em `rotas.ts`, com chaves diferentes:
 *
 * - `IP + e-mail`: freia quem já sabe o e-mail e está tentando adivinhar a senha. Só
 *   existe para e-mail de conta conhecida — e-mail desconhecido não cria chave nenhuma
 *   aqui, para o `Map` não crescer sem limite com e-mails inventados por um atacante.
 * - `IP` sozinho: freia quem está tentando e-mails diferentes a partir do mesmo lugar,
 *   mesmo sem repetir o e-mail.
 * - `e-mail` sozinho (instância separada, `LIMITE_DE_FALHAS_POR_EMAIL`, mais largo): freia
 *   quem troca de IP a cada tentativa para contornar os dois primeiros. Mesma disciplina
 *   de e-mail conhecido — desconhecido não cria chave.
 *
 * Estado em `Map`, memória de processo (decisão D3 do plano). Não precisa de limpeza
 * agendada: a janela é verificada na leitura, e o `Map` fica limitado na prática — as
 * chaves de e-mail só existem para as duas contas conhecidas, e a de IP cresce só com o
 * tráfego real que chega ao processo.
 */

/** Limite de falhas e duração da janela padrão do freio. */
export const LIMITE_DE_FALHAS = 5
export const JANELA_MS = 15 * 60 * 1000

/**
 * Limite do terceiro contador de `rotas.ts`, chaveado só por e-mail normalizado (sem IP)
 * — freia quem troca de IP a cada tentativa para contornar os outros dois contadores.
 * Mais largo que `LIMITE_DE_FALHAS`: a mesma pessoa errando a senha em redes diferentes
 * (celular alternando com Wi-Fi) não pode se bloquear sozinha, mas um ataque de milhares
 * de tentativas ainda para.
 */
export const LIMITE_DE_FALHAS_POR_EMAIL = 20

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

  /**
   * Operação atômica: devolve se a chave JÁ ESTAVA bloqueada pelas falhas anteriores, e só
   * depois registra esta tentativa. A ordem importa: checar o estado ANTES de registrar
   * preserva "N falhas toleradas, bloqueado a partir da (N+1)-ésima" — checar depois
   * contaria a própria tentativa atual contra o limite dela e bloquearia uma tentativa
   * cedo demais. Chamado ANTES do `await` de verificação de senha (CPU-bound) em
   * `rotas.ts` — como as duas operações daqui são síncronas (sem `await` entre elas), não
   * há brecha para tentativas paralelas passarem pela checagem antes de qualquer uma
   * registrar, driblando o limite. Login bem-sucedido chama `limpar()` em seguida,
   * desfazendo o incremento desta própria tentativa.
   */
  tentarRegistrar(chave: string): boolean {
    const jaBloqueada = this.estaBloqueado(chave)
    this.registrarFalha(chave)
    return jaBloqueada
  }

  /** Chamado no login bem-sucedido: apaga o contador daquela chave. */
  limpar(chave: string): void {
    this.contadores.delete(chave)
  }
}
