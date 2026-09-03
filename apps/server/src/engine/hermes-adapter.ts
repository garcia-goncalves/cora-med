import { MotorError, type MotorPort, type MotorStepInput, type MotorStepOutput } from './port.js'

/**
 * Adaptador do Hermes — DECLARADO, NÃO IMPLEMENTADO.
 *
 * A ADR 0001 avaliou o Hermes no commit `7840a0e2d96b66a5c6b2a219f79af1900a74e03c` e
 * decidiu não embuti-lo agora. Este arquivo existe para que a decisão continue
 * reversível e para que o caminho de volta seja explícito, não uma reescrita.
 *
 * Se e quando o Hermes entrar, a integração pretendida é: a Cora expõe suas ferramentas
 * por MCP (a costura de extensão documentada do Hermes) e este adaptador fala com um
 * processo Hermes separado — sem fork do código-fonte.
 *
 * Ele FALHA de propósito. Nada no produto pode dizer "temos Hermes" enquanto isto for
 * verdade, e nenhum caminho silencioso cai num motor de mentira.
 */
export class HermesMotorAdapter implements MotorPort {
  readonly name = 'hermes'

  async step(_input: MotorStepInput): Promise<MotorStepOutput> {
    throw new MotorError(
      'Motor Hermes não está implementado. Ver docs/decisions/0001-agent-runtime.md — ' +
        'a decisão registrada é não embutir o Hermes nesta fase.',
      this.name,
    )
  }
}
