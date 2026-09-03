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
 * Só entram aqui ferramentas que TÊM executor hoje. `workspace.tasks.create` está no
 * catálogo, mas o endpoint de escrita não existe no contrato 0.1.0 — descrever o
 * argumento dela agora seria inventar o contrato antes da resposta do CORA-003.
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
