/**
 * Custo do motor de TESTE (Gemini), documentado do mesmo jeito que `pricing.ts`.
 *
 * Ver `docs/decisions/0003-motor-de-teste-gemini.md`. A diferença para `pricing.ts` é que
 * aqui o custo É de fato zero, e não desconhecido: a chave criada roda no projeto padrão
 * do Google AI Studio, no nível gratuito, SEM faturamento habilitado — não existe cartão
 * associado, então estourar a cota gratuita produz erro 429, nunca cobrança. `pricing.ts`
 * (`custoUsd: null`) e este arquivo (`custoUsd: 0`) fazem afirmações diferentes de
 * propósito: um é "não sei o preço", o outro é "sei o preço, e é zero enquanto durar o
 * nível gratuito deste projeto".
 *
 * **Isto para de ser verdade no dia em que alguém habilitar faturamento neste projeto do
 * Google.** Não há teste capaz de detectar essa mudança do lado de cá — é o mesmo tipo de
 * fato que só a pessoa que mexe no Console consegue confirmar.
 */

import type { CustoPasso } from './pricing.js'

export type { CustoPasso }

/**
 * Modelo usado pelo `GeminiMotor`, no nível gratuito do Google AI Studio.
 *
 * ⚠️ NÃO é o modelo mais novo (`gemini-3.8-flash`, lançado 02/09/2026). Esse foi tentado
 * primeiro nesta sessão e devolveu `503 UNAVAILABLE` — "alta demanda" — de forma
 * consistente em três tentativas. `gemini-2.5-flash` também foi tentado e devolveu `404`:
 * aposentado para contas novas, com a própria API recomendando `gemini-3.6-flash` na
 * mensagem de erro. Este foi o único dos três que respondeu de verdade nesta sessão
 * (04/09/2026) — ver a prova em `docs/decisions/0003-motor-de-teste-gemini.md`.
 */
export const MODELO_GEMINI_GRATUITO = 'gemini-3.6-flash'

/** Uso de tokens como o Gemini reporta em `usageMetadata`. */
export interface UsoTokensGemini {
  entrada: number
  saida: number
  /** `usageMetadata.cachedContentTokenCount` — cache de contexto explícito, não usado aqui. */
  cache: number
}

/**
 * Sempre `custoUsd: 0` para modelos desta lista — são os únicos com nível gratuito
 * confirmado no momento em que este arquivo foi escrito (04/09/2026). Qualquer outro
 * modelo do Gemini passado aqui produz `custoUsd: null`, igual à regra de `pricing.ts`:
 * não afirmamos "grátis" por adivinhação.
 */
const MODELOS_NIVEL_GRATUITO: ReadonlySet<string> = new Set([MODELO_GEMINI_GRATUITO])

export function calcularCustoGemini(model: string, uso: UsoTokensGemini): CustoPasso {
  if (!MODELOS_NIVEL_GRATUITO.has(model)) {
    return {
      model,
      uso: { entrada: uso.entrada, saida: uso.saida, leituraCache: uso.cache, escritaCache: 0 },
      custoUsd: null,
      precoVerificadoEm: null,
    }
  }
  return {
    model,
    uso: { entrada: uso.entrada, saida: uso.saida, leituraCache: uso.cache, escritaCache: 0 },
    custoUsd: 0,
    precoVerificadoEm: '2026-09-04',
  }
}
