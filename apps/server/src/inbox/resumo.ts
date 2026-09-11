import type { InboxItem } from '@cora/contracts'
import { cortarParaLimite, wrapUntrusted } from '@cora/policy'

import { MAX_CHARS_RESULTADO } from '../run/turn.js'

/**
 * Resumo operacional — "como estão minhas pendências".
 *
 * Este módulo é **puro**: `montarResumo` não faz rede, não conhece `WorkspaceClient` e não
 * conhece a fila. Recebe os itens já coletados e o relato de sincronização de cada fonte, e
 * devolve um resultado estruturado. Quem fala com o Workspace e quem lê a fila entram como
 * dados de entrada, não como dependência deste arquivo.
 */

/** O que aconteceu ao tentar sincronizar com uma fonte. */
export type SincronizacaoDaFonte =
  | { fonte: 'workspace:tasks'; estado: 'completa'; itensVistos: number; paginas: number }
  | {
      fonte: 'workspace:tasks'
      estado: 'parcial'
      itensVistos: number
      paginas: number
      motivo: 'teto_de_paginas'
    }
  | { fonte: 'workspace:tasks'; estado: 'falhou'; frase: string }

/**
 * Os cinco estados possíveis do resumo. A precedência entre eles vive em `montarResumo`,
 * nesta ordem, e não é arbitrária — ver o comentário lá.
 */
export type ResumoOperacional =
  | { estado: 'erro_de_acesso'; fontes: readonly SincronizacaoDaFonte[] }
  | {
      estado: 'sincronizacao_incompleta'
      itens: readonly InboxItem[]
      fontes: readonly SincronizacaoDaFonte[]
    }
  | { estado: 'sem_registros'; fontes: readonly SincronizacaoDaFonte[] }
  | { estado: 'sem_pendencias'; itens: readonly InboxItem[]; fontes: readonly SincronizacaoDaFonte[] }
  | { estado: 'com_pendencias'; itens: readonly InboxItem[]; fontes: readonly SincronizacaoDaFonte[] }

/**
 * Monta o resumo a partir dos itens já coletados e do relato de cada fonte.
 *
 * Precedência, nesta ordem e de propósito:
 * 1. alguma fonte falhou → `erro_de_acesso`. Dúvida sobre acesso domina qualquer contagem:
 *    dizer "sem pendências" com uma fonte caída é a mentira que esta fase existe para
 *    impedir.
 * 2. senão, alguma fonte parcial → `sincronizacao_incompleta`. Leva os itens que deu para
 *    ver, avisando que pode faltar.
 * 3. senão, `itens` vazio → `sem_registros`.
 * 4. senão, nenhum item com status `PENDENTE` → `sem_pendencias`.
 * 5. senão → `com_pendencias`.
 */
export function montarResumo(entrada: {
  itens: readonly InboxItem[]
  fontes: readonly SincronizacaoDaFonte[]
}): ResumoOperacional {
  const { itens, fontes } = entrada

  if (fontes.some((f) => f.estado === 'falhou')) {
    return { estado: 'erro_de_acesso', fontes }
  }

  if (fontes.some((f) => f.estado === 'parcial')) {
    return { estado: 'sincronizacao_incompleta', itens, fontes }
  }

  if (itens.length === 0) {
    return { estado: 'sem_registros', fontes }
  }

  if (!itens.some((item) => item.status === 'PENDENTE')) {
    return { estado: 'sem_pendencias', itens, fontes }
  }

  return { estado: 'com_pendencias', itens, fontes }
}

/** Uma linha por item, agrupada por fonte, cortada e embrulhada como dado não confiável. */
function listarItensPorFonte(itens: readonly InboxItem[]): string {
  const porFonte = new Map<string, InboxItem[]>()
  for (const item of itens) {
    const lista = porFonte.get(item.fonte)
    if (lista === undefined) {
      porFonte.set(item.fonte, [item])
    } else {
      lista.push(item)
    }
  }

  const blocos: string[] = []
  for (const [fonte, itensDaFonte] of porFonte) {
    // A fonte aparece duas vezes de propósito: no rótulo do bloco e junto do número que a
    // Thaís lê — o critério é "não aparece número sem proveniência".
    const linhas = itensDaFonte
      .map(
        (item) =>
          `- ${item.titulo} [${item.status}, prioridade ${item.prioridade}, id ${item.identificadorDoWorkspace}, fonte ${fonte}]`,
      )
      .join('\n')
    const cortado = cortarParaLimite(linhas, MAX_CHARS_RESULTADO)
    blocos.push(`Fonte ${fonte}:\n${wrapUntrusted({ source: fonte, content: cortado })}`)
  }
  return blocos.join('\n\n')
}

/**
 * Frase para a Thaís a partir do resumo. `switch` exaustivo, **cinco frases distintas** —
 * frase genérica obriga a pessoa a adivinhar se tenta de novo, se espera ou se chama
 * alguém.
 */
export function descreverResumo(resumo: ResumoOperacional): string {
  switch (resumo.estado) {
    case 'erro_de_acesso': {
      const falhas = resumo.fontes.filter((f) => f.estado === 'falhou')
      const frases = falhas.map((f) => f.frase).join(' ')
      return (
        `Não consegui consultar tudo: ${frases} Isso NÃO quer dizer que você esteja sem ` +
        'pendências — só que não dá para confirmar agora.'
      )
    }
    case 'sincronizacao_incompleta': {
      const parciais = resumo.fontes.filter((f) => f.estado === 'parcial')
      const paginas = parciais.map((f) => f.paginas).join(', ')
      return (
        `Vi só parte das suas tarefas (li ${paginas} página(s) e parei). A lista abaixo ` +
        `pode estar faltando item:\n\n${listarItensPorFonte(resumo.itens)}`
      )
    }
    case 'sem_registros':
      return 'Consultei a lista inteira e o Workspace não devolveu nenhuma tarefa.'
    case 'sem_pendencias':
      return (
        `Consultei a lista inteira: há ${resumo.itens.length} tarefa(s), e nenhuma está ` +
        'parada esperando por você.'
      )
    case 'com_pendencias': {
      const pendentes = resumo.itens.filter((item) => item.status === 'PENDENTE')
      return (
        `Você tem ${pendentes.length} tarefa(s) pendente(s):\n\n` +
        listarItensPorFonte(resumo.itens)
      )
    }
  }
}
