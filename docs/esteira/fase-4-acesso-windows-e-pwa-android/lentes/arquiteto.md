# Lente do Arquiteto — Fase 4 (acesso Windows e PWA Android)

Escopo desta lente: só o que já existe dentro de `cora-med` (e, por pedido explícito do
briefing, uma leitura só-de-leitura de `workspace-medconsultoria` para avaliar reaproveitamento
de login). Nenhuma pesquisa externa aqui — isso é do Pesquisador.

## 1. O que já existe de servidor/API para a tela consumir

- `apps/server/src/http/server.ts:157-223` — servidor HTTP com Node `http` nativo (sem
  framework), dois endpoints: `GET /health` e `POST /turno` (único ponto de conversa).
- `POST /turno` aceita `{"requester":{"requesterUserId","deviceId"},"mensagem"}` — schema
  `.strict()` em `apps/server/src/http/contrato.ts:27-32`, mensagem limitada a
  `MAX_CHARS_MENSAGEM = 8000` (`contrato.ts:18`). Resposta é síncrona, um JSON só, sem streaming
  — nada de SSE/WebSocket no código.
- Bind hoje é só `127.0.0.1`, explícito em `apps/server/src/http/main.ts:82` — o comentário na
  própria linha diz por quê: "não há autenticação de usuário humano ainda". Uma tela real
  publicada precisa mudar esse bind (ou colocar um proxy na frente) — decisão de arquitetura,
  não desta lente.
- **Defesa contra DNS rebinding já implementada e vai importar para o subdomínio da TineHost**:
  `apps/server/src/http/server.ts:34-37,183-190` — a lista `hostsPermitidos` (padrão
  `127.0.0.1`/`localhost`/`::1`) precisa ganhar o subdomínio real definido na fase de
  arquitetura, senão a tela em produção recebe `400 host_nao_permitido` em toda chamada.
- **O que falta no servidor para servir uma tela, documentado e confirmado no código:**
  `docs/OPERATIONS.md:273-276` e `docs/ROADMAP.md:178-182` listam, junto: autenticação de
  usuário humano, CORS, streaming de resposta, rate limit por IP, persistência. Conferido no
  código: não há `Access-Control-*` em `server.ts`; não há nenhum header de autenticação
  checado em `handleRequest`/`tratarTurno` (`server.ts:183-223`, `72-146`); não há streaming —
  `enviar()` (`server.ts:39-43`) escreve o corpo inteiro de uma vez.
- `docs/esteira/fase-2b-servidor-conversa/spec.md` é citado repetidamente como o lugar onde essa
  omissão foi decidida **de propósito** ("nenhum tem cliente real esperando ainda") — agora tem.

## 2. Autenticação de usuário humano hoje — e se o padrão do Workspace é reaproveitável

**Não existe autenticação de usuário humano em `cora-med` hoje.** `requester.requesterUserId`
que chega no corpo de `POST /turno` é **afirmação do cliente, não identidade verificada**
(`docs/SECURITY.md:126-133`, confirmado no código: `contrato.ts` só faz `z.string().min(1)`,
sem checar contra sessão nenhuma). Serve só para o registro de execução (`ExecutionRecord`).

O que a Cora já usa para falar com o Workspace, em nome de um humano, é o **token de
delegação**: `WorkspaceClient` (`packages/workspace-client/src/client.ts:88-94`) manda três
coisas em toda chamada — `X-Agent-Client`/`X-Agent-Secret` (identidade do **serviço** Cora) e
`Authorization: Bearer <delegationToken>` (identidade do **humano**, derivada pelo Workspace, a
Cora nunca manda `userId` solto). Hoje esse `delegationToken` é **um valor único e estático por
processo**, lido de `WORKSPACE_DELEGATION_TOKEN` no boot (`apps/server/src/http/main.ts:59,70-75`)
— não há, no código da Cora, nenhum mecanismo para obter um token por sessão de usuário
autenticado no navegador. Ele é emitido hoje por um **comando CLI** no lado do Workspace:
`pnpm agente delegar --cliente <clientId> --email <email> --minutos <n>`
(`docs/OPERATIONS.md:174`, confirmado como script em
`workspace-medconsultoria/apps/api/src/scripts/agente.ts`, invocado por
`package.json:26` — `"agente": "pnpm --filter @app/api exec tsx src/scripts/agente.ts"`). Não é
uma rota tRPC alcançável por sessão de navegador; é um comando de operador com acesso ao banco.

**O que existe do lado do Workspace para login humano de verdade** (lido, não editado):
- `workspace-medconsultoria/apps/api/src/modules/auth/auth.service.ts` — login por e-mail/senha
  com Argon2id, defesa de tempo contra enumeração, dois freios de força bruta (por
  IP+e-mail e por IP puro), sessão persistida no Postgres/Prisma
  (`workspace-medconsultoria/apps/api/src/lib/session.ts:26-40`, TTL 30 dias, 30 min em modo
  suporte).
- `workspace-medconsultoria/apps/api/src/modules/auth/auth.router.ts:39-44` — o login seta um
  **cookie `sid`** `httpOnly`, `secure` (em prod), `sameSite: "lax"`, assinado
  (`cookieOptions`, linhas 28-35). Isto é uma sessão de servidor tRPC/Fastify, amarrada ao
  domínio do Workspace (`WEB_ORIGIN`, checado em `workspace-medconsultoria/apps/api/src/config.ts:12,55-77`)
  — um cookie `sameSite=lax` de `workspace.medconsultoria...` **não é enviado** para um
  subdomínio diferente da Cora (`cora.medconsultoria...` ou o que for escolhido), e a sessão
  só existe no banco do Workspace, que `cora-med` não pode consultar (regra deste repositório:
  "não edite `workspace-medconsultoria`", e produção da Cora não lê do banco do Workspace).
- `workspace-medconsultoria/apps/web/src/features/auth/LoginPage.tsx` e
  `workspace-medconsultoria/apps/web/src/lib/auth-context.tsx` — a tela e o contexto React que
  consomem esse cookie; são do app Next do Workspace, não expõem nada reaproveitável por HTTP
  fora dali.

**Conclusão desta lente sobre a hipótese do briefing ("reaproveitar o login que Thaís e o dono
já têm no Workspace"):** o *mecanismo* de identidade real (usuário/senha, sessão, hash) já
existe e é bom — mas **não há hoje nenhuma ponte HTTP entre "estar logado no Workspace" e
"a Cora recebe um token de delegação para essa pessoa"**. A única ponte que existe é manual
(CLI, feita por quem tem acesso ao servidor do Workspace). Fazer o reaproveitamento de verdade
— login único, sem senha nova — exigiria **uma mudança do lado do Workspace** (endpoint
autenticado que, dada uma sessão válida, emite ou renova um `delegationToken` de curta duração
para o cliente Cora) e isso, por regra deste repositório, **é ticket em
`med-coordination/tickets/`, nunca edição local**. Cabe ao Diretor/dono decidir se abre esse
ticket nesta fase ou se a Fase 4 nasce com um login próprio da Cora (mínimo: e-mail/senha
armazenado do lado da Cora, ou short-lived link enviado por e-mail) — as duas rotas evitam
"banco de senha novo e paralelo" só se o ticket for aceito a tempo; sem resposta do Workspace,
duplicar é a única opção que não bloqueia a fase.

## 3. Convenção de testes sem rede — o que uma camada de auth nova precisa seguir

Confirmado em `apps/server/src/run/turn.test.ts:1-49` e em
`packages/workspace-client/src/client.ts:40` (`fetchImpl?: typeof fetch — injetável para teste.
Nenhum teste da suíte usa o fetch real`): todo cliente de rede em `cora-med` recebe o `fetch`
por injeção de dependência via opção do construtor, nunca importa `fetch`/`undici` direto. O
motor de conversa segue o mesmo molde com `ScriptedMotor` (`apps/server/src/engine/scripted.ts`,
usado em `turn.test.ts:6,32`) — um roteiro de respostas pré-programadas no lugar do provedor
real. `docs/OPERATIONS.md:14` mostra o número vivo hoje: 16 arquivos de teste, 282 testes
(a Fase 3 subiu para 354, conforme `docs/ROADMAP.md:230`), todos sem rede.

Para a autenticação nova (login web + emissão de token para desktop/PWA), a régua "sem rede"
implica: **qualquer verificação de senha, JWT ou sessão precisa aceitar um `now()` e um cliente
HTTP/crypto injetáveis**, do mesmo jeito que `WorkspaceClient` aceita `fetchImpl` e
`requestIdFactory` (`client.ts:40,42,70-77`) e `criarServidorHttp` aceita `now`
(`server.ts:21`). O critério de aceitação do briefing já nomeia isso — "token válido/expirado/
inexistente" — e é exatamente o padrão que `PedidoDeCriacaoDoCliente`/`ArmazemDePrevias` já usam
para aprovação com expiração (`docs/SECURITY.md:32-52`, testado com "aprovação expirada" e
"expiração exatamente agora").

## 4. Estrutura de monorepo — onde `apps/web` e `apps/desktop` encaixariam

- `pnpm-workspace.yaml:1-3` — só duas linhas: `packages/*` e `apps/*`. Sem `turbo`, sem
  `nx`, sem `lerna` — nenhum orquestrador de monorepo além do pnpm workspace nativo
  (confirmado: não há `turbo.json` nem dependência de `turbo` em `package.json` raiz).
- Único app hoje é `apps/server` (`@cora/server`, conferido pelo filtro
  `pnpm --filter @cora/server run dev` em `docs/OPERATIONS.md:34`). Um `apps/web` (a tela de
  chat) e um `apps/desktop` (o wrapper Tauri) entram como pacotes-irmãos, mesma convenção —
  cada um com seu `package.json` e nome `@cora/<nome>`, alcançável por
  `pnpm --filter @cora/<nome> run <script>`.
- `tsconfig.json` raiz e `vitest.config.ts` raiz são únicos hoje (não há um por pacote) — um
  app novo herda a configuração raiz a menos que precise de algo específico (ex.: `apps/web`
  quase certamente precisa de config própria por causa de JSX/bundler, o que já é destoante
  do padrão atual e vale nomear na síntese).
- `packages/contracts` é o lugar natural para o schema de login/sessão que web, desktop e PWA
  vão compartilhar (mesmo molde de `PedidoDeTurnoSchema` hoje só em `apps/server/src/http/
  contrato.ts` — se web e desktop também precisam validar o mesmo formato de credencial, esse
  schema deveria subir para `packages/contracts`, não nascer duplicado em `apps/web`).
- Não existe hoje nenhum pacote de UI/design system, nem dependência de React/Vite/Tauri no
  `pnpm-lock.yaml` raiz — `apps/web` nasce em terreno limpo, sem convenção de componente para
  seguir (é responsabilidade do papel de Design, não desta lente).

## 5. CI atual — o que já roda e o que a Fase 4 precisa estender

`.github/workflows/ci.yml` — um único job (`verify`, `ubuntu-latest`): checkout, pnpm via
`packageManager` do `package.json` (sem `version:` fixa no workflow, de propósito — comentário
nas linhas 26-27), Node 22, `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm run
test`. Gatilhos: `push` (com `paths-ignore: ['**.md','docs/**']`) e `pull_request`
(`ci.yml:5-8`); `concurrency` com `cancel-in-progress: true` por branch (`ci.yml:12-14`);
`permissions: contents: read` (`ci.yml:17-18`, comentário explícito: "CI só precisa ler"). Nada
de e2e, nada de build de app web, nada de empacotamento Windows — **tudo isso é novo para a
Fase 4** e precisa seguir o padrão escalonado do `CLAUDE.md` global (e2e só em `pull_request` e
antes de publicar, nunca em todo `push`). Não há segredo nenhum configurado no workflow hoje
(nenhum `env:`/`secrets:` no arquivo) — login real e build assinado do instalador Windows vão
precisar de segredo novo no GitHub Actions, o que é decisão a escalar, não desta lente.

## O que já resolve metade do pedido (achado mais valioso desta lente)

- O contrato de conversa (`POST /turno`) já existe, já é testado (354 testes) e já foi provado
  de ponta a ponta contra o Workspace real e contra dois provedores de modelo — a "tela conversa
  com a Cora de verdade" não precisa de nenhuma peça nova do lado do motor/ferramentas, só de
  autenticação, CORS e (opcionalmente) streaming na camada HTTP que já existe.
- A defesa de identidade do humano (token de delegação, nunca `userId` solto) já é a base
  correta — o problema não é desenhar de novo "como a Cora sabe quem é o humano ao falar com o
  Workspace", é como a **tela nova** obtém esse token com login real, sem duplicar segredo.
- O padrão de teste sem rede (injeção de `fetchImpl`/`now`/motor roteirizado) já está maduro e
  dá o molde exato que a camada de auth nova deve seguir — não é uma decisão em aberto.

## O que quebra / trava se a fase avançar sem decisão

- Publicar a tela com o servidor ainda ligado só a `127.0.0.1` (`main.ts:82`) simplesmente não
  funciona — é mudança de arquitetura, não de código de tela.
- `hostsPermitidos` (`server.ts:37`) vai recusar qualquer origem que não seja
  `127.0.0.1/localhost/::1` até o subdomínio real da TineHost entrar na lista — quem esquecer
  isso vê `400 host_nao_permitido` em produção e vai gastar tempo achando bug em CORS quando é
  essa checagem.
- Sem CORS explícito, uma tela web servida de outro host que tente chamar `POST /turno` via
  `fetch` do navegador é bloqueada pelo próprio navegador antes de qualquer coisa no servidor.

## duvidas_para_o_dono

1. **Abrir ticket ao Workspace pedindo um endpoint de emissão de `delegationToken` a partir de
   sessão autenticada** (o que tornaria o reaproveitamento de login real, não só de senha) —
   ou aceitar login próprio da Cora nesta fase e revisitar depois? Recomendação: abrir o
   ticket já nesta fase (mesmo ritmo do CORA-005), porque a resposta pode demorar e a Fase 4
   não deveria ficar bloqueada esperando — mas construir com um login mínimo próprio (e-mail/
   senha ou magic link, comparável em custo ao já existente no Workspace) como plano B se a
   resposta não vier a tempo, sem duplicar segredo estático (delegation token fixo por
   processo) em produção.
