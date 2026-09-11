# Plano de execução — Fase 3: organização e resumo operacional

Fonte de escopo: `docs/esteira/fase-3-organizacao-operacional/briefing.md` e
`.../spec.md` (ambos aprovados; escopo **não** se reabre aqui).
Base: `main` em `868211e`. Índice do grafo de código conferido: `ready`, mesmo HEAD.

---

## Contexto verificado

- `packages/contracts/src/cora/execution.ts` é hoje o único arquivo "protocolo interno
  da Cora" do pacote de contratos; `packages/contracts/src/index.ts` tem 5 linhas de
  `export *` e ainda **não** exporta nada de `cora/inbox.js`. O arquivo `inbox.ts` **não
  existe** — nasce nesta fase.
- `collectAllTasks` (`packages/workspace-client/src/pagination.ts:14-82`) devolve hoje
  `Promise<{ tasks: Task[]; pages: number }>` e lança `ContractViolationError` em **três**
  situações distintas: id repetido entre páginas (linha 58), cursor em laço (linha 70) e
  teto de páginas (linha 76). Só a terceira vira resultado parcial nesta fase.
- Consumidores de `collectAllTasks` fora dos testes: `scripts/integracao-tarefas.ts:105` e
  `scripts/verificacao-fase-01.ts:219` — os dois destruturam `{ tasks, pages }`, então uma
  união discriminada que mantenha esses dois campos em **todos** os ramos não quebra o
  `typecheck`. Quebra, sim, o *significado* dos dois scripts, por isso eles entram na
  Etapa 2.
- Nenhum teste existente cobre o estouro de teto de páginas. O teste
  `packages/workspace-client/src/client.test.ts:349-362` ("cursor que se repete") dispara o
  ramo de **cursor em laço**, não o do teto — logo, transformar o teto em resultado parcial
  não derruba teste que já existe.
- `apps/server/src/run/idempotency.ts:39-69` é o modelo a repetir: união discriminada por
  `estado` + `descreverResultado` com `switch` exaustivo, uma frase por estado.
- O teste de frases distintas a repetir é
  `apps/server/src/tools/workspace-create-task.test.ts:378-383`
  (`expect(new Set(frases).size).toBe(CODIGOS.length)`).
- `apps/server/src/tools/workspace-tasks.ts:49-98` já tem as duas frases atuais
  (`describeTasksForUser` / `describeListTasksFailure`). **Este arquivo não é tocado por
  nenhuma etapa** — o resumo é um módulo novo, e `describeListTasksFailure` é reaproveitada
  por importação.
- `wrapUntrusted` / `cortarParaLimite` / `estaEmbrulhado` existem em
  `packages/policy/src/untrusted.ts` e são exportados por `@cora/policy`. `cortarParaLimite`
  vem **antes** de `wrapUntrusted`, sempre (ver `apps/server/src/run/turn.ts:210-220`).
- O catálogo de ferramentas (`packages/policy/src/tools.ts:26-56`) é fechado e hoje tem 5
  nomes; `apps/server/src/engine/tool-schemas.ts:84-152` tem esquema para 2 deles. O teste
  `tool-schemas.test.ts:7-15` proíbe esquema **órfão** (esquema sem catálogo), mas **não**
  exige esquema para todo item do catálogo — então acrescentar catálogo + esquema no mesmo
  passo mantém a suíte verde.
- Estado em memória de processo é o padrão vigente (`apps/server/src/run/turn.ts:61-62`);
  não há banco nem persistência em lugar nenhum do repositório.
- Fixtures sintéticas prontas para reúso:
  `packages/contracts/src/fixtures/tarefas-sinteticas.ts` (`tarefaDeA`,
  `tarefaCompartilhada`, `tarefaComInjecao`, `tarefasSinteticas(n)`), todas com prefixo
  `SYNTH-`.
- Padrão de teste sem rede: `fetchImpl` injetado no `WorkspaceClient`
  (`packages/workspace-client/src/client.test.ts:16-32`) — copiar esse `makeClient` local.
- Comandos reais: `pnpm run test` (`vitest run`) e `pnpm run typecheck`
  (`tsc -p tsconfig.json --noEmit`), rodados da raiz do repositório. `vitest.config.ts`
  inclui `packages/**/*.test.ts` e `apps/**/*.test.ts` — teste co-localizado é descoberto
  sozinho, sem registro em lugar nenhum.
- `tsconfig.json` usa `strict`, `noUncheckedIndexedAccess` e `verbatimModuleSyntax`:
  importação só-de-tipo precisa de `import type`, e indexar array devolve `T | undefined`.

### Premissa do pedido que precisou de leitura, não de fé

- A spec fala em "quatro estados" do resumo. Os quatro critérios de aceitação descrevem
  quatro respostas **sem pendência**; nenhum deles descreve a resposta com pendências, que
  obviamente existe. O plano entrega **cinco** estados na união: os quatro exigidos mais
  `com_pendencias`. O teste de distinção cobre os cinco (`new Set(frases).size === 5`),
  o que satisfaz com folga "as quatro frases têm de ser todas diferentes entre si".
- A fronteira entre o critério (a) "zero tarefas encontradas" e o (d) "consultado com
  sucesso e sem pendências" não está definida no texto. Leitura adotada, por usar só dado
  que já existe no contrato 0.2.1: **(a)** a sincronização terminou inteira e a fila ficou
  vazia — nenhuma tarefa voltou; **(d)** a sincronização terminou inteira, voltaram N
  tarefas, e **nenhuma** delas está com `status: 'PENDENTE'` (todas em `FAZENDO`) — nada
  parado esperando a Thaís. Ver "O que eu não consegui confirmar".

---

## Riscos

- **Mudar o retorno de `collectAllTasks` é mudança de API pública do pacote** (exportado
  por `packages/workspace-client/src/index.ts`). Mitigação: união discriminada em que
  **todos** os ramos mantêm `tasks` e `pages`, para não quebrar destruturação existente.
  Se o `typecheck` reclamar em `scripts/`, é sinal de que o ramo parcial ficou sem um
  desses campos — corrija o tipo, não o script.
- **Silenciar o teto de páginas é perder um alarme.** Hoje ele estoura; depois da Etapa 2
  ele volta como dado. Os dois scripts de evidência precisam passar a olhar o campo
  `completa`, senão a verificação da Fase 1 passa a dar "sem duplicata" para uma listagem
  truncada. Isso está dentro da Etapa 2 de propósito.
- **A ferramenta nova da Etapa 7 entra num catálogo fechado.** Ela é `read` e não tem
  argumento nenhum — mas é conteúdo externo entrando no prompt, e vai ser lida pelo
  `security-reviewer`. Todo texto de tarefa tem de sair por `cortarParaLimite` +
  `wrapUntrusted`, sem exceção.
- **Worktree não tem `node_modules`.** Antes de rodar teste numa worktree nova, rode
  `pnpm install` nela (ou o `vitest` nem inicia). Vale para toda etapa despachada em
  paralelo.
- **Risco de dois executores escreverem `packages/contracts/src/index.ts`.** Só a Etapa 1
  toca esse arquivo. Nenhuma outra etapa pode acrescentar `export *` lá.
- Nenhum dado de paciente, pagamento, migration ou deploy nesta fase.

---

## Etapas

### Etapa 1 — `InboxItem` e a chave de deduplicação, no pacote de contratos

**Objetivo:** existe uma estrutura própria da Cora para item ainda não classificado, e uma
chave derivada de `(fonte, identificadorDoWorkspace)` que o resto da fase usa para não
duplicar.

**Arquivos (fechado):**
- `packages/contracts/src/cora/inbox.ts` (novo)
- `packages/contracts/src/cora/inbox.test.ts` (novo)
- `packages/contracts/src/index.ts` (acrescentar **uma** linha de export)

**Contexto:**
- Vizinho e modelo de estilo: `packages/contracts/src/cora/execution.ts` (zod + comentário
  explicando o porquê de cada decisão, em português).
- `TaskStatusSchema` e `TaskPrioritySchema` já existem em
  `packages/contracts/src/workspace-agent/v1/tasks.ts:26-30` — importe, não redeclare.
- A chave é **derivada de conteúdo**, ao contrário de `novaChaveDeIdempotencia()`
  (`apps/server/src/run/idempotency.ts:23-25`), que é aleatória de propósito. Os dois
  padrões resolvem problemas opostos; o comentário do arquivo novo tem de dizer isso, com o
  ponteiro para `idempotency.ts`, senão alguém "corrige" um pelo outro daqui a três meses.

**Fazer:**
1. Em `inbox.ts`, um schema zod de união discriminada por `tipo`, hoje com **um** membro:
   ```
   tipo: 'tarefa'
   fonte: 'workspace:tasks'            (literal — a fonte é fechada hoje)
   identificadorDoWorkspace: string    (id da tarefa no Workspace)
   titulo: string
   status: TaskStatusSchema
   prioridade: TaskPrioritySchema
   prazo: string | null
   vistoEm: string                     (ISO 8601, quando a Cora viu)
   ```
   Exporte `InboxItemSchema` e `type InboxItem`. **Não** crie campo, membro nem validação
   para `card` ou `evento` — decisão registrada em `spec.md`, `fora_de_escopo`.
2. Exporte
   `chaveDeInbox(item: Pick<InboxItem, 'fonte' | 'identificadorDoWorkspace'>): string`,
   devolvendo `fonte` + separador `|` + identificador. Comente por que a colisão é
   impossível hoje: `fonte` é literal fechada, não texto livre.
3. Em `index.ts`, acrescente `export * from './cora/inbox.js'` (mantenha o estilo das
   outras linhas, com extensão `.js`).
4. Em `inbox.test.ts` (`describe`/`it` em português, cada `it` com comentário do porquê,
   fixtures com prefixo `SYNTH-`):
   - a mesma `(fonte, identificador)` produz a **mesma** chave, em chamadas separadas;
   - identificadores diferentes produzem chaves diferentes;
   - a chave **não** muda quando `titulo`, `status` ou `vistoEm` mudam — é derivada da
     identidade, não do conteúdo inteiro (é isso que faz "reprocessei o mesmo item" ser
     reconhecível);
   - o schema **recusa** `tipo: 'card'` e `tipo: 'evento'` (prova que o discriminador só
     implementa `'tarefa'` hoje);
   - o schema recusa `identificadorDoWorkspace` vazio.

**Verificação:**
```
pnpm exec vitest run packages/contracts/src/cora/inbox.test.ts
pnpm run typecheck
```
Esperado: todos os `it` do arquivo passam; `typecheck` sem saída e código 0.

**Depende de:** nenhuma.

---

### Etapa 2 — `collectAllTasks` devolve resultado parcial no teto de páginas

**Objetivo:** "só consegui ver parte da lista" deixa de ser exceção e vira dado
estruturado; cursor em laço e id repetido continuam sendo defeito e continuam estourando.

**Arquivos (fechado):**
- `packages/workspace-client/src/pagination.ts`
- `packages/workspace-client/src/client.test.ts` (acrescentar testes; não reescrever os
  existentes, exceto o ajuste pontual descrito abaixo)
- `scripts/integracao-tarefas.ts`
- `scripts/verificacao-fase-01.ts`

**Contexto:**
- Hoje: `Promise<{ tasks: Task[]; pages: number }>`, três `throw` de
  `ContractViolationError` (linhas 58, 70 e 76).
- A decisão está em `spec.md`, `contradicoes_resolvidas`, item do Arquiteto: **só** o teto
  de páginas vira parcial.
- Os dois scripts destruturam `{ tasks, pages }`.

**Fazer:**
1. Exporte um tipo nomeado, com os dois ramos carregando `tasks` e `pages` (isso é o que
   mantém os consumidores compilando):
   ```
   export type ColetaDeTarefas =
     | { tasks: Task[]; pages: number; completa: true }
     | { tasks: Task[]; pages: number; completa: false; motivo: 'teto_de_paginas'; maxPages: number }
   ```
2. Troque o `throw` do teto de páginas (linha 76) por `return` do ramo `completa: false`.
   Os `return` de sucesso passam a levar `completa: true`.
3. **Não** mexa nos outros dois `throw`. Atualize o comentário de cabeçalho da função
   dizendo, em uma frase, por que as duas causas deixaram de ser a mesma coisa: cursor em
   laço é defeito do outro lado; teto de páginas é uma lista maior do que o teto que **nós**
   escolhemos, e a Thaís precisa ouvir isso.
4. Testes novos em `client.test.ts`, dentro do `describe('paginação')`:
   - **teto de páginas devolve parcial, não exceção**: `fetchImpl` que sempre devolve
     `nextCursor` não nulo; chame com `{ limit: 10, maxPages: 2 }`; espere
     `completa === false`, `motivo === 'teto_de_paginas'`, `pages === 2` e
     `tasks.length === 20`. Comentário: sem isso, "não encontrei pendências" pode estar
     mentindo por sincronização truncada.
   - **cursor em laço continua sendo exceção**: reafirme, no teste que já existe (linha
     349), que o resultado é rejeição e **não** um objeto com `completa: false` — vale um
     `expect(...).rejects.toBeInstanceOf(ContractViolationError)` explícito.
   - no teste "percorre 25 tarefas" (linha 263), acrescente
     `expect(resultado.completa).toBe(true)`.
5. `scripts/integracao-tarefas.ts` (perto da linha 105): depois de coletar, se
   `completa === false`, imprima uma linha explícita do tipo
   `ATENÇÃO: listagem PARCIAL — parei no teto de N páginas` antes dos ids. Evidência que não
   diz que está truncada é evidência que mente.
6. `scripts/verificacao-fase-01.ts`, verificação `C5.7` (linhas 214-226): se o resultado vier
   `completa === false`, retorne uma string de falha (por exemplo `PARCIAL: teto de páginas`)
   em vez de `'sem duplicata'`. Não acrescente nem remova verificações — a contagem do
   script continua a mesma.

**Verificação:**
```
pnpm exec vitest run packages/workspace-client/src/client.test.ts
pnpm run typecheck
```
Esperado: o `describe('paginação')` passa inteiro, incluindo os testes novos; `typecheck`
limpo (é ele que prova que os dois scripts continuam válidos).

**Depende de:** nenhuma.

---

### Etapa 3 — Fila de entrada em memória, com deduplicação

**Objetivo:** reprocessar o mesmo item de origem não cria duplicata.

**Arquivos (fechado):**
- `apps/server/src/inbox/fila.ts` (novo)
- `apps/server/src/inbox/fila.test.ts` (novo)

**Contexto:**
- `chaveDeInbox` e `InboxItem` vêm de `@cora/contracts` (Etapa 1).
- O padrão de dedup a seguir é o `seenIds`/`Set<string>` de
  `packages/workspace-client/src/pagination.ts:22-23` — chave derivada. **Não** é o padrão
  de `Idempotency-Key` de `write.ts`/`idempotency.ts`, que é aleatório e resolve o problema
  oposto. O comentário do arquivo tem de registrar isso.
- Estado em memória de processo, como `approvals`/`records` em
  `apps/server/src/run/turn.ts:61-62`. **Sem banco, sem disco, sem singleton de módulo.**

**Fazer:**
1. `class FilaDeEntrada` com:
   - `adicionar(item: InboxItem): 'novo' | 'duplicado'` — usa `chaveDeInbox`; item já visto
     **não** entra de novo e **não** sobrescreve o que já estava lá (o primeiro registro é o
     que vale; se isso mudar um dia, muda com teste);
   - `itens(): readonly InboxItem[]` — devolve cópia, na ordem de inserção;
   - `tamanho(): number`;
   - opcional, se ajudar o teste: `limpar(): void`.
   Uma instância = uma fila. Quem cria é quem monta o registro de ferramentas (Etapa 7).
2. Teste (`describe`/`it` em português, comentário do porquê, fixtures `SYNTH-`):
   - **dois itens diferentes entram os dois**;
   - **o mesmo `(fonte, identificador)` entra uma vez só** — `adicionar` devolve
     `'duplicado'` na segunda, `tamanho() === 1`;
   - **o mesmo identificador com título diferente continua sendo duplicata** (o Workspace
     renomeou a tarefa; continua sendo a mesma tarefa), e o item guardado é o primeiro;
   - **`itens()` não deixa mexer na fila por fora** — mutar o array devolvido não altera
     `tamanho()`.

**Verificação:**
```
pnpm exec vitest run apps/server/src/inbox/fila.test.ts
pnpm run typecheck
```

**Depende de:** Etapa 1.

---

### Etapa 4 — Sugestão de nomes parecidos, que nunca funde

**Objetivo:** existe um matcher que aponta "estes dois nomes podem ser a mesma pessoa ou o
mesmo cliente" e que, por construção, não tem como fundir registro nenhum.

**Arquivos (fechado):**
- `apps/server/src/inbox/nomes-parecidos.ts` (novo)
- `apps/server/src/inbox/nomes-parecidos.test.ts` (novo)

**Contexto:**
- Decisão já tomada (`spec.md`, `fora_de_escopo`): **igualdade normalizada e substring**,
  sem fonético e sem distância de edição.
- Módulo **puro**, sem importar `@cora/contracts`, `@cora/workspace-client` nem a fila. Ele
  trabalha sobre pares de id e nome, genéricos. Motivo honesto, a registrar no comentário
  do arquivo: o contrato 0.2.1 de Tarefa traz `clientId` e `assigneeIds` (identificadores),
  **não** nomes — o rótulo só aparece na camada de prévia. Então este módulo nasce pronto e
  sem chamador em produção nesta entrega, e isso é dito no comentário em vez de disfarçado
  com uma ligação inventada.

**Fazer:**
1. `normalizarNome(nome: string): string` — minúsculas, remoção de acento (normalize NFD
   mais remoção da faixa de diacríticos), colapso de espaços repetidos, trim.
2. `sugerirParecidos(entradas: ReadonlyArray<{ id: string; nome: string }>): Sugestao[]`,
   com `Sugestao` = objeto de `idA`, `idB` e `motivo`, sendo `motivo` a união
   `igualdade_normalizada | substring`. Compara par a par, ignora par com o mesmo `id`,
   não repete o par invertido. **Não existe função de fusão neste módulo** — e essa
   ausência é intencional.
3. Teste:
   - "Thaís Souza" e "thais souza" são sugeridos por igualdade normalizada;
   - "Clínica Sol" e "Clínica Sol Nascente" são sugeridos por substring;
   - "João" e "Maria" não geram sugestão;
   - **a entrada volta intacta**: depois de `sugerirParecidos`, a lista original continua
     com os dois registros e os dois ids — nenhum sumiu, nenhum virou o outro. Comentário
     do `it`: fundir dois clientes sozinha é o tipo de erro que ninguém percebe até a
     fatura sair no nome errado;
   - o módulo **não exporta** nada com nome de fusão: uma asserção sobre as chaves do
     módulo importado, negando os nomes `fundir`, `merge` e `unificar`, serve de trava.
   Fixtures com prefixo `SYNTH-` nos ids.

**Verificação:**
```
pnpm exec vitest run apps/server/src/inbox/nomes-parecidos.test.ts
pnpm run typecheck
```

**Depende de:** nenhuma.

---

### Etapa 5 — Resumo operacional com os cinco estados e uma frase por estado

**Objetivo:** a Cora responde "como estão minhas pendências" distinguindo, em frases
diferentes, lista vazia, sincronização incompleta, erro de acesso, nada parado e há
pendências — e cada tarefa listada aponta de onde veio.

**Arquivos (fechado):**
- `apps/server/src/inbox/resumo.ts` (novo)
- `apps/server/src/inbox/resumo.test.ts` (novo)

**Contexto:**
- Modelo de forma, a repetir: `apps/server/src/run/idempotency.ts:39-69` — união
  discriminada por `estado`, `switch` exaustivo, uma frase por estado, cada frase dizendo
  o que acontece agora.
- Modelo de teste, a repetir: `apps/server/src/tools/workspace-create-task.test.ts:378-383`.
- `wrapUntrusted` e `cortarParaLimite` vêm de `@cora/policy`; o corte vem **antes** do
  embrulho (`packages/policy/src/untrusted.ts:56-60` explica por quê). Reaproveite o teto
  `MAX_CHARS_RESULTADO` de `apps/server/src/run/turn.ts:208` — importe, não duplique o
  número.
- Esta etapa é **pura**: `montarResumo` não faz rede, não conhece `WorkspaceClient` e não
  conhece a fila — recebe os itens e o relato das fontes.

**Fazer:**
1. Tipos:
   ```
   export type SincronizacaoDaFonte =
     | { fonte: 'workspace:tasks'; estado: 'completa'; itensVistos: number; paginas: number }
     | { fonte: 'workspace:tasks'; estado: 'parcial'; itensVistos: number; paginas: number; motivo: 'teto_de_paginas' }
     | { fonte: 'workspace:tasks'; estado: 'falhou'; frase: string }

   export type ResumoOperacional =
     | { estado: 'erro_de_acesso';           fontes: readonly SincronizacaoDaFonte[] }
     | { estado: 'sincronizacao_incompleta'; itens: readonly InboxItem[]; fontes: readonly SincronizacaoDaFonte[] }
     | { estado: 'sem_registros';            fontes: readonly SincronizacaoDaFonte[] }
     | { estado: 'sem_pendencias';           itens: readonly InboxItem[]; fontes: readonly SincronizacaoDaFonte[] }
     | { estado: 'com_pendencias';           itens: readonly InboxItem[]; fontes: readonly SincronizacaoDaFonte[] }
   ```
2. `montarResumo`, recebendo um objeto com `itens` e `fontes` e devolvendo
   `ResumoOperacional`, com esta precedência — nesta ordem, e comentada no código:
   1. alguma fonte falhou → `erro_de_acesso` (dúvida sobre acesso domina qualquer contagem;
      dizer "sem pendências" com uma fonte caída é a mentira que esta fase existe para
      impedir);
   2. senão, alguma fonte parcial → `sincronizacao_incompleta` (leva os itens que deu para
      ver, avisando que pode faltar);
   3. senão, `itens` vazio → `sem_registros`;
   4. senão, nenhum item com status `PENDENTE` → `sem_pendencias`;
   5. senão → `com_pendencias`.
3. `descreverResumo(resumo: ResumoOperacional): string`, `switch` exaustivo, **cinco frases
   distintas**, em português. Conteúdo obrigatório de cada uma:
   - `erro_de_acesso`: repete a frase da fonte que falhou e deixa explícito que **isso não
     quer dizer que ela esteja sem pendências**;
   - `sincronizacao_incompleta`: diz que viu **parte**, quantas páginas leu, e que a lista
     abaixo pode estar faltando item;
   - `sem_registros`: diz que consultou a lista inteira e o Workspace não devolveu tarefa
     nenhuma;
   - `sem_pendencias`: diz que consultou a lista inteira, que há N tarefas e que **nenhuma
     está parada** esperando por ela;
   - `com_pendencias`: diz quantas estão pendentes e lista.
4. Listagem de itens: agrupe por `item.fonte`; para **cada** fonte, monte as linhas (título,
   status, prioridade, identificador), passe por `cortarParaLimite` com
   `MAX_CHARS_RESULTADO` e então por `wrapUntrusted`, com `source` igual à fonte do item. A
   fonte aparece **duas** vezes de propósito: no rótulo do bloco e junto do número que a
   Thaís lê — o critério é "não aparece número sem proveniência".
5. Teste, com `describe`/`it` em português e comentário do porquê em cada `it`:
   - um `it` por estado (cinco), montando a entrada e conferindo o `estado` do resumo;
   - **"as cinco frases são diferentes entre si"**, no padrão
     `expect(new Set(frases).size).toBe(5)`, com comentário explicando que frase genérica
     obriga a pessoa a adivinhar se tenta de novo, se espera ou se chama alguém;
   - **precedência**: fonte que falhou junto com itens vistos dá `erro_de_acesso`, nunca
     `com_pendencias`; fonte parcial com zero itens dá `sincronizacao_incompleta`, nunca
     `sem_registros`;
   - **cada tarefa listada aponta a fonte**: a frase casa com a expressão regular de
     `workspace:tasks`;
   - **título de tarefa sai como dado inerte**: use `fixtures.tarefaComInjecao` convertida
     em `InboxItem` e prove com `estaEmbrulhado(frase)` verdadeiro (importado de
     `@cora/policy`);
   - **título gigante é cortado antes de embrulhar**: item com título enorme produz frase
     com a marca de truncamento e ainda assim um bloco íntegro — `escapesBlock(frase)`
     falso.
   Fixtures com prefixo `SYNTH-`, nenhuma chamada de rede.

**Verificação:**
```
pnpm exec vitest run apps/server/src/inbox/resumo.test.ts
pnpm run typecheck
```
Esperado: os cinco estados passam e o teste de frases distintas acusa 5.

**Depende de:** Etapa 1.

---

### Etapa 6 — Sincronizar tarefas do Workspace para dentro da fila

**Objetivo:** existe um caminho único que lê as tarefas, popula a fila sem duplicar e
relata a fonte como completa, parcial ou falha — sem transformar falha em lista vazia.

**Arquivos (fechado):**
- `apps/server/src/inbox/sincronizar.ts` (novo)
- `apps/server/src/inbox/sincronizar.test.ts` (novo)

**Contexto:**
- Usa `collectAllTasks` já com `ColetaDeTarefas` (Etapa 2), `FilaDeEntrada` (Etapa 3),
  `SincronizacaoDaFonte` (Etapa 5) e `InboxItem` (Etapa 1).
- A frase de falha **não se reescreve**: importe `describeListTasksFailure` de
  `apps/server/src/tools/workspace-tasks.ts` (linha 66). Esse arquivo **não é editado**.
- `ContractViolationError` estende `WorkspaceApiError`
  (`packages/workspace-client/src/errors.ts:68`), então cursor em laço e resposta fora do
  contrato caem no mesmo ramo de falha, com a frase genérica. Isso é o certo: para a Thaís,
  os dois são "não consegui consultar".

**Fazer:**
1. `sincronizarTarefas`, assíncrona, recebendo um objeto com `client`, `fila` e os
   opcionais `limit`, `maxPages`, `signal` e `agora`, devolvendo
   `Promise<SincronizacaoDaFonte>`:
   - chama `collectAllTasks`;
   - mapeia cada `Task` para `InboxItem` — tipo `tarefa`, fonte `workspace:tasks`,
     identificador igual a `task.id`, título igual a `task.title`, status, prioridade,
     prazo igual a `task.dueAt`, `vistoEm` igual a `agora().toISOString()` — e chama
     `fila.adicionar` para cada um;
   - devolve estado `completa` ou `parcial` conforme o campo `completa` da coleta, com
     `itensVistos` e `paginas` preenchidos;
   - captura **apenas** `WorkspaceApiError` e devolve o estado `falhou` com
     `frase: describeListTasksFailure(cause)`. Qualquer outra exceção **sobe** — defeito de
     programação não vira frase amigável;
   - `agora` é injetável, para `vistoEm` determinístico no teste.
2. Teste, com `makeClient` e `jsonResponse` copiados do padrão de
   `packages/workspace-client/src/client.test.ts:16-32` (`fetchImpl` injetado, **zero
   rede**):
   - **duas tarefas entram como dois itens, com a fonte marcada**;
   - **sincronizar duas vezes a mesma resposta não duplica a fila** — `tamanho()` continua o
     mesmo depois da segunda passada. Este é o teste que o critério de aceitação exige;
   - **teto de páginas vira fonte parcial**, não exceção, e os itens que deram para ver
     **entram** na fila;
   - **403 vira fonte falhou**, com a frase de `describeListTasksFailure`, e a fila
     **continua vazia** — falha não é lista vazia;
   - **o `vistoEm` não entra na chave de dedup**: duas sincronizações com `agora` diferente
     continuam dando um item só.
   Fixtures `SYNTH-`.

**Verificação:**
```
pnpm exec vitest run apps/server/src/inbox/sincronizar.test.ts
pnpm run test
pnpm run typecheck
```
Esperado: suíte inteira verde — é o primeiro ponto em que as etapas 1, 2, 3 e 5 se
encontram.

**Depende de:** Etapas 1, 2, 3 e 5.

---

### Etapa 7 — Ferramenta `workspace.inbox.resumo`, para a Thaís pedir no `POST /turno`

**Objetivo:** a capacidade fica alcançável pelo canal que já existe — a Thaís pergunta
"o que está pendente?" e a Cora responde com o resumo, com fonte e sem colapsar estados.

**Arquivos (fechado):**
- `packages/policy/src/tools.ts` (acrescentar **uma** entrada ao catálogo)
- `apps/server/src/engine/tool-schemas.ts` (acrescentar **um** esquema)
- `apps/server/src/tools/workspace-inbox.ts` (novo)
- `apps/server/src/tools/workspace-inbox.test.ts` (novo)
- `apps/server/src/http/boot.ts` (registrar a ferramenta)

**Contexto:**
- O catálogo é fechado por decisão de segurança (`packages/policy/src/tools.ts:1-9`); o
  registro de executores (`apps/server/src/tools/registry.ts:24-34`) recusa nome fora do
  catálogo.
- `tool-schemas.test.ts:7-15` reprova esquema órfão — por isso catálogo e esquema entram
  **no mesmo passo**.
- `ToolHandler` é `apps/server/src/tools/registry.ts:15-19`.
- **Diferença deliberada em relação a `createListTasksTool`**
  (`apps/server/src/tools/workspace-tasks.ts:20-26`): lá a falha **não** é capturada, para
  que um 403 não vire "você não tem tarefas". Aqui ela **é** capturada — mas não some: vira
  o estado `erro_de_acesso` do resumo, que tem frase própria e diz explicitamente que não é
  lista vazia. Escreva esse porquê no comentário do arquivo novo; sem ele, a próxima
  revisão vai ler isto como regressão.

**Fazer:**
1. Catálogo: uma entrada com `name` igual a `workspace.inbox.resumo`, `category` igual a
   `read`, `humanDescription` "Resumir o que está pendente para você, dizendo de onde veio
   cada item" e `contract` igual a `workspace-agent-v1`.
2. Esquema: objeto **sem** propriedade nenhuma — `properties` vazio, `required` vazio,
   `additionalProperties: false`. Não dê argumento ao modelo: não há nada para ele escolher
   aqui.
3. `createInboxSummaryTool(client, fila): ToolHandler` — chama `sincronizarTarefas`, monta o
   resumo com `montarResumo`, passando `fila.itens()` e a fonte devolvida, e retorna
   resultado estruturado com `outcome: 'ok'` e o resumo. A frase para a pessoa sai de
   `descreverResumo`; exporte um `describeResumoForUser` fino se ajudar a leitura, mas
   **não duplique texto** — a frase mora em `resumo.ts`.
4. `boot.ts`: crie a `FilaDeEntrada` dentro de `montarRegistry` (uma por registro, memória
   de processo, como `approvals` no turno) e registre o par nome/handler.
5. Teste:
   - **o registro aceita a ferramenta** (prova que catálogo e executor concordam);
   - **`montarFerramentas` com esse nome não estoura** e usa a descrição do catálogo;
   - **o esquema não oferece argumento nenhum**;
   - **403 devolve resumo em `erro_de_acesso`**, e a frase **não** diz que está sem
     pendências;
   - **duas chamadas seguidas não duplicam a fila**, com `fetchImpl` injetado.

**Verificação:**
```
pnpm exec vitest run apps/server/src/tools/workspace-inbox.test.ts apps/server/src/engine/tool-schemas.test.ts
pnpm run test
pnpm run typecheck
```
Esperado: suíte inteira verde, incluindo os testes de catálogo e esquema que já existiam.

**Depende de:** Etapas 5 e 6.

---

### Etapa 8 — Documentação da fase

**Objetivo:** a documentação descreve o software de hoje, no mesmo lote da mudança.

**Arquivos (fechado):**
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`

**Contexto:** regra do repositório — documentação anda junto com a mudança. Se a esteira
rodar a Fase 7 (Cronista), ela absorve esta etapa; então **não faça as duas coisas**.

**Fazer:**
1. `ARCHITECTURE.md`: um parágrafo curto sobre o módulo `apps/server/src/inbox/` — fila em
   memória de processo, dedup por chave derivada de fonte mais identificador, resumo com
   cinco estados, matcher que só sugere. Diga que **não** há persistência.
2. `ROADMAP.md`: registre a Fase 3 como feita, com o que ficou de fora e por quê — Card e
   Evento aguardando `CORA-005`; importação externa sem fonte escolhida; "colar texto para
   classificar" cortado por falta de critério de aceitação. Não invente contagem de teste:
   a regra do arquivo é mandar rodar `pnpm run test`.

**Verificação:**
```
pnpm run test
pnpm run typecheck
```
Esperado: verde. A etapa é só texto; a verificação existe para provar que nada foi tocado
por engano.

**Depende de:** Etapas 1 a 7.

---

## Paralelizável

- **Onda 1 (worktrees isoladas, em paralelo):** Etapa 1, Etapa 2, Etapa 4. Nenhuma toca
  arquivo da outra.
- **Onda 2 (em paralelo entre si, depois da Etapa 1):** Etapa 3 e Etapa 5.
- **Onda 3:** Etapa 6. **Onda 4:** Etapa 7. **Onda 5:** Etapa 8.

Antes de rodar teste em qualquer worktree nova: `pnpm install` nela.

## Sequencial obrigatório, e por quê

- Etapas 3 e 5 depois da 1 — as duas importam `InboxItem` e `chaveDeInbox`, que só existem
  depois da Etapa 1.
- Etapa 6 depois de 1, 2, 3 e 5 — é onde os quatro se encontram, e a primeira em que
  `pnpm run test` cobre tudo junto.
- Etapa 7 depois de 5 e 6 — o handler chama os dois.
- Etapa 8 por último — descreve o que ficou pronto.
- Etapas 1 e 2 não podem virar uma só: pacotes diferentes, riscos diferentes. A 2 muda API
  pública já consumida por script de evidência.

## O que eu não consegui confirmar

- **A fronteira entre os critérios (a) e (d).** O texto aprovado não a define. Adotei "fila
  vazia" para (a) e "tem tarefa, mas nenhuma PENDENTE" para (d), por usar só campo que o
  contrato 0.2.1 já entrega. Leitura alternativa possível: (a) nunca sincronizou nesta
  sessão; (d) sincronizou e a lista voltou vazia. Se o dono preferir a alternativa, muda
  **só** a Etapa 5 — as regras 3 e 4 de `montarResumo` e duas frases. Nenhuma outra etapa é
  afetada.
- **Se a Etapa 7 está dentro do escopo.** Os critérios de aceitação não pedem ferramenta
  nova; o `usuario_alvo` do briefing diz que a Thaís pede isso pelo `POST /turno` que já
  existe, e sem a Etapa 7 nada muda para ela. Incluí por isso. Se o dono considerar que
  ferramenta nova em catálogo fechado é decisão à parte, **corte a Etapa 7** — as etapas 1
  a 6 fecham sozinhas e entregam todos os critérios testáveis.
- **O matcher da Etapa 4 nasce sem chamador em produção**, porque o contrato de Tarefa traz
  identificadores, não nomes. Preferi deixar isso explícito no comentário do arquivo a
  inventar uma ligação artificial. Quando aparecer rótulo de cliente na fila — via prévia,
  ou via resposta do `CORA-005` — a ligação é de uma linha.
- **Os textos exatos das frases** são sugestão. O que o teste trava é que sejam cinco,
  distintas, e que a de erro não prometa ausência de pendência.
- **Não rodei `pnpm run test` nem `pnpm run typecheck`** nesta sessão de planejamento: o
  plano é de leitura. O estado de partida é a árvore limpa em `868211e`.

## Uma linha do que eu vi e não virou etapa

`apps/server/src/tools/workspace-tasks.ts` e `apps/server/src/run/idempotency.ts` têm hoje
dois vocabulários para a mesma ideia (`describeXForUser` em inglês, `descreverResultado` em
português). Não unifiquei — não foi pedido.
