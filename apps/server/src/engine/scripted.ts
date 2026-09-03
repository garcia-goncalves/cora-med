import type { MotorPort, MotorStepInput, MotorStepOutput } from './port.js'
import { MotorError } from './port.js'

/**
 * Motor roteirizado, para teste. Devolve passos pré-programados, sem provedor e sem rede.
 *
 * Existe para provar o LAÇO da Cora — política, limites, cancelamento, registro — sem
 * depender de LLM. Não é um motor de produção e nunca deve ser registrado como tal.
 */
export class ScriptedMotor implements MotorPort {
  readonly name = 'scripted-test'
  private index = 0

  constructor(private readonly steps: readonly MotorStepOutput[]) {}

  async step(input: MotorStepInput): Promise<MotorStepOutput> {
    if (input.signal.aborted) throw new MotorError('cancelado', this.name)
    const next = this.steps[this.index]
    this.index += 1
    if (!next) {
      // Roteiro acabou: encerra o turno em vez de repetir o último passo.
      return { reply: null, proposals: [] }
    }
    return next
  }

  /** Quantos passos o motor já executou. Usado para checar tetos nos testes. */
  get callCount(): number {
    return this.index
  }
}
