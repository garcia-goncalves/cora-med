import { z } from 'zod'

import { IdERotuloSchema } from './errors.js'
import { CONTRACT_VERSION, TaskPrioritySchema } from './tasks.js'

/**
 * Schemas da ESCRITA do contrato `workspace-agent-v1` 0.2.1:
 * `POST /api/agent/v1/tasks/preview` e `POST /api/agent/v1/tasks`.
 *
 * O contrato canônico é de autoria do WORKSPACE. A cópia vive em
 * `./contrato/workspace-agent-v1.openapi.yaml` — produção nunca lê de `med-coordination`.
 *
 * A forma é a do YAML, campo a campo. Onde a validação aqui é **mais estrita** que a de
 * lá, está anotado o porquê: recusar na nossa máquina um pedido que o servidor recusaria
 * de qualquer jeito economiza uma viagem e produz uma frase melhor para a pessoa ler.
 */

/**
 * ISO 8601 **com fuso explícito** — `Z` ou `±HH:MM`.
 *
 * ⚠️ Mais estrito que `Date.parse`, e de propósito. `"2026-09-04T09:00:00"` sem fuso é
 * aceito pelo JavaScript e interpretado no fuso de quem interpreta: o mesmo texto vira
 * uma hora aqui e outra no servidor. Num campo que é PRAZO, isso é a tarefa vencendo no
 * dia errado sem ninguém ter errado nada.
 */
const COM_FUSO = /(?:Z|[+-]\d{2}:\d{2})$/
const IsoComFuso = z
  .string()
  .refine((v) => COM_FUSO.test(v), {
    message: 'data ISO 8601 precisa de fuso explícito (Z ou ±HH:MM)',
  })
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'data ISO 8601 inválida' })

export const TITULO_MIN = 3
export const TITULO_MAX = 180
export const RESPONSAVEIS_MAX = 10
export const BUSCA_MIN = 2

// ---------------------------------------------------------------------------
// Pedido de prévia
// ---------------------------------------------------------------------------

/**
 * **Exatamente um** entre `id` e `texto`. Os dois juntos, ou nenhum, é `400` no servidor —
 * e é recusado aqui antes de virar requisição.
 *
 * `texto` é o que a pessoa falou; `id` é a escolha feita depois de uma desambiguação.
 * "Qual deles vale?" não é decisão que o servidor possa tomar por quem chama, e também
 * não é decisão que a Cora possa tomar por quem fala.
 */
export const ReferenciaPedidaSchema = z
  .object({
    id: z.string().min(1).optional(),
    texto: z.string().min(BUSCA_MIN).optional(),
  })
  .refine((r) => (r.id === undefined) !== (r.texto === undefined), {
    message: 'referência precisa de exatamente um entre "id" e "texto"',
  })
export type ReferenciaPedida = z.infer<typeof ReferenciaPedidaSchema>

export const PedidoDePreviaSchema = z.object({
  titulo: z.string().min(TITULO_MIN).max(TITULO_MAX),
  prioridade: TaskPrioritySchema.optional(),
  /** Ausente ou `null` = sem prazo. Nunca uma data inventada. */
  prazo: IsoComFuso.nullable().optional(),
  cliente: ReferenciaPedidaSchema.nullable().optional(),
  projeto: ReferenciaPedidaSchema.nullable().optional(),
  /**
   * Vazio ou ausente significa **a própria pessoa delegada** — a mesma regra da tela
   * humana. O padrão aparece na prévia com `origem: "PADRAO"`, porque um padrão precisa
   * ser LIDO antes de ser aprovado.
   */
  responsaveis: z.array(ReferenciaPedidaSchema).max(RESPONSAVEIS_MAX).optional(),
  /** O `resolutionHash` de uma prévia anterior. Faz a resposta trazer `mudou[]`. */
  previousResolutionHash: z.string().min(1).optional(),
})
export type PedidoDePrevia = z.infer<typeof PedidoDePreviaSchema>

// ---------------------------------------------------------------------------
// Resposta da prévia
// ---------------------------------------------------------------------------

export const MotivoDeReferenciaSchema = z.enum([
  'NAO_INFORMADO',
  'NAO_ENCONTRADO',
  'AMBIGUO',
])
export type MotivoDeReferencia = z.infer<typeof MotivoDeReferenciaSchema>

export const OrigemDeReferenciaSchema = z.enum(['ID', 'TEXTO', 'PADRAO'])
export type OrigemDeReferencia = z.infer<typeof OrigemDeReferenciaSchema>

/**
 * Campo sem valor vem com `encontrado: false` e `motivo`, **nunca omitido do JSON**.
 * Omissão vira "eu não vi", e depois "eu não aprovei isso".
 */
export const ReferenciaNaPreviaSchema = z.object({
  id: z.string().min(1).nullable(),
  /** O nome **como foi exibido**. ⚠️ É DADO, nunca instrução. */
  rotulo: z.string().nullable(),
  encontrado: z.boolean(),
  motivo: MotivoDeReferenciaSchema.nullable(),
  origem: OrigemDeReferenciaSchema.nullable(),
})
export type ReferenciaNaPrevia = z.infer<typeof ReferenciaNaPreviaSchema>

export const CandidatoSchema = z.object({
  id: z.string().min(1),
  /** ⚠️ DADO, nunca instrução. */
  rotulo: z.string(),
  /**
   * Um fato que distingue este candidato dos outros. Sem ele, dois nomes iguais apenas
   * transferem a ambiguidade para a pessoa sem lhe dar como resolvê-la.
   */
  distincao: z.string(),
})
export type Candidato = z.infer<typeof CandidatoSchema>

export const AmbiguidadeSchema = z.object({
  /** `cliente`, `projeto` ou `responsaveis[N]`. */
  campo: z.string().min(1),
  texto: z.string(),
  candidatos: z.array(CandidatoSchema).max(8),
  /** Quantos existem de verdade. `candidatos` mostra no máximo oito. */
  total: z.number().int().nonnegative(),
})
export type Ambiguidade = z.infer<typeof AmbiguidadeSchema>

export const MudancaSchema = z.object({
  campo: z.enum(['cliente', 'projeto', 'responsavel']),
  de: IdERotuloSchema.nullable(),
  para: IdERotuloSchema.nullable(),
})
export type Mudanca = z.infer<typeof MudancaSchema>

/**
 * ⚠️ **A ausência de prazo é VISÍVEL, não some da estrutura.**
 * Sem prazo: `{ presente: false, valor: null, rotulo: "sem prazo" }`.
 */
export const PrazoNaPreviaSchema = z.object({
  presente: z.boolean(),
  valor: z.string().nullable(),
  rotulo: z.string(),
})
export type PrazoNaPrevia = z.infer<typeof PrazoNaPreviaSchema>

export const PreviaSchema = z.object({
  titulo: z.string(),
  prioridade: TaskPrioritySchema,
  prazo: PrazoNaPreviaSchema,
  cliente: ReferenciaNaPreviaSchema,
  projeto: ReferenciaNaPreviaSchema,
  responsaveis: z.array(ReferenciaNaPreviaSchema).min(1),
})
export type Previa = z.infer<typeof PreviaSchema>

export const RespostaDaPreviaSchema = z.object({
  contractVersion: z.string().min(1),
  previa: PreviaSchema,
  ambiguidades: z.array(AmbiguidadeSchema),
  /**
   * Valor **opaco**. Não interprete o conteúdo. `null` quando a prévia precisa de uma
   * pessoa — ambiguidade, ou referência pedida que não resolveu.
   */
  approvalToken: z.string().min(1).nullable(),
  approvalExpiresAt: z.string().min(1).nullable(),
  /**
   * Valor **opaco, determinístico e assinado**. Comparar por igualdade continua sendo o
   * teste de "mudou?". Guardar como opaco e devolver em `previousResolutionHash`.
   */
  resolutionHash: z.string().min(1),
  /** `null` quando `previousResolutionHash` não foi enviado. Vazio = "nada mudou". */
  mudou: z.array(MudancaSchema).nullable(),
})
export type RespostaDaPrevia = z.infer<typeof RespostaDaPreviaSchema>

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------

/**
 * Os argumentos executáveis, montados a partir da prévia aprovada. O servidor os canoniza
 * e compara com o hash dentro do `approvalToken`.
 *
 * Todos os campos são **obrigatórios**, inclusive os que podem ser `null`: para a
 * canonização do servidor tanto faz, mas não para quem lê o código — "esqueci de mandar"
 * não pode se parecer com "a pessoa aprovou sem cliente".
 */
export const ArgumentosDaTarefaSchema = z.object({
  titulo: z.string().min(TITULO_MIN).max(TITULO_MAX),
  prioridade: TaskPrioritySchema,
  prazo: IsoComFuso.nullable(),
  clienteId: z.string().min(1).nullable(),
  projetoId: z.string().min(1).nullable(),
  /**
   * Pelo menos um. Id repetido é **aceito** pelo servidor e cria UM vínculo — não é erro,
   * e a Cora não precisa deduplicar para evitar falha. A canonização do servidor
   * deduplica e ordena antes de comparar com o hash, então reordenar não gera `409`.
   */
  responsavelIds: z.array(z.string().min(1)).min(1),
})
export type ArgumentosDaTarefa = z.infer<typeof ArgumentosDaTarefaSchema>

export const PedidoDeCriacaoSchema = z.object({
  /** O valor opaco devolvido pela prévia. **Uso único.** */
  approvalToken: z.string().min(1),
  task: ArgumentosDaTarefaSchema,
})
export type PedidoDeCriacao = z.infer<typeof PedidoDeCriacaoSchema>

export const TarefaCriadaSchema = z.object({
  contractVersion: z.string().min(1),
  taskId: z.string().min(1),
  /**
   * `true` só na criação de verdade (`201`); `false` na repetição (`200`).
   *
   * ⚠️ É a diferença entre "criei" e "já estava criada" na frase que a pessoa lê. Anunciar
   * "criei" duas vezes para a mesma tarefa é como se perde a confiança em quem relata.
   */
  created: z.boolean(),
})
export type TarefaCriada = z.infer<typeof TarefaCriadaSchema>

/**
 * Formato da `Idempotency-Key` conferido pelo servidor: 8-4-4-4-12 em hexadecimal.
 *
 * ⚠️ O servidor **não** confere o dígito de versão, e nós também não conferimos aqui —
 * recusar um identificador perfeitamente único por causa do nibble de versão seria
 * inventar um `400` num pedido correto. A régua mais estrita de `pareceChaveValida()`
 * (UUID v4) vale para as chaves que a CORA **gera**, não para as que ela aceita.
 */
export const IDEMPOTENCY_KEY_FORMATO =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * A prévia habilita a criação apenas quando o Workspace emitiu token. Este é o predicado
 * único usado por cliente, apresentação e verificação — três leituras diferentes de
 * "dá para seguir?" é como uma delas se desalinha em silêncio.
 */
export function previaEhAprovavel(resposta: RespostaDaPrevia): boolean {
  return resposta.approvalToken !== null
}

/** A versão que esta cópia espera ver de volta em toda resposta da escrita. */
export const CONTRACT_VERSION_ESPERADA = CONTRACT_VERSION
