# Plano da Fase 2 — conversa e criação de tarefa

**Critério de conclusão (briefing, seção 14):** pedido natural → prévia → criação
idempotente → registro visível, sem duplicação.

**Estado: rascunho revisado.** Escrito em 03/09/2026 depois da Fase 1, e **revisado no
mesmo dia** com a opinião da sessão WORKSPACE. Este plano vem **antes** do ticket de
escrita, de propósito.

> ⚠️ **Conversa não é contrato.** Nada abaixo vale antes de virar
> `tickets/CORA-003/request.md` e de ter a resposta do WORKSPACE. O que está aqui é o
> pedido que eu vou fazer, já alinhado — não uma capacidade que existe.

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

**A chave é minha, e não é derivada do conteúdo.** `Idempotency-Key: <UUID v4>`, em
cabeçalho, escolhido pela Cora.

Meu rascunho anterior dizia "vinculada ao turno", o que é ambíguo o bastante para alguém
implementar derivando do payload — e derivar do conteúdo é um defeito com cara de
elegância: duas tarefas legitimamente iguais no mesmo dia (*"ligar para a clínica"*)
colidiriam, e a Thaís perderia a segunda **sem saber**. Corrigido depois da opinião do
WORKSPACE.

**Escopo da chave: `(usuário delegado, ferramenta, chave)` — nunca a delegação.** Se a
chave morresse junto com o token, renovar a credencial perderia a idempotência exatamente
depois de uma falha, que é quando a repetição é mais provável.

| Situação | Resposta esperada |
|---|---|
| Primeira chamada | `201` com a tarefa criada |
| Mesma chave, **mesmos** argumentos | `200` (não `201`) com **a mesma** tarefa |
| Mesma chave, argumentos **diferentes** | `409 CONFLICT` |
| Chave de outro usuário | nunca a tarefa do outro |

**A comparação é sobre forma canônica** dos argumentos — chaves ordenadas, título com
`trim`, datas em UTC. Sem isso, reformatar o JSON produziria um `409` falso e eu passaria
a desconfiar do servidor por um defeito meu.

**Reserva da chave e criação da tarefa têm de ser atômicas.** `INSERT` na chave primeiro,
índice único, violação = alguém já tem. Em dois passos, uma queda entre eles cria a segunda
tarefa — que é exatamente o defeito que a idempotência existe para impedir.

**Validade declarada e curta: 24 h.** Depois disso a chave é esquecida e a repetição cria
tarefa nova. Precisa estar no contrato para eu não contar com "para sempre".

### O que a Cora faz quando não sabe

Falha de rede **depois** de enviar não é "não criou". O `ExecutionRecord` já tem o estado
`needs_reconciliation` (usado hoje para efeito externo cancelado). O caminho:

1. registrar `needs_reconciliation` com a `idempotencyKey`;
2. **reconsultar** com a mesma chave — o servidor devolve a tarefa se ela existe;
3. só então dizer à Thaís o que aconteceu.

Nunca repetir cegamente. Nunca dizer "criei" sem ter visto o id.

## 4. A prévia — quem monta é o Workspace

**Aqui eu tinha errado o desenho, e a correção veio do WORKSPACE.**

Meu rascunho tinha a Cora renderizando a prévia a partir do que o modelo produziu e
**depois** mandando a escrita. O problema: a coisa aprovada e a coisa escrita seriam
**dois artefatos diferentes**, e a aprovação da Thaís não cobriria o que foi gravado. Entre
uma e outra cabe qualquer coisa.

### Como fica

1. `POST .../tasks/preview` — a Cora manda o que entendeu; o Workspace **resolve as
   referências** e devolve a prévia **mais** um `approvalToken` amarrado ao **hash dos
   argumentos exatos** que ele executaria.
2. `POST .../tasks` — exige esse token. Argumento diferente do aprovado → **recusa**, não
   "executa o novo".

A Cora renderiza em português o que o Workspace resolveu. Ela não inventa o conteúdo da
prévia; ela apresenta.

### O que a prévia precisa conter

| Exigência | Por quê |
|---|---|
| toda referência **resolvida**: id **e** nome legível | homônimo é onde isto machuca, e id sozinho não deixa a Thaís perceber |
| o que **não** foi encontrado vem como `null` **com motivo** | omitir vira "eu não vi", e depois "eu não aprovei isso" |
| "sem prazo" **visível como sem prazo** | ausência tem de aparecer na tela, não sumir dela |
| token de prazo curto e **uso único** | aprovação não é crachá permanente |

### Duas coisas que eu levo como pergunta ao CORA-003

- **Ambiguidade não pode gerar token.** Se a resolução achar dois candidatos, minha
  expectativa é: a prévia devolve **os candidatos e nenhum `approvalToken`**. Sem token não
  há o que executar, e a Cora pergunta. Emitir token sobre uma escolha que o servidor fez
  sozinho seria o mesmo defeito, um nível abaixo.
- **Token expirando com a Thaís no meio da conversa.** Prazo de minutos é curto para quem
  atende telefone. Quando expirar eu refaço a prévia — mas se o dado resolvido tiver
  **mudado**, preciso mostrar o que mudou, não reaprovar em silêncio.

### O que continua valendo do meu lado

Criar tarefa interna é `internal_write` — categoria reversível, que pela minha política
roda sem ritual de aprovação de risco. O `approvalToken` não muda essa classificação: ele
resolve um problema diferente, que é **amarrar o que foi mostrado ao que vai ser gravado**.

Ambiguidade vira pergunta com as opções e o que as distingue. Zero correspondências → digo
que não encontrei e ofereço criar sem vínculo. Nunca escolha calada.

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
1b. a chave gerada é UUID v4 e **não** é função dos argumentos — dois pedidos com o mesmo
    texto produzem chaves diferentes;
2. mesma chave + argumentos diferentes → `CONFLICT`, e **nada** é reenviado;
3. falha de rede depois do envio → estado `needs_reconciliation`, **não** `failed`, e **não** repete;
4. prévia com cliente ambíguo → devolve pergunta, não escolhe, e **não** guarda token;
4b. escrita sem `approvalToken`, ou com argumentos diferentes dos aprovados → recusada
    antes de sair da máquina;
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

- **O que o WORKSPACE já recusou de antemão**, e eu não vou pedir: endpoint genérico de
  escrita, campo livre que vire coluna, e escrita que aceite `clienteId` sem passar pelas
  mesmas regras de negócio das rotas humanas. Concordo com os três.
- **Custo de modelo sem preço verificado.** Trava a ADR 0002, não o resto do plano.
- **Ambiguidade é mais comum do que parece.** Se a taxa de perguntas irritar a Thaís, a
  correção é melhorar a busca de correspondência, **não** baixar o limiar e adivinhar.

## 9. O que a Fase 2 NÃO inclui

Resumo operacional agregando Tarefa/Card/Evento (Fase 3), voz, desktop, PWA, automação
local. E nenhuma edição ou exclusão de tarefa — só criação.
