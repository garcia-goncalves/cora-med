# Segurança da Cora

Base: briefing, seção 6. Este documento diz o que **está no código** e o que ainda é plano.

## A regra que sustenta as outras

**`userId` chegando solto no JSON não autentica ninguém.**

A Cora manda duas coisas distintas em cada chamada ao Workspace: a credencial do
**serviço** Cora e um **token de delegação** que representa a pessoa. O Workspace deriva o
`requesterUserId` do token — nunca do corpo — e revalida usuário ativo, escopo e permissão
a cada ação.

Está no código: `WorkspaceClient` separa `serviceToken` de `delegationToken` e isola a
montagem dos headers em uma função só (`authHeaders`), porque o formato real ainda depende
do contrato. **O nome dos headers é suposição até `tickets/CORA-001/response.md`.**

## Categorias de ação (implementado)

`packages/policy/src/tools.ts` classifica cada ferramenta:

| Categoria | Rito | Exemplo |
|---|---|---|
| `read` | roda com autorização normal, sem confirmação repetitiva | listar tarefas |
| `internal_write` | roda quando o pedido é claro | criar tarefa |
| `external_effect` | **prévia concreta + aprovação vinculada ao conteúdo** | enviar e-mail, excluir |
| `privileged` | **fora do escopo da assistente** | instalar software |

O catálogo é **fechado**. Ferramenta que não está nele não executa — `decide()` devolve
`deny`, e há teste com `shell.exec` provando. Não existe `exec(command)` genérico.

## Aprovação vinculada ao conteúdo (implementado)

Uma aprovação carrega `approvalId`, `argsHash` (SHA-256 dos argumentos canonicalizados),
quem aprovou, validade e se já foi usada.

O que os testes travam:

- hash estável quando só a ordem das chaves muda;
- hash diferente quando o conteúdo muda → **a aprovação anterior não vale**;
- aprovação já usada → negada;
- aprovação expirada → negada;
- expiração exatamente agora → negada;
- **aprovação dada por outra pessoa → negada.** `decide()` recebe o `RequesterContext` e
  compara `approvedByUserId` com `requesterUserId`. Sem isso, a chave da aprovação seria o
  nome da ferramenta, e um "sim" de A autorizaria a ação de B;
- **a aprovação é consumida** assim que o efeito acontece: a segunda chamada com a mesma
  aprovação é barrada, comprovado por teste que conta execuções.

Prévia mostrada ao usuário e hash aprovado são a mesma coisa. Mudou o destinatário do
e-mail, mudou o hash, a aprovação morre.

## Conteúdo de fora é dado, nunca instrução (implementado)

E-mail, tarefa, documento e página são **hostis até prova em contrário**. `wrapUntrusted()`
embrulha o conteúdo num bloco rotulado e neutraliza tentativa de fechar o bloco por dentro.

O embrulho é aplicado **no laço** (`runTurn`), em todo resultado de ferramenta e em toda
mensagem de erro vinda do Workspace — as duas coisas são texto que o outro lado controla.
Quem consegue criar uma tarefa com a Thaís como responsável consegue escrever no `title`;
sem o embrulho, esse título chegaria ao modelo no mesmo nível das instruções da Cora.

Testes que travam isso: o título de `SYNTH-task-004` (que contém texto de injeção) e a
mensagem de erro de uma ferramenta que falha, ambos verificados dentro do bloco quando
chegam ao motor.

Isto é a camada de cima. A defesa que de fato segura é estrutural: catálogo fechado e
aprovação por hash. Um texto convincente não cria ferramenta que não existe.

## Registro de execução (implementado)

Cada execução grava `runId`, `requesterUserId`, `deviceId`, ferramenta, versão do contrato,
`approvalId`, horário e estado.

**Argumentos vão minimizados:** o log guarda a lista de chaves e um código, **nunca o
conteúdo**. O código é **HMAC**, não hash simples: um SHA-256 sem chave de um valor de
baixa entropia — CPF, e-mail, telefone, id de paciente — é reversível por dicionário em
minutos, e o log tem plateia mais ampla que o dado. A chave vem de `CORA_LOG_HASH_KEY`;
sem ela, uma chave aleatória por processo, que correlaciona dentro da sessão e não vaza
fora dela.

Testes: um passa `segredo: 'nome-de-paciente'` e verifica que a string não aparece; outro
verifica que o código **não** é o SHA-256 puro dos argumentos.

**Falha nunca chega ao modelo como sucesso.** A ferramenta de listagem não captura erro:
se capturasse, o laço registraria `succeeded` e entregaria `ok: true` ao modelo — e um 403
ou uma delegação expirada viraria "você não tem tarefas abertas". Quem traduz falha em
frase é `describeListTasksFailure`, com texto distinto para falta de permissão, delegação
morta, pedido malformado e indisponibilidade.

## Tetos aplicados pela aplicação (implementado)

10 chamadas de modelo e 120 segundos por padrão, em `runTurn`. Cancelamento externo por
`AbortSignal` encerra o turno.

O `signal` atravessa toda a pilha: laço → handler da ferramenta → `WorkspaceClient` →
`fetch`. Sem isso, cancelar um turno deixaria a requisição em voo consumindo conexão até o
timeout. O laço também reconsulta o cancelamento **entre propostas do mesmo passo**, senão
um abort durante a primeira ferramenta ainda deixaria a segunda executar.

Cancelar no meio de um efeito externo **não** prova que o efeito não aconteceu: o registro
vira `needs_reconciliation`, não `cancelled`. Mentir aí polui a auditoria.

Testes cobrem: teto de chamadas, teto de tempo, cancelamento antes do primeiro passo,
cancelamento entre propostas, propagação do signal até o handler, e reconciliação.

Alerta de provedor não é corte de orçamento. O corte é nosso.

## Superfície HTTP (implementado, 04/09/2026)

Primeira porta de rede da Cora: `apps/server/src/http`, dois endpoints (`GET /health`,
`POST /turno`), escutando só em `127.0.0.1`. O que protege:

- **Cabeçalho `Host` conferido antes de qualquer roteamento**, contra DNS rebinding —
  bind em `127.0.0.1` sozinho não impede que uma página hospedada num domínio que o
  atacante reaponta para `127.0.0.1` fale com o servidor como se fosse same-origin (o
  navegador olha esquema+host+porta do cabeçalho, não para onde o socket resolve). Sem
  esta checagem, "escuta só localmente" seria uma garantia falsa.
- Corpo de requisição tratado como hostil: `Content-Type` obrigatório, teto de 64 KB,
  `.strict()` em todo nível do schema Zod (campo desconhecido é recusa, não ignorado).
- Erro traduzido por categoria fechada (`http/erros.ts`) — `MotorError.message` e
  `WorkspaceApiError.message` nunca cruzam para o corpo HTTP, só para o log do processo.
- Um motor **novo por requisição** (`deps.criarMotor()` dentro do handler, nunca fora) —
  a mesma regra de `AnthropicMotor` amarrado a um `runId` (acima) vale aqui.

**O que este endpoint NÃO faz, e é preciso ler com atenção:** `requester.requesterUserId`
que chega no corpo de `POST /turno` é **afirmação do cliente, não identidade
verificada** — não há autenticação de usuário humano nesta camada ainda (decisão
registrada em `docs/esteira/fase-2b-servidor-conversa/spec.md`). Ele serve para o
registro de execução (`ExecutionRecord`) e nada mais; a autorização real de qualquer
efeito no Workspace continua vindo do `delegationToken` de ambiente que o processo já
usa. Enquanto este endpoint não tiver autenticação própria, o registro de execução é
auditoria de **intenção**, não de **identidade**.

**Consequência para quando existir endpoint de aprovação (Fase 3 em diante):**
`approvedByUserId` (linha 44 acima) **não pode** ser comparado com um
`requesterUserId` vindo do corpo HTTP sem autenticação — a trava que impede "aprovação de
A autorizar ação de B" vira decorativa nesse instante. Isto precisa de solução de
identidade antes de existir aprovação por HTTP, não depois.

## Segredos

Nenhum valor de segredo entra em código, log, commit, memória ou documentação — só a
indicação de **onde** ele mora. As variáveis estão listadas em `docs/OPERATIONS.md`.
`.env` está no `.gitignore`.

## Ainda plano, não código

- **Pareamento de dispositivo Windows:** código curto e expirável, autorizado pela Thaís
  no Workspace, com tentativa limitada, sem reuso e credencial protegida pelo Windows.
  Lista de dispositivos e revogação visíveis.
- **Idempotência de escrita:** chave por usuário + ferramenta + `idempotencyKey`;
  repetição com argumentos diferentes devolve conflito. Falha com resultado externo
  desconhecido vira `needs_reconciliation` (o estado já existe no schema), nunca repetição
  cega.
- **Isolamento de memória:** permissão aplicada **antes** de recuperar resultado, inclusive
  caixa de e-mail e financeiro pessoal.

## Testes de segurança que já rodam

`pnpm run test` — suíte completa, sem rede. Os testes que são de segurança:

- ferramenta desconhecida negada;
- ação privilegiada negada;
- efeito externo para o turno sem executar nada;
- aprovação alterada, usada, expirada e **de outra pessoa**;
- **aprovação consumida:** a segunda chamada com o mesmo "sim" é barrada;
- injeção de prompt que não escapa do bloco;
- **resultado de ferramenta e mensagem de erro chegam ao motor embrulhados**;
- argumento sensível ausente do log, e código de log que não é SHA-256 puro;
- 401/403/429/503 tipados e nunca convertidos em lista vazia;
- **falha de autorização com frase distinta de "não encontrei tarefas"**;
- cancelamento honrado antes do passo, entre propostas e dentro do handler;
- efeito externo cancelado marcado para reconciliação, não como cancelado.

**Ainda não testado contra sistema real:** isolamento A/B de usuário, token revogado e
usuário desativado. Isso depende da Fase 1 e do Workspace de verdade — mock não prova
autorização de outro sistema.
