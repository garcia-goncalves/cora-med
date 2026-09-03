/**
 * Preço de modelo, verificado na fonte e datado.
 *
 * A regra do briefing (seção 12) é dura e é o motivo deste arquivo existir: **sem preço
 * conhecido, o custo é `null` — desconhecido, nunca zero.** Um zero silencioso vira
 * relatório de custo que mente para baixo, e ninguém audita um número que parece bom.
 *
 * Ver `docs/decisions/0002-provedor-de-modelo.md`.
 */

/** Data em que a tabela abaixo foi lida na página oficial de preços. */
export const PRECOS_VERIFICADOS_EM = '2026-09-03'

/** De onde os números vieram. Fica no código para que a próxima pessoa confira o mesmo lugar. */
export const PRECOS_FONTE = 'https://platform.claude.com/docs/en/about-claude/pricing'

/**
 * Depois disto a tabela é velha demais para ser afirmada. Há teste que falha nesse
 * ponto — ele não adivinha o preço novo, ele obriga alguém a ir conferir.
 */
export const PRECO_VALIDADE_DIAS = 180

/** Dólares por MILHÃO de tokens. */
export interface PrecoModelo {
  entrada: number
  saida: number
  escritaCache5m: number
  leituraCache: number
}

const TABELA: Readonly<Record<string, PrecoModelo>> = {
  'claude-opus-5': { entrada: 5, saida: 25, escritaCache5m: 6.25, leituraCache: 0.5 },
  'claude-sonnet-5': { entrada: 2, saida: 10, escritaCache5m: 2.5, leituraCache: 0.2 },
  'claude-haiku-4-5': { entrada: 1, saida: 5, escritaCache5m: 1.25, leituraCache: 0.1 },
}

export function precoDe(model: string): PrecoModelo | null {
  // `Object.hasOwn`, não indexação direta: um nome como `constructor` ou `toString` vem
  // da cadeia de protótipos, passa como valor verdadeiro e produz NaN com data de
  // verificação preenchida — exatamente a mentira que este arquivo existe para impedir.
  return Object.hasOwn(TABELA, model) ? TABELA[model]! : null
}

/** Tokens gastos num passo, como o provedor os reporta. */
export interface UsoTokens {
  entrada: number
  saida: number
  leituraCache: number
  escritaCache: number
}

export interface CustoPasso {
  model: string
  uso: UsoTokens
  /** `null` quando o preço do modelo não é conhecido. NUNCA zero por ausência de preço. */
  custoUsd: number | null
  /** Data da verificação do preço usado. `null` quando não houve preço. */
  precoVerificadoEm: string | null
}

/**
 * Custo em dólares de um passo. `custoUsd` é `null` — e não `0` — quando o modelo não
 * está na tabela. Um passo que de fato não gastou nada tem uso zerado e custo `0`,
 * que é uma afirmação diferente de "não sei".
 */
export function calcularCusto(model: string, uso: UsoTokens): CustoPasso {
  const preco = precoDe(model)
  if (!preco) {
    return { model, uso, custoUsd: null, precoVerificadoEm: null }
  }
  const porMilhao = (tokens: number, precoUnitario: number) => (tokens / 1_000_000) * precoUnitario
  const custoUsd =
    porMilhao(uso.entrada, preco.entrada) +
    porMilhao(uso.saida, preco.saida) +
    porMilhao(uso.leituraCache, preco.leituraCache) +
    porMilhao(uso.escritaCache, preco.escritaCache5m)
  return { model, uso, custoUsd, precoVerificadoEm: PRECOS_VERIFICADOS_EM }
}

/** Quantos dias fazem desde a verificação. Usado pelo teste de validade da tabela. */
export function diasDesdeVerificacao(hoje: Date): number {
  const verificado = new Date(`${PRECOS_VERIFICADOS_EM}T00:00:00Z`)
  return Math.floor((hoje.getTime() - verificado.getTime()) / 86_400_000)
}
