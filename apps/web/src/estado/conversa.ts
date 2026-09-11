/**
 * Máquina de estados da conversa — pura, sem React.
 *
 * A regra que este módulo existe para garantir: **mensagem que falha nunca some**, e
 * dá para reenviar sem redigitar. Nenhum componente de tela decide isso sozinho; o
 * reducer é a única fonte de verdade, e é por isso que ele é testável isolado do DOM.
 */

/**
 * Os cinco estados do resumo operacional, espelhando `ResumoOperacional['estado']` de
 * `apps/server/src/inbox/resumo.ts`. Repetido aqui como união literal, não como import
 * do servidor: `apps/web` fala com o servidor só por HTTP, nunca importa o código dele
 * para dentro do bundle do navegador. `conversa.test.ts` prova que os dois lados não
 * divergem, lendo o arquivo de origem.
 */
export type EstadoDoResumo =
  | 'com_pendencias'
  | 'sem_pendencias'
  | 'sincronizacao_incompleta'
  | 'erro_de_acesso'
  | 'sem_registros'

export type AutorDaMensagem = 'pessoa' | 'cora'

export type SituacaoDaMensagem = 'enviando' | 'enviada' | 'falhou' | 'recebida'

export interface Mensagem {
  readonly id: string
  readonly autor: AutorDaMensagem
  readonly texto: string
  readonly situacao: SituacaoDaMensagem
  /** Só mensagens da Cora carregam isso, e só quando o turno trouxe resumo operacional. */
  readonly estadoDoResumo?: EstadoDoResumo
}

export interface EstadoDaConversa {
  readonly mensagens: readonly Mensagem[]
  /**
   * O que a pessoa está digitando agora. Sobrevive a uma mensagem anterior falhar —
   * é a regra do `design.md`: falha não apaga o que ainda não foi enviado.
   */
  readonly rascunho: string
}

export const estadoInicialDaConversa: EstadoDaConversa = {
  mensagens: [],
  rascunho: '',
}

/**
 * As cinco transições. `enviar` é otimista: a mensagem entra como `enviando` antes de
 * qualquer resposta do servidor. `falhar` nunca remove a mensagem da lista — ela
 * permanece, com `situacao: 'falhou'`, para o botão "Tentar de novo" ter o que reenviar.
 */
export type AcaoDaConversa =
  | { tipo: 'digitar_rascunho'; texto: string }
  | { tipo: 'enviar'; id: string; texto: string }
  | {
      tipo: 'confirmar'
      idDaMensagemEnviada: string
      resposta: { id: string; texto: string; estadoDoResumo?: EstadoDoResumo }
    }
  | { tipo: 'falhar'; id: string }
  | { tipo: 'reenviar'; id: string }

export function reduzirConversa(estado: EstadoDaConversa, acao: AcaoDaConversa): EstadoDaConversa {
  switch (acao.tipo) {
    case 'digitar_rascunho':
      return { ...estado, rascunho: acao.texto }

    case 'enviar':
      return {
        ...estado,
        rascunho: '',
        mensagens: [
          ...estado.mensagens,
          { id: acao.id, autor: 'pessoa', texto: acao.texto, situacao: 'enviando' },
        ],
      }

    case 'confirmar': {
      const respostaDaCora: Mensagem = {
        id: acao.resposta.id,
        autor: 'cora',
        texto: acao.resposta.texto,
        situacao: 'recebida',
        ...(acao.resposta.estadoDoResumo === undefined
          ? {}
          : { estadoDoResumo: acao.resposta.estadoDoResumo }),
      }
      return {
        ...estado,
        mensagens: [
          ...estado.mensagens.map((mensagem) =>
            mensagem.id === acao.idDaMensagemEnviada
              ? { ...mensagem, situacao: 'enviada' as const }
              : mensagem,
          ),
          respostaDaCora,
        ],
      }
    }

    case 'falhar':
      // A mensagem PERMANECE na lista, só muda a situação. É a regra central deste módulo.
      return {
        ...estado,
        mensagens: estado.mensagens.map((mensagem) =>
          mensagem.id === acao.id ? { ...mensagem, situacao: 'falhou' as const } : mensagem,
        ),
      }

    case 'reenviar':
      // Reaproveita o texto que já está na mensagem — a pessoa não redigita nada.
      return {
        ...estado,
        mensagens: estado.mensagens.map((mensagem) =>
          mensagem.id === acao.id ? { ...mensagem, situacao: 'enviando' as const } : mensagem,
        ),
      }
  }
}
