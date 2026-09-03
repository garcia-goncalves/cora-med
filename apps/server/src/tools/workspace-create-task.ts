import type { PedidoDePrevia } from '@cora/contracts'
import { PedidoDePreviaSchema } from '@cora/contracts'
import {
  WorkspaceApiError,
  WriteOutcomeUnknownError,
  type WorkspaceClient,
} from '@cora/workspace-client'

import {
  descreverPrevia,
  traduzirPrevia,
  verificarAntesDeExecutar,
  type PreviaDeCriacao,
  type ResultadoDaPrevia,
} from '../preview/preview.js'
import { novaChaveDeIdempotencia, type ResultadoDeCriacao } from '../run/idempotency.js'

import type { ToolHandler } from './registry.js'

/**
 * Ferramenta `workspace.tasks.create` — e a coisa mais importante deste arquivo é o que
 * ela **não** faz.
 *
 * ⚠️ **Ela não cria nada.** Ela faz a prévia e para. A criação é uma segunda chamada,
 * `executarCriacaoAprovada()`, que só existe depois de uma pessoa ler a prévia e dizer
 * sim.
 *
 * O motivo é o desenho do contrato 0.2.1, e vale escrever por extenso: o `approvalToken`
 * nasce da prévia e amarra o que foi MOSTRADO ao que será GRAVADO. Se o executor da
 * ferramenta previsse e gravasse na mesma chamada, o token existiria por dois
 * milissegundos e não teria amarrado nada a ninguém — a aprovação seria uma formalidade
 * que o programa cumpre consigo mesmo.
 *
 * A política classifica esta ferramenta como `internal_write`, que `decide()` permite sem
 * aprovação. Isso **não** é contradição: aquela permissão é sobre a prévia, que é leitura
 * pura e não escreve nada. Quem autoriza a gravação é a pessoa, aqui.
 */
export type PreviewTaskToolResult = {
  outcome: 'previa'
  previa: PreviaDeCriacao
  apresentacao: ResultadoDaPrevia
}

export function createPreviewTaskTool(client: WorkspaceClient): ToolHandler {
  return async ({ args, signal }) => {
    // Os argumentos vêm do MODELO. Validar aqui não é desconfiança decorativa: o esquema
    // que ele recebeu descreve a forma, mas nada obriga a saída dele a obedecer.
    const parsed = PedidoDePreviaSchema.safeParse(args)
    if (!parsed.success) {
      throw new WorkspaceApiError({
        code: 'INVALID_INPUT',
        message:
          'O pedido de tarefa veio fora da forma acordada: ' +
          parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        httpStatus: null,
        requestId: null,
      })
    }

    const pedido: PedidoDePrevia = parsed.data
    // A falha NÃO é capturada, pelo mesmo motivo de `createListTasksTool`: um erro que
    // virasse valor normal seria registrado como sucesso e entregue ao modelo como se a
    // prévia tivesse dado certo.
    const resposta = await client.previewTask(pedido, { signal })
    const previa = traduzirPrevia(pedido, resposta)

    return {
      outcome: 'previa',
      previa,
      apresentacao: descreverPrevia(previa),
    } satisfies PreviewTaskToolResult
  }
}

/**
 * A gravação, depois do sim da pessoa.
 *
 * Ordem das travas, e ela é deliberada:
 * 1. a apresentação tem de ter chegado a `pronta` — pergunta e recusa não viram gravação;
 * 2. `verificarAntesDeExecutar()` confere que o que vamos enviar é o que foi mostrado;
 * 3. só então a requisição sai.
 *
 * A `Idempotency-Key` é gerada **uma vez por tentativa lógica** e devolvida no resultado.
 * Repetir a tentativa reaproveita a MESMA chave — é isso que faz a repetição ser inócua
 * em vez de criar a segunda tarefa.
 */
export async function executarCriacaoAprovada(args: {
  client: WorkspaceClient
  previa: PreviaDeCriacao
  agora: Date
  /** Reaproveite a chave de uma tentativa anterior ao repetir. Omitida, nasce uma nova. */
  idempotencyKey?: string
  signal?: AbortSignal
}): Promise<ResultadoDeCriacao> {
  const { client, previa, agora } = args
  const chave = args.idempotencyKey ?? novaChaveDeIdempotencia()

  const apresentacao = descreverPrevia(previa)
  if (apresentacao.tipo !== 'pronta') {
    return {
      estado: 'conflito',
      detalhe:
        apresentacao.tipo === 'pergunta'
          ? 'a prévia ainda tem uma escolha pendente'
          : `a prévia foi recusada (${apresentacao.motivo})`,
    }
  }

  if (previa.args === null) {
    return { estado: 'conflito', detalhe: 'a prévia não produziu argumentos executáveis' }
  }

  const veredicto = verificarAntesDeExecutar({
    toolName: 'workspace.tasks.create',
    args: { ...previa.args },
    previa,
    agora,
  })
  if (!veredicto.pode) {
    return { estado: 'conflito', detalhe: veredicto.texto }
  }

  try {
    const criada = await client.createTask(
      {
        approvalToken: veredicto.approvalToken,
        task: previa.args,
        idempotencyKey: chave,
      },
      args.signal === undefined ? {} : { signal: args.signal },
    )
    return criada.created
      ? { estado: 'criada', taskId: criada.taskId }
      : { estado: 'ja_existia', taskId: criada.taskId }
  } catch (cause) {
    // ⚠️ Só o resultado DESCONHECIDO é traduzido aqui. Todo o resto sobe: um `409` que
    // virasse valor de retorno seria contado como execução bem-sucedida pelo laço.
    if (cause instanceof WriteOutcomeUnknownError) {
      return {
        estado: 'desconhecido',
        idempotencyKey: cause.idempotencyKey,
        motivo: cause.message,
      }
    }
    throw cause
  }
}

/**
 * A frase que a pessoa lê quando a gravação foi recusada.
 *
 * **Cada código tem a sua**, e isso é o oposto de preciosismo: o contrato nomeou cinco
 * conflitos justamente porque a saída de cada um é diferente. Um texto genérico obrigaria
 * a pessoa a adivinhar se deve tentar de novo, corrigir o pedido ou chamar alguém.
 */
export function descreverFalhaDaCriacao(error: unknown): string {
  if (!(error instanceof WorkspaceApiError)) {
    return (
      'Não consegui criar a tarefa e não sei dizer por quê. Não vou tentar de novo às ' +
      'cegas: repetir sem entender é como se cria a tarefa duplicada.'
    )
  }

  switch (error.code) {
    case 'PRECONDITION_CHANGED':
      return descreverDivergencias(error)

    case 'APPROVAL_EXPIRED':
      return (
        'A autorização venceu antes de eu gravar. Nada foi criado. Vou refazer a prévia — ' +
        'e se alguma coisa tiver mudado nesse meio-tempo, eu te mostro o que mudou em vez ' +
        'de reaprovar em silêncio.'
      )

    case 'APPROVAL_ALREADY_USED':
      // ⚠️ Aqui uma tarefa PROVAVELMENTE existe, criada por uma tentativa anterior — o
      // que não existe é uma segunda. Dizer só "nada foi gravado" seria meia verdade, e
      // a metade que falta é justamente a que a pessoa precisa para não pedir de novo.
      return (
        'Essa autorização já tinha sido usada para gravar uma tarefa antes, então agora ' +
        'nada foi gravado — e é isso que eu queria: cada aprovação vale uma criação, e ' +
        'reaproveitar esta seria criar uma segunda tarefa com o seu sim de antes. A tarefa ' +
        'da primeira vez deve estar lá. Se você quer mesmo uma segunda, eu refaço a prévia.'
      )

    case 'APPROVAL_MISMATCH':
      // Este é defeito NOSSO: a trava local deveria tê-lo pegado antes de sair.
      return (
        'O que eu enviei não bateu com o que você aprovou, e o Workspace recusou — ' +
        'corretamente, e sem gravar nada. O problema é meu, não seu. Vou refazer a prévia ' +
        'do zero para você conferir de novo.'
      )

    case 'IDEMPOTENCY_CONFLICT':
      return (
        'Reusei uma chave de controle com dados diferentes, e o Workspace barrou. Nada foi ' +
        'gravado, e isso é um defeito meu. Vou recomeçar com uma chave nova.'
      )

    case 'APPROVAL_INVALID':
      return (
        'A autorização que eu tinha não vale para esta gravação — ela pode ter sido emitida ' +
        'para outra pessoa ou outro programa. Nada foi criado. Vou refazer a prévia.'
      )

    case 'FORBIDDEN':
      return (
        'O Workspace recusou a criação (FORBIDDEN). Ou sua conta foi desativada, ou a ' +
        'autorização que eu tenho não cobre criar tarefas. Renovar a autorização não ' +
        'resolve sozinho — alguém precisa olhar isso.'
      )

    case 'RATE_LIMITED':
      return 'Bati no limite de chamadas do Workspace. Nada foi criado. Tente de novo em instantes.'

    case 'UPSTREAM_UNAVAILABLE':
      return (
        'O Workspace não conseguiu gravar agora e disse isso explicitamente — então a ' +
        'tarefa NÃO foi criada. Pode pedir de novo daqui a pouco.'
      )

    default:
      if (error.requiresReauth) {
        return (
          'Sua autorização para eu acessar o Workspace expirou ou foi revogada ' +
          `(${error.code}). Nada foi criado. Preciso que você me autorize de novo.`
        )
      }
      return `Não consegui criar a tarefa (${error.code}). Nada foi gravado.`
  }
}

/**
 * O `409 PRECONDITION_CHANGED` traz, campo a campo, o que mudou entre a prévia e o
 * instante de gravar. Cada motivo vira uma frase diferente porque **são coisas
 * diferentes**: "a pessoa saiu da equipe" e "esse cliente não existe mais" pedem reações
 * distintas de quem lê.
 */
function descreverDivergencias(error: WorkspaceApiError): string {
  if (error.divergencias.length === 0) {
    return (
      'Alguma coisa mudou no Workspace entre eu te mostrar a prévia e gravar, então nada ' +
      'foi criado. Vou refazer a prévia com os dados de agora.'
    )
  }

  const linhas = error.divergencias.map((d) => {
    const campo = d.campo === 'responsavel' ? 'o responsável' : `o ${d.campo}`
    switch (d.motivo) {
      case 'ROTULO_MUDOU':
        return (
          `- ${campo} que você aprovou era "${d.aprovado.rotulo}" e agora se chama ` +
          `"${d.atual?.rotulo ?? '?'}" (é o mesmo cadastro, só o nome mudou)`
        )
      case 'NAO_ENCONTRADO':
        return `- ${campo} "${d.aprovado.rotulo}" não existe mais`
      case 'SEM_ACESSO':
        return (
          `- ${campo} "${d.aprovado.rotulo}" perdeu o acesso ao Workspace ` +
          '(conta desativada ou removida da equipe)'
        )
    }
  })

  return [
    'Não criei a tarefa: o que você aprovou mudou entre a prévia e a gravação.',
    '',
    ...linhas,
    '',
    'Nada foi gravado. Vou refazer a prévia com os dados de agora para você conferir.',
  ].join('\n')
}
