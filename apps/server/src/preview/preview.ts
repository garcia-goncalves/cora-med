import type {
  ArgumentosDaTarefa,
  PedidoDePrevia,
  ReferenciaNaPrevia,
  RespostaDaPrevia,
  TaskPriority,
} from '@cora/contracts'
import { hashArgs } from '@cora/policy'

/**
 * Prévia de criação de tarefa: o que a Cora mostra à Thaís antes de gravar qualquer coisa.
 *
 * **Revisado contra o contrato `workspace-agent-v1` 0.2.1 em 03/09/2026.** Os tipos daqui
 * deixaram de ser palpite: `traduzirPrevia()` é a função de fronteira que recebe a
 * `RespostaDaPrevia` real e produz a forma de apresentação. O que mudou na revisão, e por
 * quê, está anotado em cada ponto.
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
  /**
   * Veio na revisão: o contrato tem prioridade, com `NORMAL` como padrão do servidor.
   * Um padrão precisa ser LIDO antes de ser aprovado, então ele aparece na tela.
   */
  prioridade: TaskPriority
  cliente: ReferenciaResolvida
  /** Veio na revisão: o 0.2.1 tem projeto, e a forma provisória não tinha. */
  projeto: ReferenciaResolvida
  /**
   * Veio na revisão: o contrato tem `responsaveis[]`, **no plural e com pelo menos um**.
   * A forma provisória tinha um `responsavel` no singular — que teria escondido da Thaís
   * todos os responsáveis a partir do segundo, no exato campo em que "quem vai fazer" é
   * a informação inteira.
   */
  responsaveis: ReferenciaResolvida[]
  prazo: PrazoResolvido
  /** `null` obrigatoriamente quando há ambiguidade. Sem token não há o que executar. */
  approvalToken: string | null
  /**
   * Hash **NOSSO** dos argumentos exatos que seriam enviados, calculado no instante da
   * prévia.
   *
   * ⚠️ Não é o hash que está dentro do `approvalToken` — aquele é do servidor, é assinado
   * e nós não conseguimos (nem devemos) reproduzi-lo. Este aqui serve a outra pergunta:
   * *"o que estou prestes a enviar ainda é o que eu mostrei?"*. Ele pega a nossa própria
   * deriva entre aprovar e executar, que é a metade do problema que cabe a nós.
   */
  argsHash: string | null
  /** Instante em que o token deixa de valer, em ISO 8601. */
  expiraEm: string | null
  /** Exatamente o que seria enviado ao `POST /tasks`. `null` quando não há autorização. */
  args: ArgumentosDaTarefa | null
}

export type ResultadoDaPrevia =
  /** Há o que aprovar: um texto para a Thaís ler e um token para levar à execução. */
  | { tipo: 'pronta'; texto: string; approvalToken: string; argsHash: string }
  /** Falta escolher. A Cora pergunta e não segue. */
  | { tipo: 'pergunta'; texto: string; opcoes: CandidatoResolvido[] }
  /** Não dá para seguir com esta prévia, e o motivo é do servidor, não da Thaís. */
  | { tipo: 'recusada'; texto: string; motivo: MotivoDeRecusa }

export type MotivoDeRecusa =
  | 'sem_token'
  | 'token_com_ambiguidade'
  | 'token_com_referencia_nao_encontrada'
  | 'token_sem_responsavel_resolvido'

// ---------------------------------------------------------------------------
// Fronteira: a resposta real do Workspace vira a forma de apresentação
// ---------------------------------------------------------------------------

const NOME_DO_CAMPO = {
  cliente: 'cliente',
  projeto: 'projeto',
} as const

/**
 * Traduz a `RespostaDaPrevia` do contrato 0.2.1 para a forma que a Cora apresenta.
 *
 * Precisa do **pedido** além da resposta por um motivo só, e ele é concreto: quando uma
 * referência não é encontrada, o servidor devolve `motivo: NAO_ENCONTRADO` mas **não
 * repete o texto que foi buscado**. Sem o pedido em mãos, a frase para a Thaís seria
 * "não encontrei" sem dizer o quê — que é uma frase que não permite a ela corrigir nada.
 */
export function traduzirPrevia(
  pedido: PedidoDePrevia,
  resposta: RespostaDaPrevia,
): PreviaDeCriacao {
  const { previa } = resposta

  const cliente = traduzirReferencia(previa.cliente, textoPedido(pedido.cliente), 'cliente', resposta)
  const projeto = traduzirReferencia(previa.projeto, textoPedido(pedido.projeto), 'projeto', resposta)
  const responsaveis = previa.responsaveis.map((ref, i) =>
    traduzirReferencia(ref, textoPedido(pedido.responsaveis?.[i]), `responsaveis[${i}]`, resposta),
  )

  const args = montarArgumentos(resposta)

  return {
    titulo: previa.titulo,
    prioridade: previa.prioridade,
    cliente,
    projeto,
    responsaveis,
    prazo: traduzirPrazo(previa.prazo),
    approvalToken: resposta.approvalToken,
    expiraEm: resposta.approvalExpiresAt,
    args,
    argsHash: args === null ? null : hashArgs('workspace.tasks.create', { ...args }),
  }
}

/**
 * Como nomear, para a Thaís, a coisa que foi pedida e não foi encontrada.
 *
 * Busca por texto tem o texto. Escolha por `id` não tem — e aí o id é a única coisa
 * honesta a mostrar: dizer "não encontrei" sem dizer o quê é uma frase que não permite a
 * ela corrigir nada.
 */
function textoPedido(ref: { id?: string; texto?: string } | null | undefined): string {
  if (ref?.texto !== undefined) return ref.texto
  if (ref?.id !== undefined) return `id ${ref.id}`
  return '(não sei o que foi buscado)'
}

function traduzirReferencia(
  ref: ReferenciaNaPrevia,
  termoBuscado: string,
  campo: string,
  resposta: RespostaDaPrevia,
): ReferenciaResolvida {
  if (ref.encontrado && ref.id !== null) {
    // O rótulo pode vir `null` num campo marcado como encontrado só se o servidor se
    // contradisser. Mostrar o id cru é pior que ruim, mas é honesto: some o nome, não
    // some o fato.
    return { estado: 'resolvida', id: ref.id, nome: ref.rotulo ?? `(sem nome) ${ref.id}` }
  }

  switch (ref.motivo) {
    case 'AMBIGUO': {
      const ambiguidade = resposta.ambiguidades.find((a) => a.campo === campo)
      return {
        estado: 'ambigua',
        candidatos: (ambiguidade?.candidatos ?? []).map((c) => ({
          id: c.id,
          nome: c.rotulo,
          distintivo: c.distincao,
        })),
      }
    }
    case 'NAO_ENCONTRADO':
      return {
        estado: 'nao_encontrada',
        termoBuscado,
        motivo: 'nada com esse nome que você possa ver',
      }
    default:
      return { estado: 'ausente' }
  }
}

/**
 * ⚠️ **A ausência de prazo é visível, e a palavra "hoje" não pode surgir daqui.**
 * O `rotulo` do servidor já vem preenchido inclusive na ausência (`"sem prazo"`) — é o
 * que garante que sempre há algo para mostrar sem ninguém inventar uma data.
 */
function traduzirPrazo(prazo: RespostaDaPrevia['previa']['prazo']): PrazoResolvido {
  if (!prazo.presente || prazo.valor === null) return { estado: 'ausente' }
  return { estado: 'definido', iso: prazo.valor, porExtenso: prazo.rotulo }
}

/**
 * Monta os argumentos executáveis a partir da prévia **resolvida pelo servidor**, nunca a
 * partir do que o modelo propôs.
 *
 * Sem token não há argumentos: montá-los mesmo assim deixaria à mão um objeto pronto para
 * ser enviado sem autorização, e essa é exatamente a chamada que não pode existir.
 */
function montarArgumentos(resposta: RespostaDaPrevia): ArgumentosDaTarefa | null {
  if (resposta.approvalToken === null) return null

  const responsavelIds = resposta.previa.responsaveis
    .map((r) => r.id)
    .filter((id): id is string => id !== null)

  // Token emitido com responsável não resolvido é o servidor se contradizendo. Enviar
  // assim gravaria a tarefa com menos gente do que a Thaís leu na tela.
  if (responsavelIds.length !== resposta.previa.responsaveis.length) return null
  if (responsavelIds.length === 0) return null

  return {
    // O título já vem normalizado em NFC pelo servidor. NÃO normalizar de novo aqui:
    // renormalizar pode mudar bytes e produzir um `409 APPROVAL_MISMATCH` legítimo por
    // um cuidado que ninguém pediu.
    titulo: resposta.previa.titulo,
    prioridade: resposta.previa.prioridade,
    prazo: resposta.previa.prazo.presente ? resposta.previa.prazo.valor : null,
    clienteId: resposta.previa.cliente.id,
    projetoId: resposta.previa.projeto.id,
    responsavelIds,
  }
}

// ---------------------------------------------------------------------------
// Apresentação
// ---------------------------------------------------------------------------

/**
 * Transforma a prévia resolvida pelo Workspace no que a Thaís vê.
 *
 * A ordem das checagens é deliberada: ambiguidade **antes** de qualquer coisa, e recusa de
 * token indevido antes de considerar a prévia utilizável.
 */
export function descreverPrevia(previa: PreviaDeCriacao): ResultadoDaPrevia {
  for (const [rotulo, ref] of camposDeReferencia(previa)) {
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

  /**
   * ⚠️ Mudou na revisão do 0.2.1. Uma referência **pedida** que não resolve zera o token
   * do lado do servidor — decisão dele, mais estrita do que a Cora tinha pedido. Então
   * token junto com "não encontrei" é contradição, e não uma oportunidade de gravar sem
   * o vínculo.
   *
   * A forma provisória deste arquivo dizia à Thaís *"posso criar sem vínculo"*. Era uma
   * oferta que o contrato não permite cumprir — e prometer o que não se pode fazer é pior
   * do que não oferecer nada.
   */
  for (const [rotulo, ref] of camposDeReferencia(previa)) {
    if (ref.estado === 'nao_encontrada' && previa.approvalToken !== null) {
      return {
        tipo: 'recusada',
        motivo: 'token_com_referencia_nao_encontrada',
        texto:
          `Não encontrei o ${rotulo} "${ref.termoBuscado}" e, mesmo assim, recebi uma ` +
          'autorização para gravar. Não vou usar: gravar sem o vínculo que você pediu ' +
          'criaria a tarefa na ficha errada, e você só descobriria procurando por ela.',
      }
    }
  }

  if (previa.approvalToken === null || previa.argsHash === null || previa.args === null) {
    return {
      tipo: 'recusada',
      motivo: 'sem_token',
      texto: textoSemToken(previa),
    }
  }

  return {
    tipo: 'pronta',
    approvalToken: previa.approvalToken,
    argsHash: previa.argsHash,
    texto: montarTexto(previa),
  }
}

/**
 * "Não autorizou" tem causas diferentes, e a Thaís precisa da causa para saber o que
 * fazer. Um texto genérico a deixaria sem saída — e a saída de cada caso é outra.
 */
function textoSemToken(previa: PreviaDeCriacao): string {
  const naoEncontrado = camposDeReferencia(previa).find(
    ([, ref]) => ref.estado === 'nao_encontrada',
  )
  if (naoEncontrado) {
    const [rotulo, ref] = naoEncontrado
    const termo = ref.estado === 'nao_encontrada' ? ref.termoBuscado : ''
    return (
      `Não achei nenhum ${rotulo} chamado "${termo}", então o Workspace não autorizou a ` +
      'gravação — e ele está certo: criar a tarefa sem esse vínculo seria criar uma coisa ' +
      'diferente da que você pediu. Me diga o nome certo, ou confirme que é para criar sem ' +
      `${rotulo}, que eu refaço a prévia.`
    )
  }
  return (
    'O Workspace montou a prévia mas não autorizou a gravação. Não vou criar a tarefa ' +
    'sem essa autorização — ela é o que amarra o que você viu ao que seria gravado.'
  )
}

function camposDeReferencia(
  previa: PreviaDeCriacao,
): Array<[rotulo: string, ref: ReferenciaResolvida]> {
  return [
    [NOME_DO_CAMPO.cliente, previa.cliente],
    [NOME_DO_CAMPO.projeto, previa.projeto],
    ...previa.responsaveis.map(
      (r): [string, ReferenciaResolvida] => ['responsável', r],
    ),
  ]
}

function montarTexto(previa: PreviaDeCriacao): string {
  return [
    'Vou criar esta tarefa. Confere?',
    '',
    `Título: ${previa.titulo}`,
    `Prioridade: ${previa.prioridade}`,
    `Cliente: ${descreverReferencia(previa.cliente)}`,
    `Projeto: ${descreverReferencia(previa.projeto)}`,
    `Responsáveis: ${previa.responsaveis.map(descreverReferencia).join('; ')}`,
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
      return `não encontrei "${ref.termoBuscado}" — ${ref.motivo}`
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
