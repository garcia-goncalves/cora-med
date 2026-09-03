import { hashArgs } from '@cora/policy'

/**
 * Prévia de criação de tarefa: o que a Cora mostra à Thaís antes de gravar qualquer coisa.
 *
 * ⚠️ **Os tipos deste arquivo são INTERNOS e PROVISÓRIOS.** O contrato de escrita não
 * existe: o CORA-003 está `proposed` e sem resposta. Quando ele chegar, a tradução da
 * resposta real do Workspace para `PreviaDeCriacao` vira uma função de fronteira, e estes
 * tipos param de ser um palpite. Nada aqui inventa endpoint, campo de rede ou formato de
 * token — é só a forma que a Cora precisa para **apresentar** e para **recusar**.
 *
 * Duas decisões vêm do plano da Fase 2, e não são negociáveis por implementação:
 *
 * 1. **Quem monta a prévia é o Workspace, não a Cora.** Se a Cora renderizasse a partir
 *    do que o modelo produziu e depois mandasse a escrita, a coisa aprovada e a coisa
 *    gravada seriam dois artefatos diferentes, e entre uma e outra caberia qualquer coisa.
 *    Aqui ela **apresenta** o que o servidor resolveu.
 * 2. **Ambiguidade não gera token.** Dois candidatos possíveis não podem virar uma escolha
 *    silenciosa com aprovação em cima — isso seria o mesmo defeito, um nível abaixo.
 */

/** Um candidato quando a resolução achou mais de um. */
export interface CandidatoResolvido {
  id: string
  nome: string
  /**
   * O fato que distingue ESTE candidato dos outros. Sem ele, dois nomes iguais apenas
   * transferem a ambiguidade para a Thaís sem lhe dar como resolvê-la.
   */
  distintivo: string
}

export type ReferenciaResolvida =
  | { estado: 'resolvida'; id: string; nome: string }
  | { estado: 'ambigua'; candidatos: CandidatoResolvido[] }
  | { estado: 'nao_encontrada'; termoBuscado: string; motivo: string }
  /** A Thaís não mencionou. Ausência é ausência: não vira "o de sempre". */
  | { estado: 'ausente' }

export type PrazoResolvido =
  | { estado: 'definido'; iso: string; porExtenso: string }
  | { estado: 'ausente' }

export interface PreviaDeCriacao {
  titulo: string
  cliente: ReferenciaResolvida
  responsavel: ReferenciaResolvida
  prazo: PrazoResolvido
  /** `null` obrigatoriamente quando há ambiguidade. Sem token não há o que executar. */
  approvalToken: string | null
  /** Hash dos argumentos EXATOS que o servidor executaria. */
  argsHash: string | null
  /** Instante em que o token deixa de valer, em ISO 8601. */
  expiraEm: string | null
}

export type ResultadoDaPrevia =
  /** Há o que aprovar: um texto para a Thaís ler e um token para levar à execução. */
  | { tipo: 'pronta'; texto: string; approvalToken: string; argsHash: string }
  /** Falta escolher. A Cora pergunta e não segue. */
  | { tipo: 'pergunta'; texto: string; opcoes: CandidatoResolvido[] }
  /** Não dá para seguir com esta prévia, e o motivo é do servidor, não da Thaís. */
  | { tipo: 'recusada'; texto: string; motivo: string }

const AMBIGUAS: ReadonlyArray<[rotulo: string, chave: 'cliente' | 'responsavel']> = [
  ['cliente', 'cliente'],
  ['responsável', 'responsavel'],
]

/**
 * Transforma a prévia resolvida pelo Workspace no que a Thaís vê.
 *
 * A ordem das checagens é deliberada: ambiguidade **antes** de qualquer coisa, e recusa de
 * token indevido antes de considerar a prévia utilizável.
 */
export function descreverPrevia(previa: PreviaDeCriacao): ResultadoDaPrevia {
  for (const [rotulo, chave] of AMBIGUAS) {
    const ref = previa[chave]
    if (ref.estado === 'ambigua') {
      // Defesa em profundidade: se o servidor mandar token JUNTO com ambiguidade, a Cora
      // recusa em vez de aproveitar. Um token sobre escolha que ninguém fez é pior do que
      // token nenhum, porque parece aprovação.
      if (previa.approvalToken !== null) {
        return {
          tipo: 'recusada',
          motivo: 'token_com_ambiguidade',
          texto:
            `Recebi mais de um ${rotulo} possível e, junto, uma autorização para gravar. ` +
            'Isso não deveria acontecer: autorização em cima de uma escolha que ninguém ' +
            'fez não é autorização. Não vou criar nada até isso ser resolvido.',
        }
      }
      return {
        tipo: 'pergunta',
        opcoes: ref.candidatos,
        texto: [
          `Encontrei mais de um ${rotulo} com esse nome. Qual deles?`,
          '',
          ...ref.candidatos.map((c, i) => `${i + 1}. ${c.nome} — ${c.distintivo}`),
        ].join('\n'),
      }
    }
  }

  if (previa.approvalToken === null || previa.argsHash === null) {
    return {
      tipo: 'recusada',
      motivo: 'sem_token',
      texto:
        'O Workspace montou a prévia mas não autorizou a gravação. Não vou criar a tarefa ' +
        'sem essa autorização — ela é o que amarra o que você viu ao que seria gravado.',
    }
  }

  return {
    tipo: 'pronta',
    approvalToken: previa.approvalToken,
    argsHash: previa.argsHash,
    texto: montarTexto(previa),
  }
}

function montarTexto(previa: PreviaDeCriacao): string {
  return [
    'Vou criar esta tarefa. Confere?',
    '',
    `Título: ${previa.titulo}`,
    `Cliente: ${descreverReferencia(previa.cliente)}`,
    `Responsável: ${descreverReferencia(previa.responsavel)}`,
    `Prazo: ${descreverPrazo(previa.prazo)}`,
  ].join('\n')
}

/**
 * Referência resolvida aparece com **id e nome legível**. Só o id não deixa a Thaís
 * perceber que é o médico errado; só o nome não permite conferir depois.
 */
function descreverReferencia(ref: ReferenciaResolvida): string {
  switch (ref.estado) {
    case 'resolvida':
      return `${ref.nome} (id ${ref.id})`
    case 'nao_encontrada':
      // O que não foi achado aparece COM o motivo. Omitir vira "eu não vi isso", e
      // depois "eu não aprovei isso".
      return `não encontrei "${ref.termoBuscado}" — ${ref.motivo}. Posso criar sem vínculo.`
    case 'ausente':
      return 'você não indicou, e eu não vou escolher por você'
    case 'ambigua':
      // Inalcançável por `descreverPrevia`, que trata ambiguidade antes. Fica explícito
      // para que um caminho novo não caia num texto silencioso.
      return 'mais de um possível — preciso que você escolha'
  }
}

/**
 * Ausência de prazo aparece na tela como ausência. A palavra "hoje" não pode surgir aqui
 * por padrão: preencher prazo que ninguém disse é o erro mais fácil de não perceber.
 */
function descreverPrazo(prazo: PrazoResolvido): string {
  return prazo.estado === 'definido' ? `${prazo.porExtenso} (${prazo.iso})` : 'sem prazo'
}

// ---------------------------------------------------------------------------
// Trava de execução
// ---------------------------------------------------------------------------

export type VeredictoDeExecucao =
  | { pode: true; approvalToken: string }
  | {
      pode: false
      motivo: 'sem_token' | 'argumentos_divergentes' | 'token_expirado'
      texto: string
    }

export interface PedidoDeExecucao {
  /** O que a Cora está prestes a enviar. */
  toolName: string
  args: Record<string, unknown>
  /** O que foi aprovado. */
  previa: PreviaDeCriacao
  agora: Date
}

/**
 * Última trava antes de a escrita sair da máquina.
 *
 * Ela existe porque o `approvalToken` só vale se os argumentos forem os mesmos que o
 * servidor mostrou. Sem esta checagem, a Cora poderia enviar um pedido diferente daquele
 * que a Thaís leu, e descobrir a divergência só pelo `409` do outro lado — tarde demais
 * para explicar o que mudou.
 *
 * O prazo curto do token **não** é a defesa: o que muda em 40 minutos não é o pedido, é o
 * mundo. A defesa é o servidor revalidar no instante de executar. Isto aqui é a metade
 * que cabe a nós.
 */
export function verificarAntesDeExecutar(pedido: PedidoDeExecucao): VeredictoDeExecucao {
  const { previa } = pedido

  if (previa.approvalToken === null || previa.argsHash === null) {
    return {
      pode: false,
      motivo: 'sem_token',
      texto: 'Não tenho autorização do Workspace para gravar esta tarefa.',
    }
  }

  if (previa.expiraEm !== null && Date.parse(previa.expiraEm) <= pedido.agora.getTime()) {
    return {
      pode: false,
      motivo: 'token_expirado',
      texto:
        'A autorização venceu antes de eu executar. Vou refazer a prévia — e se algo ' +
        'tiver mudado, eu mostro o que mudou em vez de reaprovar em silêncio.',
    }
  }

  if (hashArgs(pedido.toolName, pedido.args) !== previa.argsHash) {
    return {
      pode: false,
      motivo: 'argumentos_divergentes',
      texto:
        'O que eu ia gravar não é exatamente o que você aprovou. Não vou enviar assim: ' +
        'refaço a prévia com os dados atuais para você conferir de novo.',
    }
  }

  return { pode: true, approvalToken: previa.approvalToken }
}
