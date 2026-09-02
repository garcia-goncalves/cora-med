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
- expiração exatamente agora → negada.

Prévia mostrada ao usuário e hash aprovado são a mesma coisa. Mudou o destinatário do
e-mail, mudou o hash, a aprovação morre.

## Conteúdo de fora é dado, nunca instrução (implementado)

E-mail, tarefa, documento e página são **hostis até prova em contrário**. `wrapUntrusted()`
embrulha o conteúdo num bloco rotulado e neutraliza tentativa de fechar o bloco por dentro.
Há fixture com texto de injeção (`SYNTH-task-004`) e teste provando que o texto não escapa.

Isto é a camada de cima. A defesa que de fato segura é estrutural: catálogo fechado e
aprovação por hash. Um texto convincente não cria ferramenta que não existe.

## Registro de execução (implementado)

Cada execução grava `runId`, `requesterUserId`, `deviceId`, ferramenta, versão do contrato,
`approvalId`, horário e estado.

**Argumentos vão minimizados:** o log guarda a lista de chaves e um hash, **nunca o
conteúdo**. Há teste que passa `segredo: 'nome-de-paciente'` e verifica que a string não
aparece no registro.

## Tetos aplicados pela aplicação (implementado)

10 chamadas de modelo e 120 segundos por padrão, em `runTurn`. Cancelamento externo por
`AbortSignal` encerra o turno. Testes cobrem os três: teto de chamadas, teto de tempo e
cancelamento antes do primeiro passo.

Alerta de provedor não é corte de orçamento. O corte é nosso.

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

`pnpm run test` — 54 testes. Os que são de segurança:

- ferramenta desconhecida negada;
- ação privilegiada negada;
- efeito externo para o turno sem executar nada;
- aprovação alterada, usada e expirada;
- injeção de prompt que não escapa do bloco;
- argumento sensível ausente do log;
- 401/403/429/503 tipados e nunca convertidos em lista vazia;
- cancelamento honrado.

**Ainda não testado contra sistema real:** isolamento A/B de usuário, token revogado e
usuário desativado. Isso depende da Fase 1 e do Workspace de verdade — mock não prova
autorização de outro sistema.
