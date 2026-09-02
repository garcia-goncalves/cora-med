import type { RequesterContext } from '@cora/contracts'
import { findTool } from '@cora/policy'

/**
 * Registro de execução das ferramentas.
 *
 * O catálogo (`@cora/policy`) diz o que EXISTE e qual o risco; este registro diz o que
 * de fato roda. Uma ferramenta só executa se estiver nos dois — e o registro se recusa
 * a registrar nome que não esteja no catálogo, para que os dois não deslizem.
 */
export type ToolHandler = (args: {
  args: Record<string, unknown>
  requester: RequesterContext
  signal: AbortSignal
}) => Promise<unknown>

export class ToolRegistry {
  private readonly handlers = new Map<string, ToolHandler>()

  register(name: string, handler: ToolHandler): this {
    const spec = findTool(name)
    if (!spec) {
      throw new Error(`Ferramenta "${name}" não existe no catálogo da política`)
    }
    if (!spec.implemented) {
      throw new Error(
        `Ferramenta "${name}" está marcada como não implementada no catálogo; ` +
          'atualize o catálogo antes de registrar um executor',
      )
    }
    if (this.handlers.has(name)) {
      throw new Error(`Ferramenta "${name}" já registrada`)
    }
    this.handlers.set(name, handler)
    return this
  }

  get(name: string): ToolHandler | undefined {
    return this.handlers.get(name)
  }

  /** Nomes que podem ser oferecidos ao motor neste momento. */
  availableToolNames(): string[] {
    return [...this.handlers.keys()].sort()
  }
}
