import { findTool, isOutOfScope } from '@cora/policy'

/**
 * A forma dos argumentos de cada ferramenta, no formato que a API de modelo entende.
 *
 * Por que aqui e não no catálogo de `@cora/policy`: o catálogo responde "o que existe e
 * qual o risco", e é lido por código que não tem nada a ver com modelo de linguagem.
 * Esquema de parâmetro é detalhe da fronteira com o motor, e é aqui que ele mora.
 *
 * A lista é conferida contra o catálogo por teste: um esquema órfão — nome que não
 * existe na política — reprova a suíte. É o que impede este arquivo de virar uma
 * segunda lista de ferramentas, divergindo em silêncio da primeira.
 *
 * Ferramenta SEM esquema aqui simplesmente não é oferecida ao modelo, e o adaptador
 * **falha alto** em vez de oferecer uma ferramenta sem contrato de argumento.
 */

export interface EsquemaFerramenta {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
  additionalProperties: false
  /** JSON Schema aceita campos além destes; o índice é o que deixa o tipo casar com o do SDK. */
  [campo: string]: unknown
}

export interface FerramentaParaMotor {
  name: string
  description: string
  input_schema: EsquemaFerramenta
}

/**
 * Uma referência a cliente, projeto ou pessoa, como o MODELO pode expressá-la.
 *
 * ⚠️ **Exatamente um** entre `id` e `texto`, e o `oneOf` está aqui para o modelo ver a
 * regra, não para confiarmos nele: `PedidoDePreviaSchema` recusa o par no cliente, antes
 * de virar requisição, e o servidor recusaria de novo. Três camadas para a mesma regra
 * porque "qual dos dois vale?" é uma pergunta que ninguém pode responder no lugar de quem
 * falou.
 */
const REFERENCIA = {
  oneOf: [
    {
      type: 'object',
      properties: {
        texto: {
          type: 'string',
          minLength: 2,
          description:
            'O nome COMO A PESSOA FALOU. Não normalize, não corrija e não complete: o ' +
            'servidor é quem busca, e é ele que informa se achou um, nenhum ou vários.',
        },
      },
      required: ['texto'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'A escolha JÁ FEITA pela pessoa depois de uma desambiguação. Só use um id ' +
            'que veio de uma prévia anterior desta mesma conversa. Nunca invente id.',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  ],
} as const

/**
 * Só entram aqui ferramentas que TÊM executor hoje.
 *
 * ⚠️ **`workspace.tasks.create` recebe o pedido na forma da PRÉVIA, não na da execução.**
 * O modelo descreve o que a pessoa quer — título, prioridade, prazo, e as referências por
 * texto. Ele **não** vê, não escolhe e não pode fabricar o `approvalToken` nem a
 * `Idempotency-Key`: o token nasce do servidor, na prévia, e a chave nasce da Cora. Se
 * qualquer um dos dois fosse argumento de ferramenta, o modelo poderia produzir uma
 * aprovação — e aprovação que o modelo produz não é aprovação de ninguém.
 */
const ESQUEMAS: Readonly<Record<string, EsquemaFerramenta>> = {
  'workspace.tasks.list': {
    type: 'object',
    properties: {
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        description: 'Quantas tarefas trazer nesta página. Padrão 20.',
      },
      cursor: {
        type: 'string',
        description:
          'Marcador da página seguinte, devolvido pela consulta anterior. Não invente ' +
          'este valor: sem cursor de uma resposta real, omita o campo.',
      },
    },
    required: [],
    additionalProperties: false,
  },
  'workspace.tasks.create': {
    type: 'object',
    properties: {
      titulo: {
        type: 'string',
        minLength: 3,
        maxLength: 180,
        description:
          'O que a pessoa pediu, na frase dela. Entre 3 e 180 caracteres. Não acrescente ' +
          'contexto que ela não deu.',
      },
      prioridade: {
        type: 'string',
        enum: ['BAIXA', 'NORMAL', 'ALTA'],
        description:
          'Só informe quando a pessoa disser. Omitido vira NORMAL, que é o padrão do ' +
          'Workspace e aparece na prévia para ela conferir.',
      },
      prazo: {
        type: 'string',
        description:
          'Data e hora em ISO 8601 COM FUSO explícito (por exemplo 2026-09-04T09:00:00-03:00). ' +
          '⚠️ Omita se a pessoa não disse prazo. NUNCA use hoje, amanhã ou o fim do dia como ' +
          'padrão: prazo que ninguém pediu é o erro mais fácil de não perceber, porque a ' +
          'tarefa fica certa e só a data fica errada.',
      },
      cliente: {
        ...REFERENCIA,
        description:
          'O cliente que a pessoa mencionou. Omita se ela não mencionou nenhum — ausência ' +
          'é ausência, e não vira "o de sempre".',
      },
      projeto: {
        ...REFERENCIA,
        description: 'O projeto que a pessoa mencionou. Omita se ela não mencionou nenhum.',
      },
      responsaveis: {
        type: 'array',
        maxItems: 10,
        items: REFERENCIA,
        description:
          'Quem vai fazer. Omita quando a pessoa não disse: lista vazia significa ela ' +
          'mesma, e isso aparece na prévia marcado como padrão, para ela ler antes de aprovar.',
      },
    },
    required: ['titulo'],
    additionalProperties: false,
  },
  'workspace.inbox.resumo': {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
}

/** Nomes que têm esquema. Usado pelo teste que compara com o catálogo. */
export function nomesComEsquema(): string[] {
  return Object.keys(ESQUEMAS).sort()
}

export function esquemaDe(name: string): EsquemaFerramenta | undefined {
  // `Object.hasOwn` pelo mesmo motivo de `pricing.ts`: `constructor` não é esquema.
  return Object.hasOwn(ESQUEMAS, name) ? ESQUEMAS[name] : undefined
}

/**
 * Monta a lista de ferramentas para o motor a partir dos nomes que o registro oferece.
 *
 * A descrição vem do catálogo da política — a MESMA frase em português que a prévia de
 * aprovação mostra ao usuário. Duas descrições diferentes para a mesma ferramenta seria
 * o começo de a tela dizer uma coisa e o modelo entender outra.
 */
export function montarFerramentas(nomes: readonly string[]): FerramentaParaMotor[] {
  return nomes.map((name) => {
    const spec = findTool(name)
    if (!spec) {
      throw new Error(`Ferramenta "${name}" não existe no catálogo da política`)
    }
    if (isOutOfScope(spec.category)) {
      // Defesa em profundidade: `decide()` já negaria na execução, mas nem OFERECER
      // ferramenta privilegiada ao modelo é melhor do que oferecer e negar depois.
      // Hoje o que impede `system.install` de aparecer é ninguém ter escrito um esquema
      // para ela — o que é acidente, não trava.
      throw new Error(
        `Ferramenta "${name}" é de categoria fora do escopo da assistente e não pode ` +
          'sequer ser oferecida ao modelo.',
      )
    }
    const input_schema = esquemaDe(name)
    if (!input_schema) {
      throw new Error(
        `Ferramenta "${name}" não tem esquema de argumentos em tool-schemas.ts. ` +
          'Oferecê-la ao modelo sem contrato de argumento é convidar argumento inventado.',
      )
    }
    return { name, description: spec.humanDescription, input_schema }
  })
}
