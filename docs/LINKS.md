# LINKS — cora-med

Atualizado em **04/09/2026**.

## Servidor HTTP da Cora

Existe desde 04/09/2026: `apps/server/src/http`, dois endpoints. Sobe com

```bash
WORKSPACE_BASE_URL=http://localhost:4319 \
WORKSPACE_AGENT_CLIENT=<emitido pelo Workspace> \
WORKSPACE_AGENT_SECRET=<emitido pelo Workspace> \
WORKSPACE_DELEGATION_TOKEN=<token de delegação> \
ANTHROPIC_API_KEY=<chave da Anthropic> \
pnpm --filter @cora/server run dev
```

- **Local**: http://127.0.0.1:4320/health — só responde na própria máquina, de propósito
  (não há autenticação de usuário humano ainda). Porta configurável em `CORA_PORT`.
- Recusa subir com qualquer variável faltando (código de saída 2, nomeia a variável).
- Passo a passo completo, exemplos de `curl` e o que aparece se der errado:
  `docs/OPERATIONS.md`.

⚠️ Nenhuma conversa real com a Anthropic foi feita ainda — só testada com motor de
mentira e com uma chave sintética. Ver `docs/ROADMAP.md`, Fase 2b.

## O que dá para rodar

```bash
pnpm install
pnpm run test        # suíte completa, sem rede
pnpm run typecheck   # não escreve nada quando está limpo
```

A prova de integração **não** roda sozinha e exige o Workspace de pé:

```bash
pnpm run integracao:tarefas
```

Passo a passo em `docs/OPERATIONS.md`.

## Portas de que este projeto depende

| Porta | O que é | De quem é |
|---|---|---|
| 4319 | API do Workspace (`/api/agent/v1/tasks`) | repositório `workspace-medconsultoria` |
| 4310 | Aplicação web do Workspace | repositório `workspace-medconsultoria` |
| 3307 | MySQL do Workspace, em container | repositório `workspace-medconsultoria` |

Subir essas três é trabalho da **janela do VS Code do Workspace**, não desta.

## Portas de outros projetos (não confundir)

| Porta | Projeto |
|---|---|
| 3939 | grimoire |
| 4777 | dervs |
| 5435 | Postgres do grimoire |
| 1039 / 8039 | Mailpit do grimoire |
| 9749 | codebase-memory-mcp (índice de código) |

## Credenciais

Não há aplicação local com login neste repositório. As credenciais de **agente**
usadas na verificação são emitidas pelo Workspace (`pnpm agente cliente` /
`pnpm agente delegar`) e ficam no arquivo de ambiente local, nunca no Git — o
modelo versionado é o `.env.example`.
