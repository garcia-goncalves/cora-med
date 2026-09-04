## problema
O motor de conversa da Cora (`AnthropicMotor` + `runTurn` + `ToolRegistry`) existe e está
testado, mas nenhum processo escuta em porta — `apps/server/src/index.ts` hoje só
reexporta módulos como biblioteca. Ninguém de fora do processo de teste consegue mandar
uma mensagem e receber uma resposta. É a metade que falta da Fase 2b do roteiro
(`docs/ROADMAP.md`).

## solucao
Um entrypoint HTTP **novo** (não mexe em `index.ts`, que continua reexportando módulos —
nada no monorepo importa `@cora/server` como biblioteca hoje, confirmado por busca, mas o
risco de quebrar um contrato de reexportação por nada não vale a pena). Dois endpoints:

- `GET /health` → `200 { status: "ok" }`. Prova que o processo subiu.
- `POST /turno` → recebe corpo JSON validado por **Zod** (mesma ferramenta que o resto do
  repositório já usa para validar fronteira, nunca JSON Schema embutido de framework),
  monta `RequesterContext` + mensagens, chama `runTurn()` com um motor **novo por
  requisição** e devolve o `TurnOutcome` serializado.

**Sem framework HTTP novo.** Node `http` nativo — o repositório não tem nenhum framework
instalado hoje (nem no lockfile), o endpoint são dois handlers, e o gargalo real de
qualquer chamada é a API da Anthropic (segundos), não a camada HTTP (microssegundos).
Native `http` também testa mais simples: `server.listen(0)` pega porta efêmera dentro do
próprio teste vitest, e `fetch()` bate nela — sem precisar de `supertest` nem de
`.inject()` de framework, e sem dependência nova para auditar.

**Um motor por turno, sempre.** `AnthropicMotor` se amarra ao primeiro `runId` e falha
alto se reusado (`anthropic-adapter.ts:239-253`) — de propósito, para não vazar histórico
de uma pessoa para outra. O endpoint usa `criarMotorPorTurno(config)()` a cada `POST
/turno`, nunca um motor global de processo. Isto é a decisão mais importante desta peça:
um erro aqui é o único jeito de dois usuários verem a conversa um do outro.

**Erro nunca vaza segredo nem detalhe de rede ao cliente HTTP.** `MotorError.message` já
é documentado no código como "texto de log, não de tela" (`anthropic-adapter.ts:184-190`,
porque um 400 da Anthropic pode ecoar trecho da própria requisição). O handler HTTP
captura `MotorError`/`WorkspaceApiError`/erro de validação Zod e devolve mensagem própria,
tipada por categoria (corpo malformado, requester ausente, falha do motor, timeout) — o
`message` original vai só para o log minimizado que `runTurn` já produz.

**Teste sem rede, como todo o resto do repositório.** `ScriptedMotor` (já existe,
`engine/scripted.ts`) substitui `AnthropicMotor` nos testes do endpoint. O `WorkspaceClient`
injetado nas ferramentas continua usando `fetchImpl` de teste. Nenhum teste novo precisa
de `ANTHROPIC_API_KEY` nem de rede real.

**Comando para rodar de verdade**: segue o precedente já usado em
`"integracao:tarefas": "tsx scripts/integracao-tarefas.ts"` (raiz do `package.json`) — um
script novo, `pnpm --filter @cora/server run dev`, chamando `tsx` sobre o entrypoint HTTP.
Sem build/emit (o `tsconfig.json` já tem `noEmit: true`, isso não muda).

## o_que_ja_existe
- `apps/server/src/run/turn.ts:58` — `runTurn()`, laço completo, já recebe tudo por
  injeção (`motor`, `registry`, `requester`, `messages`, `approvals?`, `limits?`,
  `signal?`, `now?`) e devolve `TurnOutcome` fechado (`replied | needs_approval | denied |
  limit_reached | cancelled`). O endpoint HTTP é uma casca fina em volta desta função.
- `apps/server/src/engine/anthropic-adapter.ts:93` — `AnthropicMotor`, implementa
  `MotorPort`. `criarMotorPorTurno()` (linha 348-350) é a fábrica que já existe para criar
  uma instância por turno.
- `apps/server/src/engine/scripted.ts:10` — `ScriptedMotor`, motor de teste, já usado em
  `turn.test.ts` no mesmo padrão que os testes do endpoint HTTP vão usar.
- `apps/server/src/tools/registry.ts:21` — `ToolRegistry`, montada uma vez no boot,
  valida contra o catálogo de `@cora/policy`.
- `apps/server/src/tools/workspace-tasks.ts` e `workspace-create-task.ts` — handlers já
  implementados, não capturam erro de propósito (`docs/SECURITY.md:85-89`).
- `packages/workspace-client/src/client.ts:40` — `WorkspaceClient` já aceita `fetchImpl`
  injetável.
- `packages/contracts/src/cora/execution.ts:23-35` — `RequesterContextSchema`,
  `ToolCallProposalSchema` (Zod) — o corpo da requisição HTTP se valida espelhando/
  reaproveitando este schema, não inventando um novo formato.
- `vitest.config.ts:15` — já inclui `apps/**/*.test.ts`, nenhuma configuração nova de
  test runner.
- `package.json` raiz — Node `>=20.19`, `pnpm@10.19.0`, `"zod": "^3.24.1"` já é
  dependência do monorepo.
- `apps/server/src/index.ts` (6 linhas, só `export *`) — nada no monorepo importa
  `@cora/server`, confirmado por busca; ainda assim o entrypoint HTTP nasce em arquivo
  novo (`apps/server/src/http/server.ts`) para não arriscar esse contrato.

## fontes_externas
- npmjs.com/package/fastify e npmjs.com/package/hono, consultados em 04/09/2026 —
  versões atuais (Fastify 5.12.1, Hono 4.13.5) e ritmo de publicação.
- Busca agregando encore.dev/articles/nestjs-vs-fastify-vs-hono,
  pkgpulse.com/guides/hono-vs-express-vs-fastify-2026, hirenodejs.com — comparação de
  desempenho entre Node `http` nativo, Fastify, Hono e Express, consultada em 04/09/2026.
  **Ressalva do próprio Pesquisador**: números de blog de terceiros, não benchmark
  reproduzido nesta sessão — servem como ordem de grandeza, não medição própria, e não
  pesaram na decisão porque o gargalo real é a chamada ao provedor de modelo, não a
  camada HTTP.

## fora_de_escopo
Tudo que já estava fora no briefing (persistência, autenticação própria, interface
visual, chamada real à Anthropic, deploy/CI). Confirmado e ampliado pelo Diretor, com o
porquê de cada corte:

- **Múltiplos endpoints de conversa** (histórico, listagem, cancelamento assíncrono) —
  um `POST /turno` síncrono já cumpre o critério de aceitação; não há cliente real
  (desktop/PWA) esperando essas funcionalidades ainda.
- **Streaming de resposta (SSE/chunked)** — o adaptador Anthropic usa hoje
  `MessageCreateParamsNonStreaming` (`anthropic-adapter.ts:31`); trocar essa interface é
  trabalho de uma fase futura, quando existir UI de verdade.
- **CORS** — só importa com um navegador de origem diferente chamando (PWA, que "não
  existe" ainda, `docs/ARCHITECTURE.md:45`). Ativar sem cliente é superfície de ataque
  sem benefício.
- **Rate limit HTTP próprio** — `runTurn` já aplica teto de chamadas e tempo por turno;
  processo local, um usuário. Rate limit por IP é proteção de produção multiusuário,
  prematura aqui.
- **Ferramentas novas no `ToolRegistry`** — só as que já têm handler (`tasks.list`,
  `tasks.create`) entram no boot; adicionar ferramenta nova não é escopo desta entrega.

## contradicoes_resolvidas
Nenhuma contradição real entre as quatro lentes — convergiram: Pesquisador recomendou
Node nativo por não haver framework instalado e o teste-sem-rede ser requisito duro;
Arquiteto confirmou que não há precedente de framework no lockfile; Diretor cortou as
mesmas funcionalidades (streaming, CORS, multi-endpoint) que o Analista já apontou como
sem usuário hoje. A única decisão que exigiu escolha explícita (não contradição, ausência
de decisão prévia) foi **framework vs. nativo** — resolvida a favor de nativo pelos
motivos acima.

## duvidas_para_o_dono
nenhuma
