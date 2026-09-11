import { chaveDeInbox, type InboxItem } from '@cora/contracts'

/**
 * Fila de entrada em memória de processo, com deduplicação por `chaveDeInbox`.
 *
 * A chave é **derivada de conteúdo** — `(fonte, identificadorDoWorkspace)` — não é a
 * `Idempotency-Key` aleatória de `apps/server/src/run/idempotency.ts`. Os dois padrões
 * resolvem problemas opostos: aqui, o MESMO item visto duas vezes precisa ser reconhecido
 * como o mesmo item, para não virar duplicata na inbox; lá, duas tentativas do MESMO pedido
 * não podem criar duas tarefas. Não "corrija" uma pela outra. O padrão de dedup por chave
 * derivada é o mesmo `seenIds`/`Set<string>` de
 * `packages/workspace-client/src/pagination.ts:22-23`.
 *
 * Estado em memória de processo, como `approvals`/`records` em
 * `apps/server/src/run/turn.ts:61-62`. Sem banco, sem disco, sem singleton de módulo — quem
 * precisar de uma fila cria uma instância.
 */
export class FilaDeEntrada {
  private readonly vistos = new Set<string>()
  private readonly registro: InboxItem[] = []

  /**
   * Adiciona um item. Se a chave já foi vista, o item é descartado e o que já estava na
   * fila **não** é sobrescrito — o primeiro registro é o que vale.
   */
  adicionar(item: InboxItem): 'novo' | 'duplicado' {
    const chave = chaveDeInbox(item)
    if (this.vistos.has(chave)) {
      return 'duplicado'
    }
    this.vistos.add(chave)
    this.registro.push(item)
    return 'novo'
  }

  /** Cópia, na ordem de inserção — mutar o array devolvido não altera a fila. */
  itens(): readonly InboxItem[] {
    return [...this.registro]
  }

  tamanho(): number {
    return this.registro.length
  }

  limpar(): void {
    this.vistos.clear()
    this.registro.length = 0
  }
}
