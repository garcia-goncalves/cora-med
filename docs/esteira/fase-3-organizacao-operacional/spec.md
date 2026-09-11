# Spec — Fase 3: organização e resumo operacional

## problema

Hoje a Cora já distingue "zero tarefas" de "erro de consulta"
(`apps/server/src/tools/workspace-tasks.ts`), mas não existe uma terceira frase para
"só consegui ver parte" — uma paginação que estoura o teto de páginas ou entra em laço
de cursor vira `ContractViolationError` (`packages/workspace-client/src/pagination.ts`),
tratada como bug, nunca como um fato que a Thaís precisa ouvir. Sem isso, "não encontrei
pendências" pode estar mentindo por sincronização incompleta, e ninguém percebe. Também
não existe hoje nenhuma estrutura própria da Cora para itens que ainda precisam de
classificação — cada consulta ao Workspace é descartável, e não há lugar para agregar
"o que está pendente" citando de onde veio cada item.

## solucao

Um `InboxItem` — estrutura interna da Cora, não cópia do contrato do Workspace — que
hoje só sabe representar `tarefa` (Card e Evento ficam para quando o `CORA-005`
responder). Populado a partir de `workspace.tasks.list`, deduplicado por
`(fonte, identificadorDoWorkspace)` no mesmo padrão que `pagination.ts` já usa para
`seenIds` — chave derivada de propósito, ao contrário da `Idempotency-Key` aleatória de
`write.ts`, que resolve um problema diferente. O resumo operacional ganha um quarto
estado nomeado — "sincronização incompleta" — a partir do mesmo sinal que hoje vira
exceção em `collectAllTasks`, seguindo o formato de união discriminada com uma frase por
estado que `apps/server/src/run/idempotency.ts` (`ResultadoDeCriacao`,
`descreverResultado`) já usa. Cada item do resumo carrega a fonte, reaproveitando o
formato de `wrapUntrusted({ source: 'workspace:tasks', ... })` já em uso. Por fim, um
matcher simples (igualdade normalizada, sem algoritmo fonético) sinaliza nomes
parecidos como sugestão, nunca fundindo automaticamente.

## o_que_ja_existe

- `apps/server/src/tools/workspace-tasks.ts:41-48,49,66` — já separa "lista vazia" de
  "erro de consulta" com frases distintas; falta só o terceiro/quarto estado.
- `packages/workspace-client/src/pagination.ts:14-82` — `collectAllTasks` já detecta
  cursor repetido e teto de páginas via `seenIds`/`seenCursors` (`Set<string>`); hoje
  lança `ContractViolationError`, precisa devolver um resultado parcial estruturado
  quando o motivo for "estourei o teto de páginas" (defeito real — cursor em laço —
  continua exceção).
- `apps/server/src/run/idempotency.ts:39-51` — `ResultadoDeCriacao` e
  `descreverResultado` são o modelo de união discriminada com frase por estado a
  repetir para o resumo operacional.
- `packages/policy/src/untrusted.ts` (`wrapUntrusted`, `cortarParaLimite`) — reaproveitado
  sem mudança para qualquer texto que entre na fila.
- `packages/contracts/src/cora/execution.ts:4-7` — único arquivo do pacote de contratos
  que já é "protocolo interno da Cora", não cópia do Workspace; `InboxItem` nasce ao
  lado, em `packages/contracts/src/cora/inbox.ts`, exportado por
  `packages/contracts/src/index.ts`.
- `apps/server/src/run/turn.ts:61-62` — `Map`/array em memória (`approvals`,
  `ExecutionRecord[]`) é o padrão de estado do turno; não há persistência no projeto
  (`docs/ARCHITECTURE.md:120-121` lista banco como "ainda planejado", nada escrito) —
  a fila desta fase também vive em memória de processo.
- `apps/server/src/tools/workspace-create-task.test.ts:378-383` — o teste que já prova
  "todas as frases de todos os estados são diferentes entre si"
  (`new Set(frases).size === CODIGOS.length`) é o padrão a repetir para as quatro frases
  do resumo.

## fontes_externas

nenhuma

## fora_de_escopo

- Card e Evento reais — aguardando `CORA-005` (já aberto e enviado ao Workspace,
  commit `0ff6190` em `med-coordination`). O discriminador de tipo do `InboxItem` só
  implementa `'tarefa'` agora; não pré-modelar campos ou validação para os outros dois
  antes da resposta chegar — o próprio histórico do contrato de Tarefa mostra o custo de
  desenhar forma antes da hora (`docs/ROADMAP.md:104-108`).
- Persistência em banco/disco — a fila vive em memória de processo, como todo o resto do
  estado de turno hoje.
- "Colar um texto (e-mail, frase solta) para a Cora classificar" — mencionado na intenção
  do briefing mas sem nenhum critério de aceitação testável correspondente (ver
  `contradicoes_resolvidas`). Fica fora desta entrega.
- Algoritmo de similaridade sofisticado (fonético, distância de edição) para nomes
  parecidos — igualdade normalizada/substring já satisfaz "sugere, nunca funde"; mais que
  isso é sofisticação não pedida.

## contradicoes_resolvidas

- **Analista encontrou lacuna real**: a `entendimento` do briefing cita "colando algo
  para a Cora classificar", mas nenhum item do `criterio_de_aceitacao` descreve esse
  fluxo — não há identificador do Workspace num texto colado, então a regra de dedup por
  "fonte + identificador" não se aplica. **Decisão**: o Diretor recomendou não adivinhar
  a forma e cortar da entrega atual, e a favor disso pesa que nenhum critério de
  aceitação exige — mantenho o corte (já registrado em `fora_de_escopo`) em vez de
  inventar um comportamento. Isto não é uma decisão de produto que muda o que a Fase 3
  entrega hoje, então não sobe como dúvida ao dono; se for retomado, vira o pedido de uma
  próxima fase, com critério de aceitação próprio.
- **Pesquisador identificou duas filosofias de idempotência coexistindo**: `write.ts`
  gera chave aleatória de propósito (evita colidir duas tarefas legitimamente iguais);
  a Fase 3 precisa do oposto, uma chave derivada de conteúdo para reconhecer "já vi este
  registro". **Decisão**: seguir o padrão de `seenIds` de `pagination.ts` (chave
  derivada), nunca o de `Idempotency-Key` — registrado aqui para o plano não copiar o
  padrão errado por analogia superficial de nome ("idempotência").
- **Arquiteto identificou que a paginação parcial hoje é tratada como bug** (exceção),
  mas a Fase 3 precisa dela como fato de negócio. **Decisão**: `collectAllTasks` (ou
  quem a chama) passa a devolver um resultado parcial estruturado quando o motivo for
  "estourei o teto de páginas"; cursor em laço continua sendo defeito real e continua
  lançando exceção — as duas causas de `ContractViolationError` deixam de ser tratadas
  como uma coisa só.

## duvidas_para_o_dono

nenhuma
