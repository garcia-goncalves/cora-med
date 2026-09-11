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
  /**
   * Mapa em vez de `Set` + array: a chave já carrega a posição, e sobrescrever o valor de
   * uma chave existente é o upsert inteiro — sem precisar apagar e reinserir para atualizar.
   */
  private readonly registro = new Map<string, InboxItem>()

  /**
   * Adiciona um item. Se a chave já existia, o registro é **substituído** pelo mais novo —
   * upsert, não descarte. Uma integração real mostrou o custo do comportamento antigo
   * ("o primeiro registro é o que vale"): tarefa que saía de `PENDENTE` para `FAZENDO` ou
   * `CONCLUIDA` nunca atualizava na fila, e o resumo continuava reportando o status velho
   * para sempre, enquanto o processo vivesse.
   */
  adicionar(item: InboxItem): 'novo' | 'duplicado' {
    const chave = chaveDeInbox(item)
    const eraNovo = !this.registro.has(chave)
    this.registro.set(chave, item)
    return eraNovo ? 'novo' : 'duplicado'
  }

  /**
   * Reconcilia uma fonte inteira contra uma sincronização **completa**: todo item que já
   * estava na fila com aquela `fonte` e não aparece em `itens` é removido, e os itens novos
   * entram (ou atualizam, via `adicionar`). Só faz sentido para coleta completa — uma visão
   * parcial não pode concluir que algo sumiu, e não deve chamar este método.
   */
  substituirFonte(fonte: InboxItem['fonte'], itens: readonly InboxItem[]): void {
    for (const [chave, itemGuardado] of this.registro) {
      if (itemGuardado.fonte === fonte) {
        this.registro.delete(chave)
      }
    }
    for (const item of itens) {
      this.adicionar(item)
    }
  }

  /** Cópia, na ordem de inserção — mutar o array devolvido não altera a fila. */
  itens(): readonly InboxItem[] {
    return [...this.registro.values()]
  }

  tamanho(): number {
    return this.registro.size
  }

  limpar(): void {
    this.registro.clear()
  }
}
