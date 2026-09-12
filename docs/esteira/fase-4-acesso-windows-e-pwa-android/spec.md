# Spec — Fase 4: acesso Windows e PWA Android

## problema

A Cora existe como API HTTP sem nenhuma tela: `POST /turno` é o único ponto de conversa
(`apps/server/src/http/server.ts:157-223`) e o servidor só escuta em `127.0.0.1`
(`apps/server/src/http/main.ts:82`, com o comentário na própria linha dizendo o porquê:
"não há autenticação de usuário humano ainda"). Consequência concreta: tudo que a Fase 3
construiu — fila, resumo operacional, os cinco estados nomeados de
`apps/server/src/inbox/resumo.ts` — está inacessível para a única pessoa que ele serve.
Thaís não é desenvolvedora; para saber "como estão minhas pendências" ela hoje só tem o
Workspace ou pedir para alguém rodar uma chamada técnica. É dado construído sem porta de
entrada.

Somam-se a isso dois buracos que travam qualquer tela publicada:

- **Não existe identidade humana verificada em `cora-med`.** O `requester.requesterUserId`
  que chega no corpo de `POST /turno` é afirmação do cliente, não identidade
  (`apps/server/src/http/contrato.ts:27-32` valida só `z.string().min(1)`;
  `docs/SECURITY.md:126-133` registra isso). O que a Cora usa para falar com o Workspace
  em nome de um humano é um `delegationToken` **único e estático por processo**, lido de
  `WORKSPACE_DELEGATION_TOKEN` no boot (`apps/server/src/http/main.ts:59,70-75`) — ou
  seja, hoje Thaís e o dono seriam literalmente a mesma pessoa para o Workspace, jogando
  fora o isolamento por usuário que a Fase 1 provou.
- **A camada HTTP não está pronta para sair do laptop.** Sem autenticação, sem CORS, sem
  rate limit (`docs/OPERATIONS.md:273-276` e `docs/ROADMAP.md:178-182` listam isso junto;
  conferido no código: não há `Access-Control-*` nem header de auth checado em
  `handleRequest`/`tratarTurno`). E a defesa contra DNS rebinding já implementada
  (`apps/server/src/http/server.ts:34-37,183-190`) recusa qualquer host que não seja
  `127.0.0.1`/`localhost`/`::1` — em produção isso vira `400 host_nao_permitido` em toda
  chamada até o subdomínio real entrar na lista.

## solucao

Uma tela de chat web publicada em HTTPS na TineHost, com **login próprio da Cora** para
duas contas nomeadas, servida pelo **mesmo `apps/server` e na mesma origem** da API — e
essa mesma URL embrulhada duas vezes: PWA instalável no Android e janela nativa Tauri no
Windows. Uma interface, dois invólucros, zero duplicação de tela.

**Autenticação (a decisão central desta fase, detalhada em `contradicoes_resolvidas`):**
login próprio mínimo, sem biblioteca de framework de auth. E-mail + senha com hash
`argon2` (mesmo algoritmo que o Workspace já usa), sessão opaca assinada em cookie
`httpOnly` + `Secure` + `SameSite=Lax`, emitida, validada, expirada e encerrada dentro de
`apps/server`. Duas contas provisionadas à mão, senha digitada **dentro do servidor**
(regra 0.8 do CLAUDE.md global) — nada de tela de administração de usuários, nada de
recuperação de senha, nada de 2FA.

**Ponte até o Workspace:** a sessão autenticada resolve *quem* é o humano; a chamada ao
Workspace continua usando o `delegationToken` do padrão já existente
(`packages/workspace-client/src/client.ts:88-94` — `X-Agent-Client`/`X-Agent-Secret` +
`Authorization: Bearer <delegationToken>`, a Cora nunca manda `userId` solto). A mudança é
que o token deixa de ser **um por processo** e passa a ser **um por usuário**, resolvido a
partir da sessão: cada conta nomeada tem o seu token de delegação provisionado por
variável de ambiente própria. É o mínimo que restaura o isolamento por usuário sem inventar
mecanismo novo, e é o ponto exato que um SSO futuro substituiria.

**Servir a tela na mesma origem da API** é o que faz três lentes convergirem numa decisão
só: elimina CORS cross-origin, torna o cookie `SameSite=Lax` viável (que é o padrão seguro
para cliente e API sob o mesmo domínio) e resolve o `hostsPermitidos` com uma entrada de
configuração em vez de uma arquitetura de proxy. O bind de `main.ts:82` passa a ser
configurável e o subdomínio entra na lista de hosts permitidos.

**Tela:** Vite + React, SPA simples (lista de mensagens + campo de entrada), com os estados
explícitos que a Fase 3 já garante no dado — "sem pendências", "não consegui consultar" e
"sincronização incompleta" são frases diferentes e a tela não pode fundi-las num
carregando genérico. Envio que falha por rede aparece como falha com opção de reenviar,
nunca some em silêncio.

**PWA:** `manifest.json` com `name`/`short_name`, ícones (192 e 512 por compatibilidade),
`start_url`, `display: standalone`, sem `prefer_related_applications`; service worker
mínimo cacheando só o shell. HTTPS via Let's Encrypt pelo painel DirectAdmin.

**Windows:** Tauri v2 com a janela apontada para a URL de produção, lida de configuração —
nunca fixa no código. Instalador gerado na máquina Windows do dono (Rust + C++ Build
Tools), não por pipeline.

**Testes:** tudo sem rede, seguindo o molde já maduro do repositório — `fetchImpl`, `now` e
motor roteirizado injetados (`packages/workspace-client/src/client.ts:40`,
`apps/server/src/engine/scripted.ts`, `apps/server/src/run/turn.test.ts:1-49`).
Autenticação é testada por mecanismo: sessão válida, expirada, inexistente, adulterada.

**Ordem de execução** (pelo que destrava o resto, herdada do Diretor): sessão no
`apps/server` → design + tela contra o servidor local → publicação na TineHost com HTTPS e
login ponta a ponta (**este é o marco**; portão de risco de produção antes dele) → PWA →
Tauri → revisão de segurança e evidência.

## o_que_ja_existe

Só entra aqui o que tem caminho real conferido no disco.

- `apps/server/src/http/server.ts:157-223` — servidor HTTP em Node `http` nativo, sem
  framework, com `GET /health` e `POST /turno`. É a camada que ganha auth, CORS e o
  servimento estático da SPA.
- `apps/server/src/http/server.ts:34-37,183-190` — `hostsPermitidos` (defesa contra DNS
  rebinding) já implementada; precisa ganhar o subdomínio de produção, senão toda chamada
  volta `400 host_nao_permitido`.
- `apps/server/src/http/server.ts:21` — `criarServidorHttp` já aceita `now` injetável: é o
  gancho pronto para testar expiração de sessão sem relógio real.
- `apps/server/src/http/server.ts:39-43` — `enviar()` escreve o corpo inteiro de uma vez;
  confirma que não há streaming (e que streaming continua fora de escopo).
- `apps/server/src/http/contrato.ts:18,27-32` — schema `.strict()` do `POST /turno`,
  `MAX_CHARS_MENSAGEM = 8000`. O `requesterUserId` daqui passa a ser derivado da sessão, não
  aceito do cliente.
- `apps/server/src/http/main.ts:59,70-75,82` — bind `127.0.0.1` e leitura do
  `WORKSPACE_DELEGATION_TOKEN` único por processo: os dois pontos exatos que esta fase muda.
- `packages/workspace-client/src/client.ts:40,42,70-77,88-94` — os três cabeçalhos de
  identidade (serviço + humano) e a injeção de `fetchImpl`/`requestIdFactory`. Padrão de
  identidade correto, mantido; padrão de teste sem rede, a ser seguido pela auth nova.
- `apps/server/src/engine/scripted.ts` e `apps/server/src/run/turn.test.ts:1-49` — motor
  roteirizado, o molde de teste sem rede já em uso.
- `apps/server/src/run/idempotency.ts:39-51` — união discriminada com uma frase por estado;
  é o formato que a tela deve espelhar em vez de inventar estados próprios.
- `apps/server/src/inbox/resumo.ts` (e `resumo.test.ts`, `fila.ts`, `sincronizar.ts`) — o
  resumo operacional da Fase 3 com estados nomeados, que a tela precisa exibir sem fundir.
- `apps/server/src/tools/workspace-tasks.ts:41-48,49,66` — "lista vazia" e "erro de
  consulta" já são frases distintas; a garantia que a tela não pode desfazer.
- `packages/policy/src/untrusted.ts` — `wrapUntrusted`/`cortarParaLimite`: conteúdo do
  Workspace é dado, nunca instrução. A tela herda isso e precisa escapar HTML na exibição
  (o vetor de título com injeção já é fixture testada, `docs/ROADMAP.md`).
- `packages/contracts/src/index.ts` — onde o schema de credencial/sessão compartilhado
  entre server, web e desktop deve nascer, em vez de duplicar em `apps/web`.
- `pnpm-workspace.yaml` — `packages/*` e `apps/*`, sem turbo/nx/lerna. `apps/web` e
  `apps/desktop` entram como pacotes-irmãos de `apps/server`, alcançáveis por
  `pnpm --filter @cora/<nome>`.
- `.github/workflows/ci.yml` — job único `verify` (typecheck + test, `paths-ignore` de
  `.md` no push, `concurrency` com `cancel-in-progress`, `permissions: contents: read`,
  nenhum segredo). Build da web entra aqui; empacotamento Windows não entra (exige máquina
  Windows).
- `docs/OPERATIONS.md:174,273-276` — o comando CLI de emissão de delegação
  (`pnpm agente delegar`) e a lista declarada do que falta no servidor para servir uma tela.
- `docs/SECURITY.md:32-52,126-133` — `requesterUserId` como afirmação não verificada, e o
  padrão de aprovação com expiração (testado com "aprovação expirada" e "expiração
  exatamente agora"), que é o molde de teste de expiração de sessão.
- `workspace-medconsultoria/apps/api/src/modules/auth/auth.service.ts` — login Argon2id com
  defesa de tempo contra enumeração e dois freios de força bruta (IP+e-mail e IP puro).
  **Leitura de referência, não dependência**: copiar as decisões, não o código.
- `workspace-medconsultoria/apps/api/src/modules/auth/auth.router.ts:28-35,39-44` — cookie
  `sid` `httpOnly`/`secure`/`sameSite: "lax"` assinado. Mesma coisa: molde confirmado em
  produção pelo mesmo dono.
- `workspace-medconsultoria/apps/web/src/features/auth/LoginPage.tsx` — documenta em
  comentário dois fracassos reais de login já vividos: autofill preenchendo conta errada em
  silêncio, e senha antiga parecendo preenchida depois de um erro. A tela de login da Cora
  nasce sabendo disso.
- `C:\Users\Desktop\source\repos\medconsultoria-bkp\DEPLOY.md` — o processo real de
  publicação Node.js no DirectAdmin da TineHost (Application Root, Startup File, Node 20,
  variáveis no painel, Install/Restart/Rebuild, SSL pelo painel). Referência operacional
  mais confiável que qualquer blog genérico: mesmo provedor, mesmo esquema, já em produção.
- `med-coordination/tickets/` (CORA-001 a CORA-005) — o canal, e o único canal, para
  qualquer pedido ao Workspace. CORA-005 está aberto sem resposta.

**Descartado por falta de caminho:** nada. Todos os achados das quatro lentes vieram com
caminho e todos foram conferidos no disco.

## fontes_externas

Todas consultadas em 11/09/2026 pelo Pesquisador.

- MDN — critérios reais de PWA instalável:
  <https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable>
- web.dev — instalação de PWA (service worker como bloqueio silencioso do prompt no
  Chrome/Android): <https://web.dev/learn/pwa/installation>
- Tauri v2 — pré-requisitos de build (Rust stable MSVC, `rustc` 1.77+, Node 20+, Microsoft
  C++ Build Tools, WebView2 de fábrica no Win10 1803+/Win11):
  <https://v2.tauri.app/start/prerequisites/>
- Tauri v2 — tamanho de bundle (~3 MB contra ~96 MB de Electron equivalente) e arquitetura
  / licença dual MIT OR Apache-2.0: <https://v2.tauri.app/concept/size/> e
  <https://v2.tauri.app/concept/architecture/>
- patterns.dev — React 2026, Vite como caminho recomendado para SPA (CRA descontinuado):
  <https://www.patterns.dev/react/react-2026/>
- Preact, alternativa leve avaliada e não escolhida:
  <https://www.alphabold.com/preact-vs-react/>
- Lucia — **descontinuada em março/2025**, não usar:
  <https://github.com/lucia-auth/lucia> e
  <https://github.com/lucia-auth/lucia/discussions/1707>
- Better Auth como alternativa viva (MIT), avaliada e não escolhida — fonte é blog, não
  documentação oficial: <https://solodevstack.com/blog/betterauth-vs-lucia-solo-developers>
- Cookie httpOnly vs Bearer em 2026, e a ressalva de CSRF:
  <https://crosscheck.cloud/blogs/cookies-vs-jwt-authentication-2026/> e
  <https://dev.to/nadeem137/cookie-auth-vs-bearer-token-in-express-whats-the-difference-and-when-to-use-each-51h4>
- CloudLinux — Node.js Selector, o mecanismo por trás do painel DirectAdmin da TineHost:
  <https://cloudlinux.com/getting-started-with-cloudlinux-os/42-profitability-and-php-features/959-nodejs-selector/>
- Let's Encrypt via painel DirectAdmin (evidência do mecanismo; **não é fonte TineHost** — a
  prova concreta é o Workspace já publicado em HTTPS no mesmo provedor):
  <https://www.homehost.com.br/blog/tutoriais/seguranca/instalar-certificado-ssl-lets-encrypt-directadmin/>

## fora_de_escopo

Herdado do briefing e do corte do Diretor, consolidado:

- Voz e wake word (Fase 5). Notificação push nativa. Automação de navegador.
- Deploy automatizado por CI/CD — a TineHost não tem runner (sem `sudo`/`docker`/
  `systemctl`). A publicação é manual pelo painel DirectAdmin. **E o build do instalador
  Windows também é manual**, na máquina do dono — não é só a publicação.
- Migração para VPS novo. A URL do servidor fica configurável para que mudar de casa não
  vire reescrita.
- Streaming da resposta token a token. Um indicador de "pensando" cobre a percepção.
- Histórico de conversa persistido no servidor. A conversa vive na memória do cliente e some
  ao recarregar. Guardar conversa de clínica é decisão de retenção e LGPD, e merece a
  própria fase.
- Renderização rica (markdown, tabela, destaque de código). Quebra de linha basta.
- Recuperação de senha por e-mail — duas contas conhecidas, o dono redefine na mão, e o
  fluxo de recuperação é superfície de ataque nova.
- 2FA, rate limit sofisticado por janela deslizante, tela de administração de usuários,
  atualização automática do app Tauri, service worker com offline de verdade.
- Assinatura de código do instalador Windows — ver a decisão 6 abaixo.
- Testes E2E com Playwright contra a TineHost real: caro, frágil, e bate em produção com
  dado de clínica. A verificação é manual e documentada, no padrão
  `scripts/verificacao-fase-0X.ts`.
- Tema escuro, i18n, busca no histórico, exportar conversa, avatar, onboarding guiado,
  painel de métricas, sino/som/badge, animação além do mínimo.
- Abstração de "provedor de auth plugável", "camada de tema configurável", "suporte a N
  usuários parametrizado", invólucro para macOS/iOS. Um único uso, hoje e no horizonte.
- **Endpoint de SSO no Workspace** — vira ticket novo, fora desta fase, sem bloquear nada
  (decisão 1).

## contradicoes_resolvidas

### 1. Autenticação: reaproveitar o login do Workspace ou construir o próprio?

**As lentes divergiram.** O briefing recomendava reaproveitar o Workspace. O **Diretor**
apoiou ("criar senha própria é criar um segundo lugar onde a senha da clínica pode vazar"),
mas amarrou a recomendação a uma ressalva explícita: *só vale se o Arquiteto disser que o
caminho existe hoje*. O **Arquiteto** foi ver e derrubou: o mecanismo de identidade real
existe e é bom (`auth.service.ts` com Argon2id, freios, sessão em Postgres), mas **não há
ponte HTTP entre "estar logado no Workspace" e "a Cora recebe um token de delegação para
essa pessoa"** — a única emissão existente é um comando de operador com acesso ao banco
(`pnpm agente delegar`, `docs/OPERATIONS.md:174`), não uma rota alcançável por sessão de
navegador. E o cookie `sid` é `sameSite: "lax"` amarrado ao domínio do Workspace: não chega
num subdomínio da Cora, e a sessão só existe no banco do Workspace, que `cora-med` não pode
consultar por regra deste repositório. O **Pesquisador**, cego aos dois, cobriu os dois
caminhos e trouxe o dado que fecha a conta: Lucia está morta desde março/2025, e para dois
usuários nomeados **não usar biblioteca nenhuma** (argon2 + cookie de sessão assinado) é
mais defensável que instalar um framework de auth com OAuth, organizações e RBAC que
ninguém vai usar.

**Decidido: login próprio mínimo dentro de `apps/server` nesta fase.** Argon2 para a senha,
sessão opaca em cookie `httpOnly`/`Secure`/`SameSite=Lax`, sem biblioteca de auth, seguindo
a convenção de teste sem rede do repositório.

**Motivo, em três partes:** (a) reaproveitar de verdade exige **um endpoint novo no
Workspace**, e este repositório não pode editar `workspace-medconsultoria` — vira ticket, e
o CORA-005 está aberto há dias sem resposta; (b) uma fase inteira não pode ficar bloqueada
esperando outro time implementar e revisar código de terceiros, ainda mais quando o
histórico de latência desse canal já é conhecido; (c) são **dois** usuários nomeados —
o "banco de senha novo e paralelo" que o briefing temia é, na prática, duas linhas numa
tabela e um hash, não um sistema de contas. O argumento do Diretor ("um segundo lugar onde a
senha pode vazar") é real e fica registrado como o custo aceito desta decisão; o que o
neutraliza é o escopo: sem cadastro, sem recuperação por e-mail, sem tela de administração,
senha digitada dentro do servidor.

**Consequência a executar:** abrir um **ticket separado** em `med-coordination/tickets/`
perguntando ao Workspace se um endpoint de emissão de `delegationToken` a partir de sessão
autenticada (SSO) faz sentido no futuro. Esse ticket **não bloqueia nada nesta fase** e sua
resposta, se vier, substitui só a camada de login — a fronteira já está no lugar certo,
porque a chamada ao Workspace continua sendo por `delegationToken`, exatamente como hoje.

### 2. O token de delegação estático contradiz "dois usuários"

O Arquiteto mostrou que `WORKSPACE_DELEGATION_TOKEN` é um valor único por processo
(`main.ts:59,70-75`); o Diretor pôs no balde 1 "identidade do usuário chegando até a chamada
ao Workspace", chamando de correção e não de recurso. **O Diretor ganha, e o achado do
Arquiteto diz o tamanho do trabalho.** Sem isso, Thaís e o dono veriam a mesma caixa de
tarefas e o isolamento provado na Fase 1 morreria na primeira tela — login real sem
identidade propagada seria teatro. Decidido: **um token de delegação por conta nomeada**,
provisionado por variável de ambiente própria e escolhido pela sessão. Não é um sistema de
emissão; é uma tabela de dois.

### 3. Tela web: React ou Preact?

O Pesquisador deixou em aberto (Preact é ~3 kB e favorece o primeiro carregamento em rede
móvel, que é justamente o cenário da Thaís) e o Arquiteto confirmou terreno limpo — não há
front-end nenhum no repositório, então não há padrão a respeitar. **Decidido: Vite +
React.** Motivo: o dono é o único mantenedor e o Workspace, que ele já mantém, é React — um
segundo dialeto na mesma cabeça custa mais do que os kilobytes economizados numa SPA que é
uma lista de mensagens e um campo de texto. O ganho do Preact é real mas pequeno nesta
escala; o custo de divergir do que o mantenedor já conhece é permanente. **Fica descartado
explicitamente:** Next.js completo com SSR — duplicaria a camada de servidor sobre um
backend que já existe.

### 4. "Conexão ruim derruba a mensagem" (Analista) contra o corte de histórico (Diretor)

O Analista nomeou um fracasso real com usuária nomeada: Thaís em campo, manda a pergunta e
não sabe se foi. O Diretor cortou histórico persistido e streaming. **As duas coisas
sobrevivem, porque são pedidos diferentes.** O corte do histórico vence — o Analista não
nomeou ninguém que sofra por perder a conversa ao recarregar, e guardar conversa de clínica
é decisão de LGPD. Mas "mensagem sumir em silêncio" não é histórico: é o **estado de erro**
que já está no balde 1 do Diretor. Decidido: envio que falha aparece como falha, com opção
de reenviar, e o rascunho não digitado de novo. Custo: alguns estados a mais na tela, zero
persistência no servidor.

### 5. "Thaís e o dono veem o mesmo resumo?" (dúvida do Analista) — resolvida sem subir

O Analista subiu isso como dúvida para o dono. **Não sobe:** a decisão 2 já responde. Cada
um passa a falar com o Workspace com a própria identidade delegada, então cada um vê o que a
própria conta no Workspace autoriza — que é o comportamento correto e o que a Fase 1 já
provou. **Nenhum recorte de papel adicional é construído nesta fase** (nada de "financeiro
só para o dono"): isso seria controle de acesso novo, inventado sem pedido, e cai na
proibição de flexibilidade especulativa. Se o dono quiser recorte por papel depois, é
decisão de produto numa fase própria.

### 6. Assinatura de código do instalador Windows (dúvida do Diretor) — resolvida sem subir

O Diretor marcou como dúvida por envolver dinheiro; o Pesquisador confirmou que o WebView2
já vem de fábrica no Windows 10 (1803+) e 11, então o único atrito é o aviso do SmartScreen.
**Decidido: não comprar certificado agora.** Não gastar dinheiro é o padrão conservador e
não precisa de aval — o que precisaria de aval seria gastar. São dois usuários conhecidos
que recebem o instalador da mão do dono. **Contrapartida obrigatória**, e aqui o Analista
tem razão: o instalador não pode chegar sem acompanhamento. A documentação da fase diz, com
todas as letras, o que vai aparecer na tela ("Windows protegeu o computador" → Mais
informações → Executar assim mesmo) — instalador sem esse aviso é o mesmo erro que a regra
global proíbe para comando de terminal.

### 7. Guardar a conversa no servidor (dúvida do Diretor) — resolvida sem subir

**Decidido: não guardar nada no servidor nesta fase.** O default conservador com dado de
clínica não precisa de aval; o que precisaria de aval é passar a guardar. Já está em
`fora_de_escopo`, e a fase que quiser guardar começa pela decisão de retenção, não pelo
código.

### 8. CORS restrito (Diretor) contra "tela e API na mesma origem" (Pesquisador/Arquiteto)

Aparente contradição, resolvida por uma decisão de arquitetura que serve às três lentes: o
`apps/server` serve a SPA **na mesma origem** da API. Nesse desenho não existe requisição
cross-origin do navegador para a API, e o cookie `SameSite=Lax` — recomendado justamente
para cliente e API sob o mesmo domínio — passa a ser viável. O requisito do Diretor
sobrevive invertido e mais forte: **negar por padrão**. `hostsPermitidos`
(`server.ts:34-37`) ganha só o subdomínio de produção, e nenhuma origem externa é
adicionada. A ressalva de CSRF do Pesquisador continua valendo e entra explicitamente no
roteiro da revisão de segurança obrigatória: `SameSite=Lax` cobre a maior parte, e o que
não cobrir se resolve com verificação de origem no POST, não com biblioteca.

### 9. Persona genérica na primeira tela (Analista) contra "tela pronta" (plano de voo)

Não é contradição entre lentes, é um alerta do Analista que fica registrado para ninguém
prometer o que a fase não entrega: a entrevista com a Thaís está pendente, então a tela
nasce com a persona de hoje e vai soar genérica. **"Tela pronta" e "tela com a voz certa da
Cora" são entregas diferentes**; esta fase entrega a primeira. Ajuste de tom depois não é
retrabalho estrutural.

## duvidas_para_o_dono

nenhuma.

As quatro lentes subiram cinco dúvidas; todas foram resolvidas acima (decisões 1, 5, 6, 7) ou
já estavam respondidas no briefing (push nativo, que o próprio `fora_de_escopo` declara).

Duas coisas exigem a mão do dono **durante a execução**, e são passos operacionais, não
perguntas em aberto: criar o subdomínio e emitir o certificado Let's Encrypt no painel
DirectAdmin (recomendação de nome: `cora.medconsultoria.com.br`, com a URL configurável em
todo lugar, então trocar depois não custa nada), e digitar as senhas iniciais das duas
contas dentro do servidor — por regra, senha de produção nunca passa por chat, repositório,
memória ou commit.
