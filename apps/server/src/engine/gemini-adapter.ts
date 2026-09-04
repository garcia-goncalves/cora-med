import type { ToolCallProposal } from '@cora/contracts'
import { estaEmbrulhado } from '@cora/policy'

import { calcularCustoGemini, MODELO_GEMINI_GRATUITO, type CustoPasso } from './gemini-pricing.js'
import { montarInstrucaoDeSistema } from './persona.js'
import {
  MotorError,
  type MotorMessage,
  type MotorPort,
  type MotorStepInput,
  type MotorStepOutput,
} from './port.js'
import type { EsquemaFerramenta } from './tool-schemas.js'
import { montarFerramentas } from './tool-schemas.js'

/**
 * Motor de TESTE da Cora sobre a API do Gemini (Google AI Studio, nível gratuito).
 *
 * Ver `docs/decisions/0003-motor-de-teste-gemini.md`: decisão temporária e reversível,
 * enquanto a Fase 2 mede uso real sem gastar dinheiro. O plugue é o mesmo `MotorPort` da
 * ADR 0001 — nada fora deste arquivo (e de `gemini-pricing.ts`) sabe que existe um Gemini.
 *
 * O que este adaptador NÃO faz, e não pode passar a fazer — mesmas regras do
 * `AnthropicMotor`:
 * - não executa ferramenta (quem executa é `runTurn`);
 * - não afrouxa teto de chamadas nem de tempo (são da aplicação);
 * - não desembrulha conteúdo externo (ele chega já dentro de bloco não confiável).
 *
 * O cliente entra por injeção — `pnpm run test` continua sem rede.
 */

// ---------------------------------------------------------------------------------------
// A fatia da API do Gemini que este adaptador usa. Formato do endpoint REST
// `generateContent` (v1beta) — não um SDK, por decisão: o servidor da Cora já não usa
// framework nenhum para HTTP (ver ARCHITECTURE.md), e um `fetch` direto evita depender da
// forma exata de um pacote novo sem poder testá-la contra a internet real nesta sessão.
// ---------------------------------------------------------------------------------------

export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } }

export interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

export interface GeminiFunctionDeclaration {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface GeminiGenerateContentRequest {
  contents: GeminiContent[]
  systemInstruction?: { parts: [{ text: string }] }
  tools?: [{ functionDeclarations: GeminiFunctionDeclaration[] }]
  generationConfig?: { maxOutputTokens?: number }
}

export interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { role: string; parts: GeminiPart[] }
    finishReason?: string
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    cachedContentTokenCount?: number
  }
  promptFeedback?: { blockReason?: string }
}

/** A fatia do provedor que este adaptador usa. Estreita de propósito, igual à do Anthropic. */
export interface GeminiGenerateContentApi {
  create(
    params: GeminiGenerateContentRequest,
    options?: { signal?: AbortSignal },
  ): Promise<GeminiGenerateContentResponse>
}

/**
 * Motivos de parada do Gemini que significam "recusado por segurança", não "resposta
 * vazia" nem "erro de rede" — mesma distinção que o `AnthropicMotor` faz para `refusal`.
 */
const MOTIVOS_DE_RECUSA = new Set([
  'SAFETY',
  'RECITATION',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
])

export interface GeminiMotorOptions {
  api: GeminiGenerateContentApi
  /** Padrão: nível gratuito do Google AI Studio (ver `gemini-pricing.ts`). */
  model?: string
  maxTokens?: number
  /** Substitui a PERSONA. O núcleo inegociável é acrescentado sempre — ver `persona.ts`. */
  system?: string
  onUsage?: (custo: CustoPasso) => void
}

export const MAX_TOKENS_PADRAO = 4096

export class GeminiMotor implements MotorPort {
  readonly name = 'gemini'

  private readonly api: GeminiGenerateContentApi
  private readonly model: string
  private readonly maxTokens: number
  private readonly system: string
  private readonly onUsage?: (custo: CustoPasso) => void

  /** Mesma trava de turno único do `AnthropicMotor` — ver o comentário lá para o porquê. */
  private runIdDoTurno: string | null = null
  private emVoo = false

  private consumidas = 0
  private readonly historico: GeminiContent[] = []
  /** Nomes das ferramentas propostas no último passo, na ordem em que foram propostas. */
  private chamadasPendentes: string[] = []

  constructor(options: GeminiMotorOptions) {
    this.api = options.api
    this.model = options.model ?? MODELO_GEMINI_GRATUITO
    this.maxTokens = options.maxTokens ?? MAX_TOKENS_PADRAO
    this.system = montarInstrucaoDeSistema(options.system)
    this.onUsage = options.onUsage
  }

  async step(input: MotorStepInput): Promise<MotorStepOutput> {
    if (input.signal.aborted) throw new MotorError('cancelado antes de chamar o modelo', this.name)

    this.exigirMesmoTurno(input.requester.runId)
    if (this.emVoo) {
      throw new MotorError(
        'Dois passos deste motor se sobrepuseram. O histórico é de um turno só; ' +
          'sobrepor embaralharia as mensagens. Use um motor por turno.',
        this.name,
      )
    }
    this.emVoo = true
    try {
      return await this.executarPasso(input)
    } finally {
      this.emVoo = false
    }
  }

  private async executarPasso(input: MotorStepInput): Promise<MotorStepOutput> {
    this.absorverNovasMensagens(input.messages)

    // Fora do `try` de propósito: falta de esquema é bug DESTA casa, não do provedor.
    const ferramentas = montarFerramentas(input.availableTools)
    const tools: GeminiGenerateContentRequest['tools'] =
      ferramentas.length === 0
        ? undefined
        : [
            {
              functionDeclarations: ferramentas.map((f) => ({
                name: f.name,
                description: f.description,
                parameters: traduzirEsquemaParaGemini(f.input_schema),
              })),
            },
          ]

    let resposta: GeminiGenerateContentResponse
    try {
      resposta = await this.api.create(
        {
          systemInstruction: { parts: [{ text: this.system }] },
          tools,
          generationConfig: { maxOutputTokens: this.maxTokens },
          // Cópia, não a lista viva — mesmo motivo do `AnthropicMotor`.
          contents: [...this.historico],
        },
        { signal: input.signal },
      )
    } catch (cause) {
      // ⚠️ `MotorError.message` é texto de LOG, não de tela — mesma regra do outro motor.
      throw new MotorError(
        `A chamada ao modelo falhou: ${cause instanceof Error ? cause.message : String(cause)}`,
        this.name,
      )
    }

    this.registrarCusto(resposta)

    const candidato = resposta.candidates?.[0]
    if (!candidato) {
      const motivo = resposta.promptFeedback?.blockReason
      throw new MotorError(
        `O provedor não devolveu candidato algum${motivo ? ` (motivo: ${motivo})` : ''}.`,
        this.name,
      )
    }

    if (candidato.finishReason && MOTIVOS_DE_RECUSA.has(candidato.finishReason)) {
      throw new MotorError(
        `O provedor recusou responder a este pedido (motivo: ${candidato.finishReason}).`,
        this.name,
      )
    }

    const partes = candidato.content?.parts ?? []
    this.historico.push({ role: 'model', parts: partes })

    const textos: string[] = []
    const proposals: ToolCallProposal[] = []
    this.chamadasPendentes = []

    for (const parte of partes) {
      if ('text' in parte) {
        textos.push(parte.text)
      } else if ('functionCall' in parte) {
        this.chamadasPendentes.push(parte.functionCall.name)
        proposals.push({
          toolName: parte.functionCall.name,
          args: exigirObjeto(parte.functionCall.args, parte.functionCall.name, this.name),
        })
      }
    }

    const reply = textos.join('\n').trim()
    return { reply: reply === '' ? null : reply, proposals }
  }

  private exigirMesmoTurno(runId: string): void {
    if (this.runIdDoTurno === null) {
      this.runIdDoTurno = runId
      return
    }
    if (this.runIdDoTurno !== runId) {
      throw new MotorError(
        `Este motor já está servindo o turno "${this.runIdDoTurno}" e foi chamado para ` +
          `"${runId}". Uma instância guarda o histórico de UM turno: reaproveitá-la levaria ` +
          'a conversa de uma pessoa para dentro da resposta de outra. Crie um motor por ' +
          'turno com `criarMotorGeminiPorTurno`.',
        this.name,
      )
    }
  }

  /**
   * Traduz as mensagens que o laço acrescentou desde o passo anterior — mesma lógica do
   * `AnthropicMotor`, adaptada ao par `functionCall`/`functionResponse` do Gemini, que
   * pareia por NOME (o Gemini não tem um id de chamada como o `tool_use.id` da Anthropic).
   * Falha alto se as contas não baterem, pelo mesmo motivo de lá.
   */
  private absorverNovasMensagens(messages: readonly MotorMessage[]): void {
    const novas = messages.slice(this.consumidas)
    this.consumidas = messages.length

    const resultados = novas.filter((m) => m.role === 'tool_result')
    if (resultados.length !== this.chamadasPendentes.length) {
      throw new MotorError(
        `Recebi ${resultados.length} resultado(s) de ferramenta para ` +
          `${this.chamadasPendentes.length} chamada(s) proposta(s). Parear fora de ordem faria ` +
          'o modelo raciocinar sobre a ferramenta errada, então prefiro falhar aqui.',
        this.name,
      )
    }

    const pendentes = [...this.chamadasPendentes]
    for (const m of novas) {
      if (m.role === 'tool_result') {
        const toolName = pendentes.shift()
        if (!toolName) throw new MotorError('resultado de ferramenta sem chamada', this.name)
        if (!estaEmbrulhado(m.content)) {
          throw new MotorError(
            'Resultado de ferramenta chegou sem o bloco de dado não confiável. Conteúdo ' +
              'externo entra marcado ou não entra.',
            this.name,
          )
        }
        // `functionResponse.response` precisa ser um objeto — o Gemini rejeita string
        // crua. O conteúdo (já embrulhado como dado não confiável) entra num campo fixo.
        this.historico.push({
          role: 'user',
          parts: [{ functionResponse: { name: toolName, response: { content: m.content } } }],
        })
      } else if (m.role === 'assistant') {
        this.historico.push({ role: 'model', parts: [{ text: m.content }] })
      } else {
        // 'user' e 'system': instrução vinda do laço entra como fala do usuário rotulada,
        // nunca dentro de `systemInstruction` — que é a da Cora e não pode ser reescrita
        // por conteúdo que chegou depois.
        this.historico.push({
          role: 'user',
          parts: [{ text: m.role === 'system' ? `[instrução de operação] ${m.content}` : m.content }],
        })
      }
    }
    this.chamadasPendentes = []
  }

  private registrarCusto(resposta: GeminiGenerateContentResponse): void {
    if (!this.onUsage) return
    const u = resposta.usageMetadata
    this.onUsage(
      calcularCustoGemini(this.model, {
        entrada: u?.promptTokenCount ?? 0,
        saida: u?.candidatesTokenCount ?? 0,
        cache: u?.cachedContentTokenCount ?? 0,
      }),
    )
  }
}

function exigirObjeto(
  valor: unknown,
  toolName: string,
  motorName: string,
): Record<string, unknown> {
  if (valor === null || valor === undefined) return {}
  if (typeof valor !== 'object' || Array.isArray(valor)) {
    throw new MotorError(
      `O modelo propôs "${toolName}" com argumentos que não são um objeto ` +
        `(${Array.isArray(valor) ? 'lista' : typeof valor}). Não dá para executar isso.`,
      motorName,
    )
  }
  return valor as Record<string, unknown>
}

/**
 * Traduz um esquema de ferramenta (JSON Schema, o mesmo de `tool-schemas.ts`) para o
 * subconjunto que a API do Gemini aceita. Duas diferenças confirmadas em 04/09/2026:
 *
 * - `oneOf` NÃO é suportado. Achatamos num único objeto com as propriedades de todos os
 *   ramos — a regra "exatamente um destes campos" sai do esquema e vira só instrução em
 *   `description`. É uma DEGRADAÇÃO real: o Gemini pode mandar `id` e `texto` juntos, e
 *   nada no esquema o impede. Quem valida de verdade continua sendo o servidor (mesma
 *   trava de sempre, ver `REFERENCIA` em `tool-schemas.ts`) — é só o esquema que fica
 *   mais fraco. Não corrigir isto num motor de teste é aceitável; corrigir antes de
 *   qualquer coisa em produção é obrigatório.
 * - `maximum` também não é suportado — removido, perde o teto declarado no esquema
 *   (ex.: `workspace.tasks.list.limit`), mas a descrição do campo continua orientando.
 * - `additionalProperties` também não é suportado — confirmado só em 04/09/2026, ao ligar
 *   o motor de verdade pela primeira vez (`HTTP 400 Bad Request`, campo
 *   `tools[0].function_declarations[N].parameters`). A validação real continua sendo a do
 *   servidor (mesma trava de sempre); é só o esquema mandado ao Gemini que fica mais frouxo.
 */
export function traduzirEsquemaParaGemini(schema: EsquemaFerramenta): Record<string, unknown> {
  return traduzirNo(schema) as Record<string, unknown>
}

function traduzirNo(no: unknown): unknown {
  if (no === null || typeof no !== 'object') return no
  if (Array.isArray(no)) return no.map(traduzirNo)

  const objeto = no as Record<string, unknown>

  if (Array.isArray(objeto.oneOf)) {
    const propriedades: Record<string, unknown> = {}
    for (const ramo of objeto.oneOf as Array<Record<string, unknown>>) {
      const ramoProps = (ramo.properties ?? {}) as Record<string, unknown>
      for (const [nome, valor] of Object.entries(ramoProps)) {
        propriedades[nome] = traduzirNo(valor)
      }
    }
    const descricaoBase = typeof objeto.description === 'string' ? `${objeto.description} ` : ''
    return {
      type: 'object',
      properties: propriedades,
      description: `${descricaoBase}(informe EXATAMENTE um destes campos, nunca os dois).`,
    }
  }

  const resultado: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(objeto)) {
    // Confirmados sem suporte na API do Gemini em 04/09/2026 — enviá-los quebra a chamada.
    if (chave === 'maximum' || chave === 'default' || chave === 'optional' || chave === 'additionalProperties')
      continue
    resultado[chave] = traduzirNo(valor)
  }
  return resultado
}

/**
 * Fábrica de motor **por turno** — mesma disciplina da ADR 0001/0002: configuração criada
 * uma vez, motor criado a cada turno, para o histórico de um turno nunca vazar no seguinte.
 */
export function criarMotorGeminiPorTurno(config: GeminiMotorOptions): () => GeminiMotor {
  return () => new GeminiMotor(config)
}

/**
 * Cliente real, via `fetch` — endpoint REST `generateContent` (v1beta). A chave vai no
 * cabeçalho `x-goog-api-key`, nunca na URL: URL de requisição pode acabar em log de proxy
 * ou de acesso, e cabeçalho de autenticação normalmente não.
 */
export function criarClienteGeminiHttp(options: { apiKey: string; model?: string }): GeminiGenerateContentApi {
  const model = options.model ?? MODELO_GEMINI_GRATUITO
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  return {
    async create(params, callOptions) {
      const resposta = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': options.apiKey,
        },
        body: JSON.stringify(params),
        signal: callOptions?.signal,
      })

      if (!resposta.ok) {
        // O corpo de erro do Gemini não contém a chave (ela nunca viajou no corpo), mas
        // pode ecoar trecho da requisição — mesma ressalva do `AnthropicMotor` sobre
        // `MotorError.message` ser texto de log, não de tela.
        const corpo = await resposta.text().catch(() => '')
        throw new Error(`HTTP ${resposta.status} ${resposta.statusText}: ${corpo}`)
      }

      return (await resposta.json()) as GeminiGenerateContentResponse
    },
  }
}
