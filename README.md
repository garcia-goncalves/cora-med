# Cora

Assistente empresarial da MedConsultoria, em português do Brasil. Ajuda a Thaís a
organizar a operação, consultar informações, preparar documentos, registrar pedidos e
executar ações autorizadas no Workspace.

**Estado hoje (02/09/2026): Fase 0.** Existe a fundação — contratos, cliente HTTP,
política de execução, laço de agente e testes. **Ainda não houve nenhuma conversa com o
Workspace real.** Ver `docs/ROADMAP.md` para o que é verdade e o que ainda não é.

## Como rodar

Requisitos: Node 20.19+ e pnpm 10.

```bash
pnpm install
pnpm run test
pnpm run typecheck
```

`pnpm run test` roda 54 testes contra fixtures sintéticas. Nenhum teste faz rede,
nenhum usa dado real, nenhum envia e-mail.

A integração real com o Workspace é outro comando, e ele se recusa a rodar até o
contrato existir:

```bash
pnpm run integracao:tarefas
```

Hoje ele responde `BLOQUEADO` e sai com código 1. Isso é o comportamento correto.

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

- consultar o Workspace de verdade (falta o contrato — ticket CORA-001);
- criar tarefa;
- conversar com um modelo de linguagem;
- voz, wake word, aplicativo Windows, PWA Android;
- controlar o navegador ou o computador.

## Documentação

`CLAUDE.md` para as regras curtas. `docs/` para o resto. A fonte canônica do produto é
`../med-coordination/CORA-MED-START-HERE.md`.
