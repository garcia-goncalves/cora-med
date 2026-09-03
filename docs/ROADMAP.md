# Roteiro da Cora — o que é verdade e o que ainda não é

Atualizado em 03/09/2026. Fases conforme o briefing, seção 14.

A coluna **estado** só diz `feito` quando existe evidência executada. `scaffold compila`
não é `feito`.

| Fase | Entrega | Estado |
|---|---|---|
| 0 | Inventário, decisão do motor, contrato, coordenação | **feito** |
| 1 | Consulta autenticada de tarefas | **feito e comprovado** |
| 2 | Conversa e criação de tarefa | **em andamento** |
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
- Suíte local passando (`pnpm run test`), com fixtures `SYNTH-`. Eram 69 testes ao
  fechar esta fase; a contagem atual está na Fase 2.
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

**22 de 22 verificações passaram contra o Workspace real** (`scripts/verificacao-fase-01.ts`),
incluindo isolamento A/B com dado dos dois lados e o título com injeção de prompt chegando
ao motor embrulhado, ponta a ponta. Foram 16 no aceite do CORA-001 e 22 depois que o
CORA-002 fechou as lacunas de escopo insuficiente e revogação. Evidência completa em
`med-coordination/evidence/cora/2026-09-03-fase-01-tarefas.md`.

**O que NÃO foi validado, e não vale alegar que foi:** `403` de usuário desativado, `403`
por escopo insuficiente (não há caminho documentado — CORA-002), `403` de conta de Portal
(barrada antes, na emissão), `429` dos freios, `503` com banco caído, e revogação (provei
expiração, que usa o mesmo código).

## Fase 2 — em andamento

Conversa e criação de tarefa com prévia e idempotência. Precisa de endpoint de escrita, que
não existe no contrato 0.1.0. O plano vem antes do ticket: não peço contrato de escrita
antes de saber a forma de idempotência que quero.

**Feito, com teste local verde (03/09/2026):**

- **ADR 0002** — provedor e modelo escolhidos, com **preço lido na página oficial na data**
  e transcrito para `pricing.ts` junto com a data. Modelo fora da tabela produz custo
  `null`, nunca zero, e há teste que reprova a tabela quando ela passa de 180 dias.
- **`AnthropicMotor`** — primeiro `MotorPort` de verdade. Cliente por injeção: a suíte
  continua **sem rede**. Trata recusa do provedor como erro visível, e não como resposta
  vazia; falha alto quando o pareamento entre chamada e resultado não bate.
- **`tool-schemas.ts`** — só oferece ao modelo ferramenta que tem executor **e** esquema de
  argumento. `workspace.tasks.create` fica de fora de propósito: o contrato de escrita não
  chegou.
- **Camada de prévia e idempotência** — tipos internos e **provisórios** até o CORA-003
  responder. Travado por teste: ambiguidade vira pergunta e nunca prévia pronta; token
  vindo junto com ambiguidade é recusado; prazo ausente aparece como ausente e a palavra
  "hoje" não surge; argumento diferente do aprovado é barrado antes de sair da máquina;
  e a chave de idempotência é UUID v4 que **não** deriva do conteúdo.
- Duas revisões especialistas acharam **dois bloqueantes**, ambos corrigidos com teste:
  o histórico de um turno vazando para o seguinte, e amplificação de custo por título de
  tarefa sem tamanho máximo no contrato.
- Suíte em **140 testes**, `typecheck` limpo, `pnpm audit` limpo.

**Bloqueado por terceiro:** o endpoint de escrita depende da resposta do **CORA-003**, que
segue `proposed`. Nada de escrita é implementado antes dela.

**Não verificado, e não vale alegar que foi:** nenhuma chamada real ao provedor de modelo
foi feita. A qualidade da extração de intenção em português **não** foi medida.

## O que aparece como indisponível, e vai continuar assim

Criação de tarefa, voz, wake word, desktop Windows, PWA Android, automação de navegador e
e-mail proativo. Nenhuma dessas coisas ganha botão com sucesso simulado.

**Conversa com modelo** saiu desta lista pela metade, e a metade importa: o adaptador
existe e é testado, mas **não há servidor que o exponha** — nenhum processo desta casa
escuta em porta. Contar como pronto seria contar `scaffold compila` como `feito`.

**Orçamento de custo** também saiu pela metade: o preço é real e datado, e o cálculo por
passo existe. O que não existe é medição de uso real, porque nenhuma chamada foi feita.

## Controles que acompanham toda fase, não a fase 7

Autenticação, autorização, registro de execução, tetos e isolamento de memória entram
junto com cada incremento. A fase 7 consolida operação; ela não é onde a segurança começa.
