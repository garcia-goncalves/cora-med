# Cora

Assistente empresarial da MedConsultoria, em português do Brasil. Ajuda a Thaís a
organizar a operação, consultar informações, preparar documentos, registrar pedidos e
executar ações autorizadas no Workspace.

**Estado hoje (03/09/2026): Fases 0 e 1 concluídas.** A Cora consulta as tarefas internas
do usuário no Workspace por API versionada, com identidade delegada — **comprovado por HTTP
real**, não por mock: 16 verificações contra um Workspace local, incluindo isolamento entre
usuários. Ver `docs/ROADMAP.md` para o que é verdade e o que ainda não é.

## Como rodar

Requisitos: Node 20.19+ e pnpm 10.

```bash
pnpm install
pnpm run test
pnpm run typecheck
```

`pnpm run test` roda a suíte contra fixtures sintéticas. Nenhum teste faz rede,
nenhum usa dado real, nenhum envia e-mail.

A integração real com o Workspace é outro comando, e precisa de um Workspace local no ar
(passo a passo em `docs/OPERATIONS.md`):

```bash
pnpm run integracao:tarefas          # uma consulta real
pnpm exec tsx scripts/verificacao-fase-01.ts   # as 16 verificações
```

## Como o repositório é organizado

```
packages/contracts/        schemas do contrato do Workspace e do protocolo interno
packages/workspace-client/ cliente HTTP: erros tipados, paginação segura, timeout
packages/policy/           catálogo fechado de ferramentas, aprovação por hash,
                           tratamento de conteúdo não confiável
apps/server/               porta do motor, registro de ferramentas, laço de execução
scripts/                   integração HTTP real (Fase 1)
docs/                      arquitetura, fases, segurança, operação, licenças, decisões
```

## Os três repositórios

| Projeto | O que faz | Quem edita |
|---|---|---|
| `workspace-medconsultoria` | verdade operacional: clientes, tarefas, agenda, financeiro | sessão WORKSPACE |
| `cora-med` (este) | conversa, execução, aprovações, dispositivos | sessão CORA |
| `med-coordination` | caixa de entrada entre as duas sessões | CORA opera o Git |

A Cora **não** tem cadastro de usuário próprio. Quem manda em identidade, papel e
permissão é o Workspace, sempre.

## O que a Cora ainda NÃO faz

Nada disto existe hoje, e nenhum botão vai fingir que existe:

- criar tarefa;
- conversar com um modelo de linguagem;
- voz, wake word, aplicativo Windows, PWA Android;
- controlar o navegador ou o computador.

## Documentação

`CLAUDE.md` para as regras curtas. `docs/` para o resto. A fonte canônica do produto é
`../med-coordination/CORA-MED-START-HERE.md`.
