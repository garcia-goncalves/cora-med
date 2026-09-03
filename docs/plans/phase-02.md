# Plano da Fase 2 — conversa e criação de tarefa

**Critério de conclusão (briefing, seção 14):** pedido natural → prévia → criação
idempotente → registro visível, sem duplicação.

**Estado: rascunho.** Escrito em 03/09/2026, depois da Fase 1 comprovada. Este plano vem
**antes** do ticket de escrita, de propósito: não peço contrato de escrita ao WORKSPACE
antes de saber exatamente que forma de idempotência quero.

---

## 1. O caso de negócio, em uma frase

A Thaís dita ou cola um pedido. A Cora entende a intenção, **mostra o que entendeu** com
cliente, responsável e prazo, e só então cria a tarefa no Workspace — com link para o
registro. Se houver ambiguidade (dois médicos com o mesmo sobrenome), ela **pergunta**.

O que ela **não** faz: inventar prazo, protocolo, valor ou conta. Ausência de informação
é ausência, não é zero nem hoje.

## 2. As duas peças novas

### 2.1 Um motor de verdade

Até agora `MotorPort` só tem `ScriptedMotor` (teste) e `HermesMotorAdapter` (falha de
propósito, ADR 0001). A Fase 2 precisa de um motor real.

**Isso é a ADR 0002**, e ela decide: provedor, modelo, forma de contagem de tokens e
**preço verificado na data**. Sem preço conhecido, o custo entra como *desconhecido*,
nunca como zero (briefing §12).

Regras que a ADR não pode afrouxar:
- o motor **propõe**, `runTurn` decide — nada muda nisso;
- conteúdo externo continua entrando embrulhado por `wrapUntrusted`;
- os tetos (10 chamadas de modelo, 120 s) continuam sendo da aplicação.

> Ao implementar, carregar a referência `claude-api` antes de escrever a primeira linha —
> id de modelo, preço e forma de tool use mudam, e memória não é fonte.

### 2.2 Escrita no Workspace: `workspace.tasks.create`

Não existe no contrato `0.1.0`. Vira **CORA-003**, depois que este plano estiver fechado.

## 3. Idempotência — a decisão que trava o resto

O risco concreto: a Thaís dita um pedido, a rede engasga, a Cora não sabe se a tarefa foi
criada, e repete. Duas tarefas iguais no Workspace, e a Thaís descobre depois.

### O que vou pedir ao WORKSPACE

**Chave composta por `(clienteDeAgente, requesterUserId, idempotencyKey)`**, onde
`idempotencyKey` é gerada pela Cora e vinculada ao **turno**, não à tentativa.

| Situação | Resposta esperada |
|---|---|
| Primeira chamada | `201` com a tarefa criada |
| Repetição com **os mesmos** argumentos | `200` com **a mesma** tarefa, sem criar outra |
| Repetição com argumentos **diferentes** | `409 CONFLICT` — a chave já foi usada para outra coisa |
| Chave de outro usuário | `404`/`409`, nunca a tarefa do outro |

O `409` é o ponto: repetir cegamente com conteúdo diferente é o que produz duplicata, e o
envelope de erro já reserva esse código desde a `0.1.0`.

**Prazo da chave:** peço 24 h. Menos que isso e uma reconciliação no dia seguinte perde a
referência; mais e a tabela vira lixo.

### O que a Cora faz quando não sabe

Falha de rede **depois** de enviar não é "não criou". O `ExecutionRecord` já tem o estado
`needs_reconciliation` (usado hoje para efeito externo cancelado). O caminho:

1. registrar `needs_reconciliation` com a `idempotencyKey`;
2. **reconsultar** com a mesma chave — o servidor devolve a tarefa se ela existe;
3. só então dizer à Thaís o que aconteceu.

Nunca repetir cegamente. Nunca dizer "criei" sem ter visto o id.

## 4. A prévia

Criar tarefa interna é `internal_write` — categoria reversível, que pela política roda
**sem** ritual de aprovação. A prévia aqui não é aprovação de risco: é **desambiguação**.

A prévia mostra, sempre com a fonte:

| Campo | Regra |
|---|---|
| título | o que a Cora entendeu, não o texto cru |
| responsável | nome + id; se a Cora inferiu, dizer que inferiu |
| cliente | nome + id, ou **"nenhum"** — nunca um palpite |
| prazo | data explícita, ou **"sem prazo"**. Nunca "hoje" por omissão |

**Ambiguidade não vira escolha silenciosa.** Dois responsáveis possíveis → a Cora pergunta,
com as duas opções e o que as distingue. Zero correspondências → diz que não encontrou e
oferece criar sem vínculo.

## 5. Arquivos

| Arquivo | O que faz | Novo? |
|---|---|---|
| `docs/decisions/0002-provedor-de-modelo.md` | provedor, modelo, preço na data | novo |
| `apps/server/src/engine/<provedor>-adapter.ts` | implementa `MotorPort` | novo |
| `packages/contracts/src/workspace-agent/v1/tasks-create.ts` | schemas de escrita | novo, depois de CORA-003 |
| `packages/workspace-client/src/client.ts` | método `createTask` com `idempotencyKey` | estende |
| `packages/policy/src/tools.ts` | `workspace.tasks.create` já está no catálogo | sem mudança |
| `apps/server/src/tools/workspace-tasks.ts` | handler de criação + `describeCreatePreview` | estende |
| `apps/server/src/run/turn.ts` | reconciliação após falha com resultado desconhecido | estende |
| `scripts/verificacao-fase-02.ts` | verificação contra Workspace real | novo |

## 6. Testes — o que precisa estar verde

**Locais, com fixtures sintéticas (entram em `pnpm run test`):**

1. mesma `idempotencyKey` + mesmos argumentos → o cliente chama uma vez e devolve a mesma tarefa;
2. mesma chave + argumentos diferentes → `CONFLICT`, e **nada** é reenviado;
3. falha de rede depois do envio → estado `needs_reconciliation`, **não** `failed`, e **não** repete;
4. prévia com cliente ambíguo → devolve pergunta, não escolhe;
5. prévia sem prazo → o texto diz "sem prazo", e a palavra "hoje" não aparece;
6. resposta de criação vinda do Workspace passa por `wrapUntrusted` antes do motor;
7. o motor propondo `create` duas vezes no mesmo turno com a mesma chave → executa uma vez.

**Contra o Workspace real (`scripts/verificacao-fase-02.ts`, fora da suíte):**

8. criação real → `201`, e a tarefa **aparece** no `GET /tasks` da Fase 1;
9. repetição da mesma chave → mesma tarefa, e o total no `GET` **não muda**;
10. repetição com argumentos diferentes → `409`;
11. chave de A reapresentada por B → não devolve a tarefa de A;
12. criação com delegação sem escopo de escrita → `403`.

O item 9 é o critério do briefing — "sem duplicação" — e é verificado pelo **efeito**, não
pela resposta: conto as tarefas antes e depois.

## 7. Ordem de execução

1. Fechar este plano e abrir **CORA-003** com a forma de idempotência da seção 3.
2. Enquanto o contrato não vem: ADR 0002 e o adaptador do motor, com testes locais.
3. Prévia e desambiguação — não dependem do endpoint de escrita.
4. Quando o contrato chegar: fixar versão e hash, implementar `createTask`, rodar 8–12.
5. Evidência + `acceptance.md` do CORA-003.

Como na Fase 1: **mock não conclui.** O passo 4 é o que fecha a fase.

## 8. Riscos

- **O WORKSPACE pode propor outra composição de chave.** Se propuser, aceito a deles se
  cobrir os quatro casos da tabela — a régua é o comportamento, não a minha forma.
- **Custo de modelo sem preço verificado.** Trava a ADR 0002, não o resto do plano.
- **Ambiguidade é mais comum do que parece.** Se a taxa de perguntas irritar a Thaís, a
  correção é melhorar a busca de correspondência, **não** baixar o limiar e adivinhar.

## 9. O que a Fase 2 NÃO inclui

Resumo operacional agregando Tarefa/Card/Evento (Fase 3), voz, desktop, PWA, automação
local. E nenhuma edição ou exclusão de tarefa — só criação.
