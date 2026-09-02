# Operação da Cora

## Rodar no computador

Requisitos: Node 20.19+ (medido: v20.19.5) e pnpm 10 (medido: 10.19.0).

```bash
cd C:\Users\Desktop\source\repos\cora-med
pnpm install
pnpm run test
pnpm run typecheck
```

**O que aparece se der certo:** `Test Files 3 passed (3)` e `Tests 54 passed (54)`.
O typecheck não imprime nada quando passa — silêncio é sucesso.

**Se der errado:** `ERR_PNPM_...` normalmente é falta de rede na hora do install; rode
`pnpm install` de novo. Erro de tipo aponta arquivo e linha; o build não é ignorável.

## Variáveis de ambiente

Um arquivo `.env.example` deveria estar versionado aqui, mas as regras de permissão
**desta máquina** bloqueiam criar/editar qualquer caminho `.env*` — inclusive o exemplo.
Enquanto isso não muda, a lista canônica é esta:

```
# URL do Workspace local com banco isolado (Fase 1).
WORKSPACE_BASE_URL=http://localhost:3000

# Credencial do SERVIÇO Cora. Identidade do serviço, não do usuário.
WORKSPACE_SERVICE_TOKEN=

# Token de delegação que representa o usuário humano. Expira e é revogável.
# Formato exato definido pelo contrato workspace-agent-v1 (ticket CORA-001).
WORKSPACE_DELEGATION_TOKEN=

# Timeout de rede em milissegundos.
WORKSPACE_TIMEOUT_MS=10000

# Tetos de execução, aplicados pela própria aplicação.
CORA_MAX_MODEL_CALLS=10
CORA_MAX_RUN_SECONDS=120
```

Nenhum valor real de segredo entra em arquivo versionado. `.env` está no `.gitignore`.

## Integração real com o Workspace (Fase 1)

```bash
pnpm run integracao:tarefas
```

**Hoje isto responde:**

```
BLOQUEADO: o contrato workspace-agent-v1 ainda não foi fixado nesta cópia.
```

e sai com código 1. **Isso está correto** — é a trava que impede confundir mock com
integração. Ela some quando `CONTRACT_SHA256` deixar de ser `null` em
`packages/contracts/src/workspace-agent/v1/tasks.ts`, o que só acontece depois da resposta
do WORKSPACE em CORA-001.

Quando destravar, o script imprime data, SHA dos dois repositórios, versão do contrato,
alvo, resultado, número de páginas e os **ids** das tarefas — sem título, para não vazar
conteúdo. Essa saída é a evidência que vai para `med-coordination/evidence/cora/`.

## Coordenação entre as duas sessões

As duas janelas do VS Code **não conversam sozinhas**. O fluxo é manual e é este:

1. Nesta janela (Cora), o ticket CORA-001 já está escrito.
2. Thiago abre `workspace-medconsultoria` em outra janela e cola o prompt da seção 17 do
   briefing.
3. Quando aquela sessão escrever `response.md`, Thiago volta aqui e diz:
   **"Leia a caixa de entrada de coordenação e prossiga"**.

Não há watcher, não há automação, não há aprovação simulada. E não fazemos espera em
laço: sem resposta, o estado vira `blocked` e a sessão devolve o próximo passo humano.

## Git

- `cora-med` e `med-coordination` têm Git local inicializado; **nenhum push foi feito.**
- Motivo do push retido: os dois repositórios no GitHub **nascidos públicos**. O padrão
  desta máquina é repositório privado, e a Cora lida com dados de uma empresa de saúde.
- A mudança de visibilidade foi tentada e **bloqueada pelo classificador do harness**.
  Ela precisa da mão do Thiago:

```bash
gh repo edit garcia-goncalves/cora-med --visibility private --accept-visibility-change-consequences
gh repo edit garcia-goncalves/med-coordination --visibility private --accept-visibility-change-consequences
```

Depois disso o push é liberado.

- Nesta máquina, **só a sessão CORA roda Git em `med-coordination`**.

## Ainda não existe

Servidor HTTP da Cora, banco de dados, publicação, Docker, CI. Nada disso foi criado, e
nada foi publicado em lugar nenhum. VPS, DNS e implantação seguem no roteiro (Fase 7),
sem nenhuma ação tomada.
