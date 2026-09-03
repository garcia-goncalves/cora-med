# Roteiro da Cora — o que é verdade e o que ainda não é

Atualizado em 03/09/2026. Fases conforme o briefing, seção 14.

A coluna **estado** só diz `feito` quando existe evidência executada. `scaffold compila`
não é `feito`.

| Fase | Entrega | Estado |
|---|---|---|
| 0 | Inventário, decisão do motor, contrato, coordenação | **feito** |
| 1 | Consulta autenticada de tarefas | **feito e comprovado** |
| 2 | Conversa e criação de tarefa | não iniciada |
| 3 | Organização e resumo operacional | não iniciada |
| 4 | Acesso Windows e PWA Android | não iniciada |
| 5 | Voz | não iniciada |
| 6 | Uma automação local real | não iniciada |
| 7 | Proatividade e implantação | não iniciada |

## Fase 0 — detalhe

**Feito e verificado:**

- ADR 0001 do motor, com commit avaliado e bloqueadores nomeados.
- Estrutura de coordenação criada; CORA-001 aberto em `proposed`.
- Fundação de código: contratos, cliente, política, laço de execução.
- 69 testes locais passando (`pnpm run test`), com fixtures `SYNTH-`.
- `pnpm run typecheck` limpo.
- Script de integração existe e **recusa rodar** sem contrato fixado (verificado:
  código de saída 1).

**Fase 0 fechada em 03/09/2026:** os dois Claudes trocaram CORA-001, o WORKSPACE registrou
a resposta com contrato e evidências, e a CORA registrou a aceitação — sem nenhum dos dois
alterar o repositório do outro.

**Limitação declarada:** a avaliação do Hermes foi estática, via API do GitHub. O Hermes
não foi instalado nem executado nesta máquina.

## Fase 1 — feita e comprovada (03/09/2026)

Contrato `workspace-agent-v1` **0.1.0** fixado por versão **e** hash
(`3fc5e144…4609b`, recalculado aqui antes de gravar). Autenticação real implementada: são
três cabeçalhos e duas identidades — a suposição anterior estava errada, e é por isso que
esta fase ficou `blocked` em vez de "quase pronta".

**16 de 16 verificações passaram contra o Workspace real** (`scripts/verificacao-fase-01.ts`),
incluindo isolamento A/B com dado dos dois lados e o título com injeção de prompt chegando
ao motor embrulhado, ponta a ponta. Evidência completa em
`med-coordination/evidence/cora/2026-09-03-fase-01-tarefas.md`.

**O que NÃO foi validado, e não vale alegar que foi:** `403` de usuário desativado, `403`
por escopo insuficiente (não há caminho documentado — CORA-002), `403` de conta de Portal
(barrada antes, na emissão), `429` dos freios, `503` com banco caído, e revogação (provei
expiração, que usa o mesmo código).

## Fase 2 — próxima

Conversa e criação de tarefa com prévia e idempotência. Precisa de endpoint de escrita, que
não existe no contrato 0.1.0. O plano vem antes do ticket: não peço contrato de escrita
antes de saber a forma de idempotência que quero.

## O que aparece como indisponível, e vai continuar assim

Conversa com modelo, criação de tarefa, voz, wake word, desktop Windows, PWA Android,
automação de navegador, e-mail proativo, orçamento de custo com preço real. Nenhuma dessas
coisas ganha botão com sucesso simulado.

## Controles que acompanham toda fase, não a fase 7

Autenticação, autorização, registro de execução, tetos e isolamento de memória entram
junto com cada incremento. A fase 7 consolida operação; ela não é onde a segurança começa.
