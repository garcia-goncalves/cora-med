# LINKS — cora-med

Atualizado em **03/09/2026**.

## Não há aplicação para subir neste repositório (ainda)

`cora-med` é hoje um monorepo de **bibliotecas e testes**: contratos, cliente do
Workspace, política e o esqueleto do servidor. **Não existe processo que escute em
porta nenhuma** — `apps/server` não tem entrada com `listen()`, e o `package.json`
não tem script `dev` nem `start`. Por isso `/subir` não sobe nada aqui, e isso não é
defeito: o servidor HTTP da Cora nasce numa fase posterior.

Quando ele existir, esta seção passa a ter o link da aplicação.

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
