# Roteiro da Cora — o que é verdade e o que ainda não é

Atualizado em 10/09/2026. Fases conforme o briefing, seção 14.

A coluna **estado** só diz `feito` quando existe evidência executada. `scaffold compila`
não é `feito`.

| Fase | Entrega | Estado |
|---|---|---|
| 0 | Inventário, decisão do motor, contrato, coordenação | **feito** |
| 1 | Consulta autenticada de tarefas | **feito e comprovado** |
| 2 | Criação de tarefa com prévia aprovável | **feito e comprovado** |
| 2b | Conversa com modelo de linguagem | **primeiro turno real comprovado (Gemini) — ver abaixo** |
| 3 | Organização e resumo operacional | **feito sobre Tarefa; Card/Evento aguardam CORA-005 — ver abaixo** |
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
(`3fc5e144…4609b`, recalculado aqui antes de gravar) — esta fase foi comprovada contra a
0.1.0; a 0.2.0 chegou depois, com o CORA-003. Autenticação real implementada: são
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

## Fase 2 — a ESCRITA está feita e comprovada (03/09/2026)

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
  argumento.
- **Camada de prévia e idempotência** — travada por teste: ambiguidade vira pergunta e
  nunca prévia pronta; token vindo junto com ambiguidade é recusado; prazo ausente aparece
  como ausente e a palavra "hoje" não surge; argumento diferente do aprovado é barrado
  antes de sair da máquina; e a chave de idempotência é UUID v4 que **não** deriva do
  conteúdo.
- Duas revisões especialistas acharam **dois bloqueantes**, ambos corrigidos com teste:
  o histórico de um turno vazando para o seguinte, e amplificação de custo por título de
  tarefa sem tamanho máximo no contrato.

**Feito depois da resposta do CORA-003 (03/09/2026, mesma data):**

- **Schemas da escrita** (`packages/contracts/.../write.ts`) — prévia, criação, argumentos,
  ambiguidade, divergência e mudança, campo a campo como no YAML vendorizado. Uma régua é
  **mais estrita** que a do servidor de propósito: prazo exige fuso explícito (`Z` ou
  `±HH:MM`), porque `"2026-09-04T09:00:00"` é aceito pelo JavaScript e interpretado no fuso
  de quem interpreta — num campo que é prazo, isso é a tarefa vencendo no dia errado sem
  ninguém ter errado nada.
- **Os seis códigos de erro da escrita** — `APPROVAL_INVALID`, `APPROVAL_EXPIRED`,
  `APPROVAL_MISMATCH`, `APPROVAL_ALREADY_USED`, `PRECONDITION_CHANGED` e
  `IDEMPOTENCY_CONFLICT`. Nenhum deles é transitório, e há teste travando isso: repetir
  conflito às cegas é exatamente como se cria a segunda tarefa.
- **`previewTask()` e `createTask()`** no cliente. Três garantias com teste:
  a `Idempotency-Key` é conferida no formato antes de sair; `201` e `200` são fatos
  diferentes e o `created` do corpo **tem** de concordar com o status; e falha de
  transporte **depois** de enviar vira `WriteOutcomeUnknownError` com a chave dentro —
  nunca "não criou", que é o que faria a Cora repetir e criar a segunda tarefa.
- **Esquema de `workspace.tasks.create`** — o modelo descreve o pedido na forma da
  **prévia** e **não vê** `approvalToken` nem `Idempotency-Key`. Há teste que varre o JSON
  do esquema atrás dos dois nomes: aprovação que o modelo produz não é aprovação de ninguém.
- **Camada de prévia revisada contra a forma real do 0.2.1.** O que a revisão corrigiu:
  `responsavel` no singular virou `responsaveis[]` (o segundo responsável sumiria da tela);
  entraram `projeto` e `prioridade`, que não existiam na forma provisória; e o texto que
  prometia *"posso criar sem vínculo"* saiu — com o 0.2.1, referência **pedida** que não
  resolve zera o token, então a oferta não teria como ser cumprida.
- `typecheck` limpo e `pnpm audit` limpo. A contagem de testes não fica aqui: ela só
  envelhece — rode `pnpm run test` para o número de agora.

**CORA-003 respondido em 03/09/2026, e o contrato subiu para 0.2.1** (hash
`19009cb7…1b50e`, recalculado aqui antes de gravar; a 0.2.1 é mudança só de texto
sobre a 0.2.0, conferida por diff). A cópia vendorizada e as constantes
foram trocadas no mesmo commit — é o que o teste que rehasheia o arquivo exige.

O que o WORKSPACE definiu, e que muda o desenho:

- **Atomicidade por índice único com captura da violação**, não por nível de isolamento —
  em `REPEATABLE READ` duas conexões que conferem e depois gravam passam as duas.
- **W15 provado**, não descrito: duas criações em paralelo contra o servidor real, e visto
  reprovando quando a trava é sabotada.
- **`409` de revalidação com `divergencias[]`** campo a campo, distinguindo rótulo mudado,
  não encontrado e sem acesso — "a pessoa saiu" e "esse cliente não existe mais" pedem
  frases diferentes.
- **Referência pedida que não resolve também zera o token de aprovação** — mais estrito do
  que eu havia pedido, e adotado: gravar sem o cliente que a Thaís nomeou seria gravar
  calado outra coisa.
- **`tasks:write` deixou de ser inerte**: habilita criação **e** prévia.
- **Todo texto que vem do Workspace é dado, nunca instrução** — declarado no contrato a
  partir da 0.2.1. Não é retórica: `Cliente.nome` nasce do formulário **público** `/comecar`,
  preenchido **sem autenticação**, e volta como `rotulo` até o modelo. Um estranho escolhe o
  texto que a Cora vai ler. Eles devolvem inalterado de propósito; a mitigação é nossa e é o
  `wrapUntrusted`. Fixture para exercer: `cora-fx-cli-injecao`.
- **`Idempotency-Key` é normalizada para minúsculas** do lado deles. A mesma chave em caixa
  diferente criaria duas tarefas se não fosse isso.
- **Título normalizado em NFC** por eles — não normalizamos aqui.

**28 de 28 verificações passaram contra o Workspace real** (`scripts/verificacao-fase-02.ts`,
`http://localhost:4319`), em 03/09/2026 às 19:30 UTC, rodadas duas vezes com o mesmo
resultado. Evidência completa, com a tabela literal, em
`med-coordination/evidence/cora/2026-09-03-fase-02-escrita.md`; aceite em
`med-coordination/tickets/CORA-003/acceptance.md`, ticket `done`.

Vale nomear as três que mais custaram desenho: **C6.25** — duas criações em paralelo com a
mesma `Idempotency-Key` criam **uma** tarefa só, que é a W15 do WORKSPACE vista de fora;
**C6.17** — argumentos diferentes dos aprovados são recusados e o servidor **não executa o
novo**; e **C6.21** — a mesma chave em caixa alta é a mesma chave, sem o que duas tarefas
nasceriam e a segunda passaria despercebida.

**O que NÃO foi exercido, e não vale alegar que foi:** `429` dos freios, `503` com banco
caído, e — a maior lacuna — **`PRECONDITION_CHANGED` com `divergencias[]` reais**. Esta
última exigiria renomear uma fixture entre a prévia e a criação, dentro da janela de 15
minutos, no repositório do WORKSPACE, que esta sessão não toca. O tratamento existe e é
testado localmente, com as três frases distintas para `ROTULO_MUDOU`, `NAO_ENCONTRADO` e
`SEM_ACESSO`.

**Não verificado, e não vale alegar que foi:** nenhuma chamada real ao provedor de modelo
foi feita. A qualidade da extração de intenção em português **não** foi medida.

## O que aparece como indisponível, e vai continuar assim

Voz, wake word, desktop Windows, PWA Android, automação de navegador e e-mail proativo.
Nenhuma dessas coisas ganha botão com sucesso simulado.

**Criação de tarefa saiu desta lista em 03/09/2026**, e saiu inteira: ela foi exercida
contra um Workspace real, com prévia, aprovação vinculada ao conteúdo e idempotência.

**Conversa com modelo** ganhou a peça que faltava em 04/09/2026: existe agora um servidor
HTTP (`apps/server/src/http`, `GET /health` e `POST /turno`) escutando em porta,
encaixado no motor e no laço já existentes. 16 arquivos de teste, 282 testes, todos sem
rede — `ScriptedMotor` no lugar do motor real. Provado subindo o processo de verdade
(`pnpm --filter @cora/server run dev`) e batendo com `curl`.

**O que continua faltando, e não vale alegar que foi feito:** nenhuma chamada real à
Anthropic aconteceu — o processo subiu com uma chave sintética, nunca com uma de verdade.
A qualidade da extração de intenção em português não foi medida. O custo real por turno
não foi observado. E o servidor nasceu sem autenticação de usuário humano (usa as
variáveis de ambiente que o resto da aplicação já usa, não um login novo), sem CORS, sem
streaming de resposta e sem rate limit por IP — nenhum tem cliente real (desktop, PWA)
esperando ainda, então ficaram de fora de propósito
(`docs/esteira/fase-2b-servidor-conversa/spec.md`).

**Orçamento de custo** também saiu pela metade: o preço é real e datado, e o cálculo por
passo existe. O que não existe é medição de uso real com a Anthropic, porque nenhuma
chamada com chave de produção foi feita.

**Motor de teste (Gemini) — 04/09/2026.** Antes de gastar dinheiro na Anthropic, a Fase 2
ganhou um segundo `MotorPort`: `GeminiMotor` (`apps/server/src/engine/gemini-adapter.ts`),
sobre o nível **gratuito** do Google AI Studio. Decisão temporária e reversível — ver
`docs/decisions/0003-motor-de-teste-gemini.md`. Diferente do motor Anthropic, este **teve
chamada real, verificada nesta sessão**: `gemini-3.8-flash` (o modelo mais novo) devolveu
`503` (sobrecarga) três vezes seguidas; `gemini-2.5-flash` devolveu `404` (aposentado para
conta nova); `gemini-3.6-flash` respondeu de verdade, e é o modelo padrão do adaptador.
28 testes novos, sem rede, mesma disciplina do motor Anthropic. Custo observado: **zero**
— nível gratuito, sem faturamento habilitado no projeto do Google.

**Primeiro turno real — feito e comprovado (04/09/2026, `CORA-004`).** Credencial LOCAL
emitida pelo Workspace, `apps/server` subiu de verdade com `MOTOR_PROVIDER=gemini`, e
`POST /turno` respondeu `200` com a lista real de tarefas de `admin@teste.local`, buscada
ao vivo no Workspace local. Evidência completa em
`med-coordination/evidence/cora/2026-09-04-primeiro-turno-real.md`.

No caminho, dois achados: um bug real no `GeminiMotor` (mandava `additionalProperties` no
esquema das ferramentas; a API do Gemini rejeita — corrigido, com teste, em
`traduzirEsquemaParaGemini`) e uma prova não planejada de que conteúdo do Workspace chega
ao motor como dado, não instrução — uma tarefa de fixture com um título de injeção de
prompt foi listada como texto, nunca obedecida.

**O que continua faltando:** só uma mensagem foi trocada (sem ferramenta de escrita neste
turno), nenhuma chamada real à Anthropic, e o nível gratuito do Gemini devolveu `503`
("alta demanda") em duas tentativas antes da que funcionou — comportamento do provedor,
sem nada a corrigir do nosso lado.

**Roteiro de entrevista para a persona da Cora — 04/09/2026.** A persona hoje
(`apps/server/src/engine/persona.ts`) é genérica ("assistente de uma clínica"), sem nada
específico da MedConsultoria. `docs/negocio/entrevista-thais.md` reúne o que já dava para
confirmar sozinho (site, Manual da Marca, PDFs de credenciamento no Workspace, mapa de
telas do sistema) e as perguntas que só a Thaís pode responder — nenhum dado de negócio
foi inventado para preencher a persona antes da entrevista acontecer.

## Fase 3 — feita sobre Tarefa, comprovada localmente (10/09/2026)

Fila de entrada (`apps/server/src/inbox/fila.ts`), sincronização com reconciliação
(`sincronizar.ts`), resumo operacional com cinco estados nomeados e uma frase por
estado (`resumo.ts`), sugestão de nomes parecidos que nunca funde
(`nomes-parecidos.ts`) e a ferramenta `workspace.inbox.resumo`, alcançável pela Thaís
dentro do `POST /turno` que já existia. Detalhe completo em
`docs/esteira/fase-3-organizacao-operacional/` (briefing, spec, plano de execução) e
em `docs/ARCHITECTURE.md`. 354 testes, sem rede; `pnpm run typecheck` limpo.

**Duas revisões especialistas (typescript e security) acharam a mesma causa raiz,
corrigida com teste antes de considerar a fase fechada**: a fila descartava
atualização de item já visto ("primeiro registro vale"), então tarefa concluída ou
removida no Workspace continuava aparecendo como pendente enquanto o processo do
servidor vivesse — a revisão de segurança descreveu o cenário concreto de um título
malicioso criado via formulário público que sobreviveria à própria exclusão no
resumo. Corrigido: sincronização completa reconcilia a fonte inteira (o que sumiu no
Workspace some da fila); sincronização parcial só atualiza o que viu, sem apagar
nada.

**O que NÃO foi feito, e não vale alegar que foi:**

- **Card e Evento continuam sem dado real.** `CORA-005` foi aberto e enviado ao
  Workspace (`med-coordination/tickets/CORA-005/`, commit `0ff6190`) perguntando se
  essas entidades existem lá dentro; sem resposta ainda. O `InboxItem` só implementa
  `tipo: 'tarefa'` — a forma dos outros dois não foi pré-desenhada de propósito, para
  não repetir o retrabalho que aconteceu com o contrato de Tarefa entre as versões
  0.1.0 e 0.2.1.
- **Importação em lote de fonte externa** (e-mail, planilha) — a fonte não foi
  escolhida; ficou fora do escopo desta entrega por decisão do dono, não por corte
  unilateral.
- **Nenhuma chamada real ao provedor foi feita durante esta fase** — a suíte inteira
  roda sem rede, com `fetchImpl` injetado, como em todas as fases anteriores.
- Dois achados menores da revisão, sem risco confirmado hoje, ficaram registrados mas
  não corrigidos por proporcionalidade: o teste que impede fusão automática em
  `nomes-parecidos.ts` prova por nome de chave, não por conteúdo do módulo (o módulo
  em si está limpo, conferido linha a linha); e o matcher de nomes parecidos nasce
  sem chamador em produção, porque o contrato 0.2.1 de Tarefa não traz nome, só
  identificador.

**Ticket aberto, aguardando o Workspace:** `CORA-005` — Card e Evento no contrato
`workspace-agent-v1`, próxima versão minor, só leitura.

## Controles que acompanham toda fase, não a fase 7

Autenticação, autorização, registro de execução, tetos e isolamento de memória entram
junto com cada incremento. A fase 7 consolida operação; ela não é onde a segurança começa.
