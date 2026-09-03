# Operação da Cora

## Rodar no computador

Requisitos: Node 20.19+ (medido: v20.19.5) e pnpm 10 (medido: 10.19.0).

```bash
cd C:\Users\Desktop\source\repos\cora-med
pnpm install
pnpm run test
pnpm run typecheck
```

**O que aparece se der certo:** `Test Files 3 passed (3)` e `Tests 77 passed (77)`.
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

# Credencial do SERVIÇO Cora — DUAS metades, conforme o contrato.
# Emitidas por `pnpm agente cliente --nome <nome>`, no repositório do Workspace.
WORKSPACE_AGENT_CLIENT=
WORKSPACE_AGENT_SECRET=

# Token de delegação que representa o usuário humano. Expira e é revogável.
# Formato exato definido pelo contrato workspace-agent-v1 (ticket CORA-001).
WORKSPACE_DELEGATION_TOKEN=

# Chave da API do provedor de modelo (ADR 0002). Sem ela não há conversa; a consulta
# de tarefas da Fase 1 continua funcionando. É SEGREDO: nunca versionar o valor.
ANTHROPIC_API_KEY=

# Timeout de rede em milissegundos.
WORKSPACE_TIMEOUT_MS=10000

# Tetos de execução, aplicados pela própria aplicação.
CORA_MAX_MODEL_CALLS=10
CORA_MAX_RUN_SECONDS=120

# Chave do código de minimização do log de execução (HMAC). Opcional.
# Sem ela, uma chave aleatória por processo: o código correlaciona execuções da mesma
# sessão e some no reinício. Defina para correlacionar entre reinícios.
# É segredo: nunca versionar o valor.
CORA_LOG_HASH_KEY=
```

Nenhum valor real de segredo entra em arquivo versionado. `.env` está no `.gitignore`.

## Integração real com o Workspace (Fase 1)

```bash
pnpm run integracao:tarefas
```

O contrato está fixado (**0.2.0**, hash `d5dbff41…ec13a`), então o script roda. Ele imprime
data, SHA dos dois repositórios, versão do contrato, alvo, resultado, número de páginas e
os **ids** das tarefas — sem título, para não vazar conteúdo.

**Antes** é preciso subir o Workspace local e emitir credenciais, no repositório dele:

```bash
cd /c/Users/Desktop/source/repos/workspace-medconsultoria
pnpm db:up && pnpm dev            # API em :4319, MySQL em 127.0.0.1:3307
pnpm contas:teste                 # admin@teste.local etc., senha teste1234
pnpm agente cliente --nome cora-dev
pnpm agente delegar --cliente <clientId> --email admin@teste.local --minutos 60
```

**Confira que subiu:** `curl -s http://localhost:4319/health` → `{"status":"ok",...}`.

⚠️ **Nunca rode `pnpm --filter @app/api test` no Workspace** — parte das integrações dele
envia e-mail de verdade. Esta sessão não executou a suíte de lá.

⚠️ **O segredo do serviço e o token aparecem UMA vez.** Perdeu, emita outro.

## Verificação completa da Fase 1

```bash
WORKSPACE_BASE_URL=http://localhost:4319 \
WORKSPACE_AGENT_CLIENT=... WORKSPACE_AGENT_SECRET=... \
TOKEN_A=... TOKEN_B=... TOKEN_EXPIRADO=... \
pnpm exec tsx scripts/verificacao-fase-01.ts
```

**O que aparece se der certo:** uma tabela de 16 linhas e
`TODAS AS 16 VERIFICAÇÕES PASSARAM`, com código de saída 0.

Este script **não** entra em `pnpm run test`: a suíte padrão continua sem rede. `TOKEN_B`
é a delegação de `funcionario@teste.local` (o "usuário B" do isolamento) e `TOKEN_EXPIRADO`
sai de `pnpm agente delegar ... --minutos -1`.

O cenário A/B precisa de dados nos dois lados; sem isso o teste de isolamento passa por
vacuidade e não prova nada. As fixtures usadas estão descritas na evidência
`med-coordination/evidence/cora/2026-09-03-fase-01-tarefas.md` (prefixo `CORA-T-`,
rollback de duas linhas). CORA-002 pede ao WORKSPACE um comando de semeadura, para isso
deixar de ser SQL nosso.

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

- Os dois repositórios do GitHub **nasceram públicos**. Foram tornados **privados** pelo
  Thiago em 02/09/2026, **antes** do primeiro push — nada foi publicado enquanto estavam
  abertos. A mudança de visibilidade exige a mão dele: o classificador do harness bloqueia
  `gh repo edit --visibility` nesta sessão.
- `med-coordination`: branch `main`, publicada.
- `cora-med`: `main` com o commit de base, `fase-0/fundacao` com a entrega, PR #1 aberto.
- Nesta máquina, **só a sessão CORA roda Git em `med-coordination`**.

## Ainda não existe

Servidor HTTP da Cora, banco de dados, publicação, Docker, CI. Nada disso foi criado, e
nada foi publicado em lugar nenhum. VPS, DNS e implantação seguem no roteiro (Fase 7),
sem nenhuma ação tomada.
