# Roteiro da Cora — o que é verdade e o que ainda não é

Atualizado em 02/09/2026. Fases conforme o briefing, seção 14.

A coluna **estado** só diz `feito` quando existe evidência executada. `scaffold compila`
não é `feito`.

| Fase | Entrega | Estado |
|---|---|---|
| 0 | Inventário, decisão do motor, contrato, coordenação | **parcial** |
| 1 | Consulta autenticada de tarefas | **bloqueada** — falta contrato |
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
- 54 testes locais passando (`pnpm run test`), com fixtures `SYNTH-`.
- `pnpm run typecheck` limpo.
- Script de integração existe e **recusa rodar** sem contrato fixado (verificado:
  código de saída 1).

**Falta para fechar a Fase 0:** o critério do briefing é "os dois Claudes trocam CORA-001
e registram resposta". A resposta do WORKSPACE ainda não existe.

**Limitação declarada:** a avaliação do Hermes foi estática, via API do GitHub. O Hermes
não foi instalado nem executado nesta máquina.

## Fase 1 — o que está bloqueado e por quê

Plano completo em `docs/plans/phase-01.md`.

Falta de `med-coordination/tickets/CORA-001/response.md`:

1. `workspace-agent-v1.openapi.yaml` 0.1.0 e seu SHA-256;
2. o formato real de autenticação de serviço + delegação;
3. como subir um Workspace local com banco isolado e dados sintéticos;
4. como gerar token de teste válido, expirado e revogado.

Sem 1 e 2, o cliente HTTP está chutando nomes de header. Sem 3 e 4, não existe alvo.

**Próximo comando humano:** abrir a janela do Workspace, colar o prompt da seção 17 do
briefing e, quando houver resposta, dizer na janela da Cora:
**"Leia a caixa de entrada de coordenação e prossiga"**.

## O que aparece como indisponível, e vai continuar assim

Conversa com modelo, criação de tarefa, voz, wake word, desktop Windows, PWA Android,
automação de navegador, e-mail proativo, orçamento de custo com preço real. Nenhuma dessas
coisas ganha botão com sucesso simulado.

## Controles que acompanham toda fase, não a fase 7

Autenticação, autorização, registro de execução, tetos e isolamento de memória entram
junto com cada incremento. A fase 7 consolida operação; ela não é onde a segurança começa.
