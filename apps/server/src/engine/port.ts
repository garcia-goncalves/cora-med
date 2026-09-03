import type { RequesterContext, ToolCallProposal } from '@cora/contracts'

/**
 * `MotorPort` — a fronteira entre a Cora e qualquer motor de agente.
 *
 * Existe por causa da ADR 0001: o Hermes NÃO foi adotado como motor embutido, e a
 * decisão precisa ser reversível sem reescrever o produto. Tudo que um motor pode
 * fazer passa por esta interface; nada além dela conhece o motor.
 *
 * Contrato de comportamento, não negociável por implementação:
 * - o motor PROPÕE chamadas de ferramenta; quem executa é o servidor da Cora;
 * - o motor recebe `RequesterContext` já verificado e não pode alterá-lo;
 * - `AbortSignal` é obrigatório: toda execução é cancelável;
 * - `maxModelCalls` é aplicado pelo chamador, não pela boa vontade do motor;
 * - **uma instância serve UM turno.** Implementação com estado — e um motor de conversa
 *   costuma ter — guardaria o histórico de um turno e o levaria para o seguinte, o que
 *   num sistema de clínica é a conversa de uma pessoa aparecendo na resposta a outra.
 *   Quem implementa com estado deve recusar `runId` diferente daquele a que se amarrou,
 *   em vez de confiar em quem injeta a dependência.
 */
export interface MotorPort {
  readonly name: string

  /**
   * Um passo de raciocínio. Devolve texto para o usuário e/ou propostas de ferramenta.
   * Nunca executa nada por conta própria.
   */
  step(input: MotorStepInput): Promise<MotorStepOutput>
}

export interface MotorStepInput {
  requester: RequesterContext
  /** Mensagens já montadas pela Cora, com conteúdo externo dentro de bloco não confiável. */
  messages: readonly MotorMessage[]
  /** Nomes de ferramentas oferecidas neste passo. Subconjunto do catálogo da política. */
  availableTools: readonly string[]
  signal: AbortSignal
}

export interface MotorMessage {
  role: 'system' | 'user' | 'assistant' | 'tool_result'
  content: string
}

export interface MotorStepOutput {
  /** Texto para o usuário, se houver. */
  reply: string | null
  /** Propostas de chamada. Lista vazia = o motor terminou. */
  proposals: readonly ToolCallProposal[]
}

/** Erro do motor. Distingue "o motor falhou" de "a ferramenta falhou". */
export class MotorError extends Error {
  constructor(
    message: string,
    readonly motorName: string,
  ) {
    super(message)
    this.name = 'MotorError'
  }
}
