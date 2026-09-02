# Plano da Fase 1 — consulta autenticada de tarefas

**Critério de conclusão (briefing, seção 14):** HTTP real, isolamento A/B, contrato fixado
e link para o registro no Workspace.

**Estado: bloqueada.** O que falta não é código nosso — é o contrato do WORKSPACE
(ticket CORA-001). O que dá para fazer sem ele já foi feito.

---

## Parte A — já feito (Fase 0), verificado

| Arquivo | O que faz | Testes |
|---|---|---|
| `packages/contracts/src/workspace-agent/v1/tasks.ts` | schemas da resposta e dos parâmetros; `CONTRACT_VERSION`, `CONTRACT_SHA256` | via cliente |
| `packages/contracts/src/workspace-agent/v1/errors.ts` | códigos de erro, fallback por status, transitório vs. reautenticar | via cliente |
| `packages/contracts/src/fixtures/tarefas-sinteticas.ts` | fixtures `SYNTH-`, incluindo uma com injeção de prompt | — |
| `packages/workspace-client/src/client.ts` | GET, headers, timeout, validação da resposta | 15 |
| `packages/workspace-client/src/errors.ts` | erros tipados | coberto |
| `packages/workspace-client/src/pagination.ts` | percorre páginas, detecta id repetido e laço de cursor | 3 |
| `packages/policy/src/*` | catálogo, aprovação por hash, dado não confiável | 16 |
| `apps/server/src/run/turn.ts` | laço com tetos e cancelamento | 14 |
| `scripts/integracao-tarefas.ts` | integração HTTP real, travada até o contrato existir | verificado: sai 1 |

Comando: `pnpm run test` → `Tests 54 passed (54)`. `pnpm run typecheck` → limpo.

## Parte B — bloqueada, esperando CORA-001

O `response.md` precisa trazer quatro coisas. Sem elas, nada aqui anda:

1. `workspace-agent-v1.openapi.yaml` 0.1.0 + `workspace-agent-v1.sha256`;
2. o formato real de autenticação (hoje `authHeaders()` **chuta** os nomes);
3. como subir um Workspace local com banco isolado e semear os dados sintéticos;
4. como gerar token de delegação de teste: válido, expirado e revogado.

## Parte C — o que a CORA executa quando destravar, em ordem

### C1. Fixar o contrato

1. Copiar `med-coordination/contracts/workspace-agent-v1.openapi.yaml` para
   `packages/contracts/src/workspace-agent/v1/`.
2. Recalcular o SHA-256 localmente e comparar com o `.sha256` do WORKSPACE. **Divergiu,
   para.**
3. Preencher `CONTRACT_SHA256` com o hash conferido.
4. Reconciliar os schemas Zod com o YAML. Toda diferença vira anotação na aceitação — não
   silenciamos divergência editando o schema em silêncio.

Verificação: `pnpm run typecheck && pnpm run test` continuam verdes.

### C2. Ajustar a autenticação

Corrigir `authHeaders()` em `packages/workspace-client/src/client.ts` para o formato do
contrato. É uma função só, de propósito. Ajustar o teste que fixa os headers.

### C3. Subir o Workspace local com banco isolado

Seguindo as instruções do `response.md`, sem inventar comando. **Antes de rodar qualquer
script de teste do Workspace, ler o script** — o README daquele repositório avisa que
parte da integração envia e-mail real. Nada de `pnpm test` indiscriminado lá.

### C4. Integração real

```bash
pnpm run integracao:tarefas
```

Esperado: `resultado: 200 OK`, com tarefas sintéticas e ids distintos.

### C5. Provar do lado da Cora, contra o Workspace real

| # | Teste | Como |
|---|---|---|
| C5.1 | sem credencial → 401 | rodar sem `WORKSPACE_DELEGATION_TOKEN` |
| C5.2 | token expirado → 401 `DELEGATION_EXPIRED` | token expirado gerado pelo Workspace |
| C5.3 | token revogado → 401 | revogar entre duas chamadas |
| C5.4 | **isolamento A/B** | com token de A, a tarefa exclusiva de B **não** aparece |
| C5.5 | tarefa compartilhada | aparece para A e para B |
| C5.6 | excluída e concluída | ausentes |
| C5.7 | paginação | 25 tarefas, `limit=10`, 25 ids distintos, zero duplicata |
| C5.8 | Workspace desligado | `UPSTREAM_UNAVAILABLE`, **não** lista vazia |

Estes viram um arquivo de teste novo, `scripts/verificacao-fase-01.ts`, que roda contra o
Workspace local e imprime uma tabela de resultado. Ele **não** entra em `pnpm run test`:
a suíte padrão continua sem rede.

### C6. Evidência e aceitação

1. `med-coordination/evidence/cora/2026-XX-XX-fase-01-tarefas.md`: data, SHA dos dois
   repositórios, versão e hash do contrato, comando, código de saída, saída sanitizada.
   **Só id de tarefa, nunca título.**
2. `med-coordination/tickets/CORA-001/acceptance.md`: o que passou, o que divergiu do
   pedido, e o veredito. `done` só com C4 e C5.4 e C5.7 verdes.
3. Atualizar `status/cora.md` e `docs/ROADMAP.md`.
4. Commit e push (depende dos repositórios estarem privados — ver `docs/OPERATIONS.md`).

## O que a Fase 1 NÃO inclui

Criação de tarefa. Ela é Fase 2, com prévia e idempotência, e só começa depois que a
consulta real estiver comprovada. Conversa com modelo também é Fase 2.

## Riscos conhecidos

- **O contrato pode divergir do que a Cora supôs.** Provável nos nomes de header e no
  formato do cursor. Custo baixo: as suposições estão isoladas em duas funções.
- **`status=open` pode incluir mais que `PENDENTE`/`FAZENDO`** se o Workspace tiver regra
  que a Cora não viu. O schema recusa enum desconhecido, então isso aparece como erro
  explícito, não como dado errado passando.
- **Usuário desativado pode ser 401 ou 403.** Fixar qual no contrato antes de escrever o
  teste, para não travar o comportamento errado.
