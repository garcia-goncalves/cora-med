# Plano de execução — Fase 4: acesso Windows e PWA Android

Fonte de escopo, já aprovada e **não reaberta aqui**:
`docs/esteira/fase-4-acesso-windows-e-pwa-android/briefing.md`, `.../spec.md`, `.../design.md`
e `.../lentes/arquiteto.md`.

Base: `main` em `7655aad8c31aa04100bfbb09b4238a98d47a7c01` (árvore limpa).
Índice do grafo de código: `ready`, mesmo HEAD — conferido nesta sessão.

Cada etapa abaixo roda em **worktree isolada**, uma por vez, sem push e sem tocar `main`.
O executor não vê esta conversa: tudo que ele precisa está dentro da etapa.

---

## Contexto verificado (lido no disco, não presumido)

**Estado da suíte, medido agora:** `pnpm run test` devolve `Test Files 23 passed (23)` e
`Tests 354 passed (354)`, em cerca de 6s. `pnpm run typecheck` não imprime nada quando passa.
(`docs/OPERATIONS.md:14` ainda diz "282 testes" — desatualizado; corrigir na Etapa 20.)
Node medido: v20.19.5. pnpm: 10.19.0.

**Servidor HTTP (o que a fase muda):**

- `apps/server/src/http/server.ts:15-35` — `DependenciasHttp` tem hoje **um** `registry` único
  por processo e `criarMotor`, mais `now`, `gerarRunId`, `registrar`, `hostsPermitidos`.
  A delegação por conta (spec, decisão 2) obriga o `registry` a virar função de conta, não
  valor fixo.
- `apps/server/src/http/server.ts:37` — `HOSTS_PERMITIDOS_PADRAO` traz 127.0.0.1, localhost e
  as duas formas de ::1.
- `apps/server/src/http/server.ts:39-43` — `enviar()` escreve o corpo inteiro de uma vez e fixa
  `Content-Type: application/json`. Servir arquivo estático **não** passa por essa função.
- `apps/server/src/http/server.ts:183-213` — `handleRequest` checa Host, roteia `/health` e
  `/turno`, e senão devolve `rota_desconhecida`. É o ponto de enxerto de `/auth/*` e da SPA.
- `apps/server/src/http/erros.ts:12-66` — `CategoriaDeErro` é união fechada com **três**
  tabelas exaustivas (status, mensagem e a própria união). Categoria nova exige editar as três;
  o compilador reprova se esquecer uma.
- `apps/server/src/http/contrato.ts:20-32` — `PedidoDeTurnoSchema` é `.strict()` em todo nível
  e hoje **exige** `requester.requesterUserId` no corpo.
- `apps/server/src/http/main.ts:56-59` — `exigir()` sai com código 2 nomeando a variável
  faltante; a variável de delegação é lida **uma vez, por processo** (linha 59).
- `apps/server/src/http/main.ts:82` — o `listen` amarra em 127.0.0.1, com o comentário das
  linhas 80-81 explicando que é porque não há autenticação de usuário humano.
- `apps/server/src/http/boot.ts:18-24` — `montarRegistry(client, armazem)` cria uma
  `FilaDeEntrada` nova por registro (estado em memória de processo, não singleton). É isso que
  torna "um registry por conta" barato e correto: cada conta ganha a própria fila.
- `packages/workspace-client/src/client.ts:27-78` — o token de delegação é **opção de
  construtor**. Um cliente por conta é a mudança inteira; nenhuma assinatura do cliente muda.

**Monorepo e configuração de raiz (o que quebra se ninguém olhar):**

- `tsconfig.json:24` — o `include` cobre `packages/**/*.ts`, `apps/**/*.ts`, `scripts/**/*.ts`
  e `vitest.config.ts`. Criar `apps/web` sem excluir a pasta faz o `typecheck` da raiz tentar
  compilar o `vite.config.ts` **sem lib DOM** (a `lib` é só ES2023) e reprovar.
- `tsconfig.json` usa `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` e
  `exactOptionalPropertyTypes: false`. Importação só-de-tipo precisa de `import type`.
- `vitest.config.ts` — `include` de `packages/**/*.test.ts` e `apps/**/*.test.ts`, ambiente
  `node`, aliases para os três pacotes. Teste co-localizado é descoberto sozinho.
  **Não há jsdom no repositório** e esta fase não instala nenhum: lógica de tela testável nasce
  em `.ts` puro; `.tsx` é verificado por build mais roteiro manual.
- `pnpm-workspace.yaml` — `packages/*` e `apps/*`. `apps/web` e `apps/desktop` entram sem
  nenhum orquestrador (não há turbo, nx nem lerna).
- **Nenhum pacote tem script `build` hoje.** `apps/server/package.json` tem só o `dev` com
  `tsx`. A premissa do pedido ("cada pacote precisa buildar de verdade") **não se confirma para
  o servidor**: esse build não existe e nasce na Etapa 2 — e sem ele não há o que publicar na
  TineHost.
- `.github/workflows/ci.yml` — job único `verify`: install com `--frozen-lockfile`, `typecheck`
  e `test`. Sem segredo, `permissions: contents: read`, `paths-ignore` de `.md` e `docs/**` no
  push, `concurrency` com `cancel-in-progress`.

**Design e assets:**

- Os 8 SVGs existem em `docs/esteira/fase-4-acesso-windows-e-pwa-android/design/assets/`
  (`favicon.svg`, `icon-any.svg`, `icon-maskable.svg`, `icon-windows-source.svg`,
  `wordmark-lockup.svg`, `wordmark-only.svg`, `ilustracao-vazio.svg`,
  `ilustracao-erro-conexao.svg`) mais o `CREDITOS.md`. **Nenhum PNG existe** — os quatro PNGs
  do manifest são trabalho de build (Etapa 17).
- `.../design/preview.html` e `.../design/textos.md` existem e servem de conferência visual.
- O Workspace usa `@node-rs/argon2` `^2.0.2`
  (`workspace-medconsultoria/apps/api/package.json:30`) — a mesma família de algoritmo que a
  spec manda copiar como decisão, não como código.

**Toolchain ausente nesta máquina (medido agora):** `cargo` e `rustc` respondem
`command not found`. O `tauri build` **não roda aqui**; a Etapa 18 foi escrita sabendo disso.

### Premissas do pedido que NÃO se confirmaram

1. **"Cada pacote precisa buildar (`pnpm run build` em cada um)"** — nenhum pacote tem build
   hoje, nem o `apps/server`. Isso vira a Etapa 2, e ela é pré-requisito real da publicação:
   o Node.js Selector do DirectAdmin roda um arquivo de inicialização com `node`, não com `tsx`.
2. **"As 6 telas do design.md"** — a tela 5 (aviso do SmartScreen) **não é tela de software**:
   o próprio `design.md` diz que é página ou papel entregue junto do instalador, conteúdo
   estático, um único estado. São **5 telas** em `apps/web` mais **1 documento** entregue com o
   instalador (Etapa 18).
3. **Contradição dentro do próprio `design.md`, que o executor vai encontrar e precisa saber
   resolver:** a seção `estrategia_de_aquisicao` (herdada do painel adversarial descartado) fala
   em "Direção A", em azul-petróleo `oklch(0.38 0.085 255)` e em "Inter é a única família"; as
   seções `tokens` e `direcao_visual_escolhida` (as que o dono aprovou) dizem **Montserrat** e
   `--color-primary: oklch(0.367 0.160 261)`, o `#003591` da marca real. **Fonte de verdade: o
   bloco `tokens` e a seção `direcao_visual_escolhida`.** Da `estrategia_de_aquisicao` valem só
   as decisões operacionais (robots, manifest, Open Graph, metas de desempenho), nunca as cores
   e a fonte citadas lá.
4. **A mesma contradição está gravada nos assets:** `wordmark-lockup.svg` e `wordmark-only.svg`
   declaram `font-family="Inter, system-ui, ..."`. Ao inserir inline em `apps/web`, troque por
   `var(--font-sans)` (Montserrat) e registre a troca no `CREDITOS.md`. Não é redesenho, é um
   atributo.
5. **"Login próprio já decidido"** — confirmado no `spec.md`, decisão 1, e a lente do Arquiteto
   confirma no código do Workspace que não existe ponte HTTP entre sessão de navegador e emissão
   de token de delegação. Nada a reabrir; o ticket de SSO é a Etapa 21 e não bloqueia nada.

---

## Decisões de arquitetura que este plano fixa

Existem para que duas leituras não gerem duas execuções diferentes.

**D1 — O corpo do `POST /turno` perde o `requester`.** Depois da Etapa 10 o corpo é
`{ mensagem, deviceId }`, `.strict()`, e o `requesterUserId` passa a vir da sessão. Motivo: o
próprio `contrato.ts:4-11` já estabelece que campo de identidade mandado pelo cliente é recusa
ALTA (422), não silêncio. **Alternativa descartada:** aceitar `requester` e ignorar — é
exatamente o que aquele arquivo proíbe.

**D2 — Um `ToolRegistry` (e um `WorkspaceClient`) por conta nomeada, montado no boot.** São duas
contas conhecidas: `montarRegistryPorConta()` devolve um `Map` de id da conta para `ToolRegistry`,
cada um com seu cliente e sua `FilaDeEntrada`. O campo `registry` de `DependenciasHttp` vira
`registryDaConta(idDaConta)`. **Não** é fábrica por requisição: a fila de entrada precisa
sobreviver entre turnos da mesma pessoa, como hoje sobrevive no processo.

**D3 — Sessão em memória de processo, token opaco de 32 bytes aleatórios.** Sem banco: não há
banco no repositório e a spec não pede um. Reiniciar o servidor derruba as sessões e as duas
pessoas entram de novo — custo aceito, e que a documentação precisa dizer. Comparação de token em
tempo constante (`timingSafeEqual`) e expiração por `now()` injetável.

**D4 — O `Secure` do cookie é o padrão e só cai por variável explícita.** `CORA_COOKIE_INSEGURO=1`
— nome que denuncia o que faz — permite desenvolvimento em `http://localhost`. Variável ausente
significa `Secure` ligado. Nunca o contrário.

**D5 — Em desenvolvimento, a mesma origem é preservada por proxy do Vite** (`server.proxy` de
`/auth` e `/turno` para `http://127.0.0.1:4320`). Não existe CORS em lugar nenhum desta fase, nem
em desenvolvimento — é o que a decisão 8 do `spec.md` manda.

**D6 — Hash de senha atrás de uma porta injetável** (`PortaDeHashDeSenha`, com `gerar` e
`conferir`). Implementação padrão: `@node-rs/argon2`, o mesmo do Workspace, binário
pré-compilado, sem compilador. A porta existe por dois motivos: a convenção de teste do
repositório exige injeção, e se o Node.js Selector da TineHost recusar o binário nativo, trocar
por uma implementação WASM vira mudança de **um arquivo**, não da fase.

---

## Riscos

1. **`@node-rs/argon2` é binário nativo e a TineHost é hospedagem compartilhada** (CloudLinux
   Node.js Selector). Se a instalação de lá não trouxer o binário `linux-x64-gnu`, o login não
   sobe em produção. Mitigação: a porta injetável de D6, mais a ordem da Etapa 20 de **testar o
   hash dentro do servidor antes de publicar a aplicação inteira**. Plano B nomeado:
   implementação argon2id em WASM, trocando só `apps/server/src/auth/senha.ts`.
2. **Rust e MSVC não existem nesta máquina.** A Etapa 18 entrega configuração, ícones e
   documentação verificáveis; o `tauri build` fica marcado como passo manual na máquina do dono,
   com os pré-requisitos escritos. Ninguém deve declarar "instalador pronto" sem o arquivo
   `.msi`/`.exe` na mão.
3. **A geração dos PNGs do manifest depende do `sharp`** (instalado na Etapa 1). Se o binário
   falhar no Windows, o contorno é gerar os PNGs uma vez com o CLI do Tauri e commitar os
   arquivos. Os PNGs são **commitados** de propósito: o build de CI nunca pode depender de
   rasterizador.
4. **O `pnpm-lock.yaml` é o maior ponto de colisão entre worktrees.** Só a Etapa 1 instala
   dependência nova. Qualquer etapa que descobrir que precisa de um pacote novo deve **parar e
   reportar**, nunca instalar por conta própria.
5. **Três etapas editam `server.ts` em sequência (9, 10 e 11).** São sequenciais de propósito;
   rodar duas em paralelo garante conflito. A ordem não é negociável.
6. **Senha real nunca entra em arquivo, teste, log ou commit.** As duas senhas são digitadas
   dentro do servidor pelo dono (regra 0.8 do CLAUDE.md global); o repositório guarda só o
   **hash**, e só no ambiente do servidor, nunca versionado. Toda fixture usa o prefixo `SYNTH-`.
7. **Publicar não faz parte desta fase.** Nenhuma etapa roda `ssh`, `scp`, `rsync` ou aciona
   workflow apontado para servidor. A Etapa 20 escreve o roteiro; executá-lo é outra sessão, com
   o sim do dono.

---

## Etapas

### Etapa 1 — Fundação: os dois pacotes novos nascem e o monorepo continua verde

**Objetivo:** `apps/web` e `apps/desktop` passam a existir como pacotes-irmãos de `apps/server`,
todas as dependências novas da fase entram numa instalação só, e `pnpm run test` e
`pnpm run typecheck` da raiz continuam passando.

**Arquivos:** `pnpm-lock.yaml`; `package.json` (raiz); `tsconfig.json` (raiz);
`.github/workflows/ci.yml`; `apps/server/package.json` (só acrescentar dependência);
`apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/tsconfig.node.json`,
`apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`,
`apps/web/src/App.tsx`, `apps/web/src/estilos/tokens.css`,
`apps/web/src/estilos/tokens.test.ts`, `apps/web/public/robots.txt`;
`apps/desktop/package.json`.

**Contexto:**

- O `tsconfig.json` da raiz inclui `apps/**/*.ts` e tem `lib` só de ES2023 (sem DOM). Acrescente
  `apps/web` e `apps/desktop` ao `exclude` — sem isso o typecheck da raiz tenta compilar o
  `vite.config.ts` e reprova.
- `apps/web/tsconfig.json` é próprio: `jsx: react-jsx`, `lib` com ES2023, DOM e DOM.Iterable,
  `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `moduleResolution: Bundler`,
  `noEmit`. O pacote ganha o script `typecheck` apontando para esse arquivo.
- O script `typecheck` da raiz passa a ser o `tsc` de hoje seguido de
  `pnpm --filter @cora/web run typecheck` — assim uma ordem só continua cobrindo o repositório
  inteiro e a CI não precisa aprender dois comandos.
- O `vitest.config.ts` da raiz **não muda**: arquivos `apps/web/**/*.test.ts` (`.ts` puro, node,
  sem DOM) são descobertos por ele de propósito. Nada em `.tsx` recebe teste unitário nesta fase.
- Dependências a instalar, todas nesta etapa e em lugar nenhum mais:
  - `apps/server`: `@node-rs/argon2` na mesma faixa de versão do Workspace (`^2.0.2`) e, em dev,
    `esbuild`.
  - `apps/web`: `react`, `react-dom`, `@fontsource/montserrat` (fonte auto-hospedada — **não**
    use o `<link>` do Google Fonts que a `preview.html` usa; o `design.md` explica por quê); em
    dev, `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `sharp`.
  - `apps/desktop`: em dev, `@tauri-apps/cli` v2.
- Nomes dos pacotes: `@cora/web` e `@cora/desktop`, ambos `private: true` e `type: module`.
- `apps/web/vite.config.ts`: plugin de React, `build.outDir` igual a `dist`, `base` igual a `/`,
  e `server.proxy` mandando `/auth` e `/turno` para `http://127.0.0.1:4320` (decisão D5).
- `apps/web/index.html`: `lang="pt-BR"`, título `Cora — MedConsultoria`, a meta de robots com
  `noindex, nofollow, noarchive, nosnippet`, o bloco Open Graph literal do `design.md` (seção
  `estrategia_de_aquisicao`, item 4), a meta de viewport e `theme-color` `#003591`. **Sem**
  `sitemap.xml` e **sem** `canonical`.
- `apps/web/public/robots.txt`: exatamente `User-agent: *` e `Disallow: /`.
- `apps/web/src/estilos/tokens.css` recebe o bloco CSS da seção `tokens` do `design.md`
  **copiado literalmente**, inclusive comentários e o bloco de tema escuro. O `main.tsx` importa
  esse CSS e os pesos 400, 500, 600 e 700 do `@fontsource/montserrat`. O `App.tsx` desta etapa é
  um esqueleto que renderiza só o nome Cora — as telas chegam nas Etapas 14 a 16.
- `tokens.test.ts` é o que torna "literal" verificável: lê o `design.md` com `node:fs`, extrai o
  primeiro bloco de código CSS, lê o `tokens.css` e compara os dois normalizando fim de linha e
  espaço em branco à direita. Falhou significa que alguém editou token sem passar pelo design.
- `.github/workflows/ci.yml`: acrescentar, **depois** do passo de teste, um passo
  `pnpm --filter @cora/web run build`. Nada de e2e, nada de empacotamento Windows, nenhum
  segredo, nenhum gatilho novo — `paths-ignore`, `concurrency` e `permissions` ficam como estão.

**Verificação:**

```
pnpm install
pnpm run typecheck
pnpm run test
pnpm --filter @cora/web run build
```

Esperado: instalação sem erro; typecheck silencioso; `Test Files 24 passed (24)` e
`Tests 355 passed (355)` (os 354 de hoje mais o teste de tokens); o build imprime o resumo do
Vite e cria `apps/web/dist/index.html` e `apps/web/dist/assets/`. Confirme ainda que a meta de
robots sobreviveu ao build, lendo `apps/web/dist/index.html` e procurando por `noindex`.

**Depende de:** nenhuma.

---

### Etapa 2 — Build de produção do `apps/server` (o que a TineHost vai rodar)

**Objetivo:** existe um arquivo único de inicialização em JavaScript que o Node.js Selector do
DirectAdmin consegue executar, sem `tsx` e sem TypeScript em produção.

**Arquivos:** `apps/server/build.mjs`; `apps/server/package.json` (só o campo `scripts`);
`apps/server/.gitignore` (ignorar `dist/`).

**Contexto:**

- Hoje `apps/server/package.json` só tem o `dev` com `tsx`. O alvo é um script `build` que roda
  `node build.mjs` e produz `apps/server/dist/servidor.mjs`.
- O `build.mjs` usa a API do `esbuild` (instalado na Etapa 1): ponto de entrada
  `src/http/main.ts`, `bundle: true`, `platform: node`, `target: node20`, `format: esm`,
  saída `dist/servidor.mjs`, sem sourcemap.
- **A lista de `external` é obrigatória e é o detalhe que faz ou quebra o deploy:**
  `@node-rs/argon2` (binário nativo, não pode ser embutido) e `@anthropic-ai/sdk`. Os pacotes
  internos (`@cora/contracts`, `@cora/policy`, `@cora/workspace-client`) **entram no bundle** —
  são código-fonte do próprio repositório e não existem como pacote publicado.
- O bundle preserva o comportamento de `main.ts`: sem variável de ambiente, ele imprime a
  variável faltante e sai com código 2 (`main.ts:21-28`). É exatamente isso que a verificação usa.
- Não mude nenhuma linha de `src/` nesta etapa.

**Verificação:**

```
pnpm --filter @cora/server run build
node apps/server/dist/servidor.mjs ; echo "codigo=$?"
```

Esperado: o build cria `apps/server/dist/servidor.mjs`; a execução imprime
`Falta a variável WORKSPACE_BASE_URL. Veja a lista completa em docs/OPERATIONS.md.` e
`codigo=2`. Em seguida, `pnpm run typecheck` e `pnpm run test` da raiz continuam idênticos à
Etapa 1.

**Depende de:** Etapa 1 (o `esbuild` é instalado lá, e o `package.json` do servidor já é mexido lá).

---

### Etapa 3 — Contrato de sessão em `packages/contracts`

**Objetivo:** servidor e tela compartilham um único formato de pedido de entrada e de descrição
de sessão, em vez de duplicar schema em `apps/web`.

**Arquivos:** `packages/contracts/src/cora/auth.ts`; `packages/contracts/src/cora/auth.test.ts`;
`packages/contracts/src/index.ts` (uma linha de `export *`).

**Contexto:**

- `packages/contracts/src/index.ts` tem seis linhas de `export *`; `src/cora/execution.ts` e
  `src/cora/inbox.ts` são o molde de "protocolo interno da Cora".
- Definir com Zod, tudo `.strict()`:
  - `PedidoDeEntradaSchema`: e-mail validado com teto de tamanho, senha não vazia com teto de
    tamanho.
  - `SessaoDoUsuarioSchema`: id da conta, nome e e-mail — **o que a tela pode saber**. Nunca
    inclui token de delegação, hash ou qualquer segredo.
  - `RespostaDeEntradaSchema`: envelope com a sessão.
  - A união fechada de motivos de recusa: `credenciais_invalidas` e `bloqueado_por_tentativas`.
    Nada mais. A tela nunca aprende se o e-mail existe — o `design.md` fixa que o erro não diz
    qual campo errou.
  - Tetos de tamanho exportados como constante, no molde de `MAX_CHARS_MENSAGEM`.
- Teste: recusa campo extra; recusa e-mail malformado; recusa senha vazia; aceita o caso feliz;
  e o conjunto de motivos de recusa tem exatamente dois elementos distintos.

**Verificação:** `pnpm run test` da raiz passa com os testes novos e `pnpm run typecheck` fica
silencioso. Confirme a disciplina de segredo procurando por `delegation` e `hash` dentro de
`packages/contracts/src/cora/auth.ts` — não pode haver ocorrência.

**Depende de:** Etapa 1.

---

### Etapa 4 — Hash argon2id atrás de uma porta injetável, e a ferramenta de gerar hash

**Objetivo:** o servidor sabe conferir uma senha contra um hash argon2id, e o dono tem um comando
para gerar o hash **sem a senha aparecer em lugar nenhum**.

**Arquivos:** `apps/server/src/auth/senha.ts`; `apps/server/src/auth/senha.test.ts`;
`scripts/hash-senha.ts`.

**Contexto:**

- O `@node-rs/argon2` já está instalado (Etapa 1). Exporte:
  - `PortaDeHashDeSenha`, interface com `gerar(senha)` e `conferir(hash, senha)`, ambos
    assíncronos.
  - `criarHashArgon2id()`, a implementação real, com os parâmetros de custo explícitos no código
    e um comentário dizendo de onde vieram.
  - Uma função de conferência que **gasta o mesmo tempo quando a conta não existe**, conferindo
    contra um hash-isca. É o que o `auth.service.ts` do Workspace faz, e a spec manda copiar a
    decisão, não o código.
- Testes (sem rede; o argon2 é local): hash gerado confere com a senha certa; recusa a senha
  errada; dois hashes da mesma senha são diferentes (sal aleatório); hash malformado devolve
  falso em vez de explodir. Toda senha de teste usa o prefixo `SYNTH-`.
- `scripts/hash-senha.ts`: lê a senha de **stdin** — nunca de argumento de linha de comando, que
  ficaria no histórico do shell —, não ecoa nada e imprime só a string do hash. Cabeçalho no
  molde de `scripts/verificacao-fase-02.ts`, explicando que ele roda **dentro do servidor**.

**Verificação:**

```
pnpm run test
printf SYNTH-senha-de-teste | pnpm exec tsx scripts/hash-senha.ts
```

Esperado: os testes novos passam; o comando imprime uma única linha começando com `$argon2id$`,
e a senha não aparece na saída.

**Depende de:** Etapa 1.

---

### Etapa 5 — Sessão opaca e cookie httpOnly/Secure/SameSite=Lax

**Objetivo:** existe um armazém de sessões testável — criar, validar, expirar, encerrar — e a
serialização de cookie correta, com relógio injetável.

**Arquivos:** `apps/server/src/auth/sessao.ts`; `apps/server/src/auth/sessao.test.ts`;
`apps/server/src/auth/cookie.ts`; `apps/server/src/auth/cookie.test.ts`.

**Contexto:**

- Molde de relógio injetável já existente: `criarServidorHttp` aceita `now`
  (`apps/server/src/http/server.ts:21`), e o padrão de expiração testado está descrito em
  `docs/SECURITY.md:32-52` — "aprovação expirada" e "expiração exatamente agora" são dois testes
  distintos lá; repita os dois aqui.
- `sessao.ts`: classe `ArmazemDeSessoes` com `criar(idDaConta)`, `validar(token)` e
  `encerrar(token)`, e construtor recebendo `now`, TTL e gerador de token, todos opcionais.
  Token padrão: 32 bytes de `randomBytes` em base64url, de `node:crypto`. Comparação em tempo
  constante com `timingSafeEqual`, tratando tamanhos diferentes como recusa antes de comparar.
  Estado em `Map`, memória de processo (decisão D3), no mesmo espírito de
  `apps/server/src/run/turn.ts:61-62`.
- `validar` devolve união discriminada, no molde de `apps/server/src/run/idempotency.ts:39-51`:
  válida (com a sessão), expirada, inexistente. **Expirada e inexistente são estados diferentes e
  nunca se fundem** — a tela mostra frases diferentes para cada um.
- `cookie.ts`: `serializarCookieDeSessao(token, opcoes)` produz `HttpOnly`, `SameSite=Lax`,
  `Path=/`, `Max-Age` coerente com o TTL, e `Secure` presente salvo quando a opção disser
  explicitamente o contrário (decisão D4). `serializarCookieDeSaida()` produz o mesmo cookie com
  valor vazio e `Max-Age=0`. `lerCookie(cabecalho, nome)` é um parser tolerante que não explode
  com cabeçalho ausente, vazio ou malformado.
- Testes obrigatórios: válida logo após criar; expirada um milissegundo depois do TTL; o caso de
  **expirar exatamente no instante do TTL** (decida a fronteira e documente no código); token
  inexistente; token adulterado de mesmo tamanho; `encerrar` invalida na hora; o cookie
  serializado contém os três atributos por padrão e perde só o `Secure` quando pedido; o parser
  devolve indefinido para cabeçalho ausente.

**Verificação:**

```
pnpm run test
pnpm run typecheck
```

Esperado: os testes novos passam, nenhum existente quebra, typecheck silencioso. Rodando só
`pnpm exec vitest run apps/server/src/auth/cookie.test.ts`, a lista de casos deve conter
"cookie de sessão sai com HttpOnly, Secure e SameSite=Lax".

**Depende de:** Etapa 1.

---

### Etapa 6 — Freio de tentativas de entrada

**Objetivo:** força bruta contra as duas contas é freada, sem biblioteca e sem janela deslizante
sofisticada (que a spec põe fora de escopo).

**Arquivos:** `apps/server/src/auth/freio.ts`; `apps/server/src/auth/freio.test.ts`.

**Contexto:**

- Dois contadores independentes, como o Workspace faz (`auth.service.ts`, leitura de referência
  citada na spec): um por IP mais e-mail, outro por IP sozinho. Limites e janela em constantes
  exportadas e comentadas, não espalhados pelo código.
- Classe `FreioDeTentativas` com `registrarFalha(chave)`, `estaBloqueado(chave)` e
  `limpar(chave)` — a última chamada no login bem-sucedido —, e construtor aceitando `now`
  injetável.
- Estado em `Map`, memória de processo. Não precisa de limpeza agendada: a janela é verificada na
  leitura. Registre em comentário que o `Map` é limitado na prática por haver duas contas.
- Testes: uma falha a menos que o limite ainda deixa entrar; a falha que atinge o limite bloqueia;
  passada a janela, desbloqueia; sucesso limpa o contador; o bloqueio por IP puro acontece mesmo
  variando o e-mail.

**Verificação:** `pnpm run test` passa com os casos acima e `pnpm run typecheck` fica silencioso.

**Depende de:** Etapa 1.

---

### Etapa 7 — As duas contas nomeadas, lidas do ambiente

**Objetivo:** o servidor conhece exatamente duas contas, cada uma com seu hash de senha e seu
token de delegação próprio, e recusa subir se a configuração estiver pela metade.

**Arquivos:** `apps/server/src/auth/contas.ts`; `apps/server/src/auth/contas.test.ts`.

**Contexto:**

- `carregarContas(env)` **recebe o ambiente por parâmetro** — é o que torna o teste possível sem
  mexer no `process.env` global.
- Formato por conta, com índice: `CORA_CONTA_1_EMAIL`, `CORA_CONTA_1_NOME`,
  `CORA_CONTA_1_SENHA_HASH`, `CORA_CONTA_1_DELEGACAO`, e as mesmas quatro com `_2_`. O índice
  numérico em vez do nome da pessoa é deliberado: trocar quem usa o sistema não vira mudança de
  código.
- Cada conta vira um registro com id, nome, e-mail, hash de senha e token de delegação. O id é
  derivado do índice (`conta-1`), estável e sem dado pessoal — é ele que vira `requesterUserId`
  no registro de execução.
- Regras: e-mail comparado sempre em minúsculas e sem espaço nas pontas; conta incompleta é
  **erro nomeando a variável que falta** (mesma disciplina de `main.ts:21-28`), nunca conta meio
  carregada; duas contas com o mesmo e-mail é erro.
- **Nenhuma função deste arquivo pode imprimir, registrar em log ou serializar o hash ou o token
  de delegação.** Escreva isso como comentário no topo e acrescente um teste provando que a
  mensagem de erro de conta incompleta não contém o valor de nenhuma variável.
- Os testes usam `SYNTH-` em tudo e um hash de mentira — esta etapa não confere senha, só carrega
  configuração.

**Verificação:** `pnpm run test` passa e `pnpm run typecheck` fica silencioso. Rodando só
`pnpm exec vitest run apps/server/src/auth/contas.test.ts`, a lista de casos deve conter
"mensagem de configuração incompleta nomeia a variável, nunca o valor".

**Depende de:** Etapa 1.

---

### Etapa 8 — Módulo de arquivos estáticos (puro, ainda sem ligar no servidor)

**Objetivo:** existe uma função testável que resolve um caminho de URL para um arquivo dentro de
uma pasta, recusando escapar dela, com o tipo de conteúdo certo e o comportamento de SPA.

**Arquivos:** `apps/server/src/http/estaticos.ts`; `apps/server/src/http/estaticos.test.ts`.

**Contexto:**

- `resolverArquivoEstatico(pathnameDaUrl, raiz)` devolve união discriminada: arquivo resolvido
  (caminho e tipo), recusado por estar fora da raiz, ou não encontrado.
- Defesa obrigatória, e é o motivo desta etapa existir separada: `..`, `%2e%2e`, barra invertida,
  byte nulo e caminho absoluto **não podem** sair da raiz. Compare o caminho resolvido com a raiz
  resolvida usando separador normalizado, e teste cada um desses vetores.
- Tipos a cobrir: `.html`, `.js`, `.css`, `.svg`, `.png`, `.json`, `.woff2`, `.ico`. Extensão
  desconhecida vira `application/octet-stream`.
- Regra de SPA: caminho sem extensão e sem arquivo correspondente cai no `index.html`. Caminho
  com extensão cujo arquivo não existe é 404 de verdade — não devolva `index.html` no lugar de um
  `.js` faltando, senão o navegador reclama de MIME e o erro fica ilegível.
- Cabeçalhos de cache devolvidos como valor, não como efeito: `index.html` com `no-cache`;
  arquivo com hash no nome (sob `/assets/`) com `public, max-age=31536000, immutable`. A spec
  proíbe cache agressivo que compita com dado sempre atualizado; a casca versionada é a única
  exceção segura.
- Use `node:fs/promises` e crie os arquivos de teste numa pasta temporária (`mkdtemp` de
  `node:os`), limpando no `afterEach`. Sem rede.

**Verificação:** `pnpm run test` passa com os casos de travessia de caminho explícitos, e
`pnpm run typecheck` fica silencioso.

**Depende de:** Etapa 1.

---

### Etapa 9 — Rotas de autenticação no servidor

**Objetivo:** as duas pessoas conseguem entrar e sair de verdade, com cookie de sessão, freio de
tentativas e verificação de origem — provado por teste sem rede contra um servidor HTTP real em
porta efêmera.

**Arquivos:** `apps/server/src/auth/rotas.ts`; `apps/server/src/auth/rotas.test.ts`;
`apps/server/src/http/server.ts`; `apps/server/src/http/erros.ts`;
`apps/server/src/http/erros.test.ts`; `apps/server/src/http/server.test.ts`.

**Contexto:**

- `erros.ts:12-66` tem **três** estruturas exaustivas. Acrescente de uma vez as quatro categorias
  que esta etapa e a Etapa 10 usam: `credenciais_invalidas` com 401, `bloqueado_por_tentativas`
  com 429, `sessao_ausente` com 401 e `sessao_expirada` com 401. Mensagens genéricas, sem dizer
  qual campo errou — a spec e o `design.md` exigem isso. O `erros.test.ts` deve continuar
  cobrindo a tabela inteira.
- `rotas.ts` concentra os três handlers e recebe tudo por parâmetro (armazém de sessões, freio,
  porta de hash, lista de contas, `now`, e se o cookie é seguro), para o `server.ts` só despachar.
- `server.ts`: acrescentar em `handleRequest`, depois da checagem de Host que já existe nas
  linhas 185-190, o roteamento de `POST /auth/entrar`, `POST /auth/sair` e `GET /auth/sessao`.
  `DependenciasHttp` ganha um campo `auth` **opcional**, para que os 20 testes existentes de
  `server.test.ts` continuem montando o servidor como hoje.
- **Verificação de origem no POST** — a parte de CSRF que o `SameSite=Lax` não cobre (decisão 8
  da spec): se o cabeçalho `Origin` existir e não corresponder ao host da requisição, recusar.
  Origem ausente **não** é recusa: cliente não-navegador, como o teste e o `curl`, não manda.
- `POST /auth/entrar`: exige `Content-Type: application/json`; valida com o schema da Etapa 3;
  confere a senha **sempre gastando tempo**, mesmo quando o e-mail não existe (Etapa 4); bloqueio
  pelo freio responde 429 antes de conferir senha; sucesso limpa o freio, cria a sessão e responde
  200 com a sessão (id da conta, nome, e-mail) mais o `Set-Cookie`. **Nunca** devolve token de
  delegação nem hash.
- `POST /auth/sair`: encerra a sessão do cookie, se houver, e devolve o cookie de expiração.
  Idempotente: 200 mesmo sem sessão.
- `GET /auth/sessao`: 200 com a sessão, ou 401 com `sessao_ausente` ou `sessao_expirada`,
  conforme a união discriminada da Etapa 5.
- Testes no molde de `server.test.ts`, que sobe servidor real em porta efêmera e usa o helper
  `jsonDe` por causa da falta de lib DOM (`server.test.ts:12-16`): senha certa entra e recebe
  cookie com os três atributos; senha errada dá 401 genérico; e-mail inexistente dá **a mesma**
  resposta que senha errada; o limite de falhas dá 429; `/auth/sessao` com cookie válido dá 200;
  sessão expirada dá 401 `sessao_expirada`; token adulterado dá 401 `sessao_ausente`;
  `/auth/sair` invalida; origem estranha é recusada; método errado devolve 405 com `Allow`.

**Verificação:**

```
pnpm run test
pnpm run typecheck
```

Esperado: os 354 testes anteriores continuam passando, mais os novos; typecheck silencioso.
Rodando só `pnpm exec vitest run apps/server/src/auth/rotas.test.ts`, a lista deve conter
"resposta de entrada não contém token de delegação nem hash".

**Depende de:** Etapas 3, 4, 5, 6 e 7.

---

### Etapa 10 — `POST /turno` exige sessão e fala com o Workspace pela conta certa

**Objetivo:** quem conversa com a Cora é a pessoa autenticada, e a chamada ao Workspace usa o
token de delegação **daquela** conta — o isolamento por usuário provado na Fase 1 volta a valer.

**Arquivos:** `apps/server/src/http/server.ts`; `apps/server/src/http/contrato.ts`;
`apps/server/src/http/contrato.test.ts`; `apps/server/src/http/boot.ts`;
`apps/server/src/http/boot.test.ts`; `apps/server/src/http/main.ts`;
`apps/server/src/http/server.test.ts`.

**Contexto:**

- **Decisão D1 deste plano:** `PedidoDeTurnoSchema` (`contrato.ts:27-32`) passa a ser
  `{ mensagem, deviceId }`, `.strict()`. O `requester` sai do corpo; mandar `requesterUserId`
  agora é 422, coerente com o comentário do próprio arquivo (`contrato.ts:4-11`).
  `montarRequester` passa a receber o id da conta vindo da sessão, o `deviceId` do corpo e o
  `runId` gerado no servidor — o `runId` continua nunca vindo do cliente.
- **Decisão D2:** `boot.ts` ganha `montarRegistryPorConta(contas, opcoes)`, devolvendo um `Map`
  de id da conta para `ToolRegistry`, cada um com seu `WorkspaceClient` e sua `FilaDeEntrada`.
  O `montarRegistry` atual (linha 18) continua existindo como peça interna, uma conta por vez.
- O campo `registry` de `DependenciasHttp` vira `registryDaConta(idDaConta)`. Atualize os pontos
  de montagem em `server.test.ts` — o helper `motorFalso()` das linhas 39-45 é o que toca mais
  testes existentes.
- `main.ts`: a variável única de delegação (linha 59) **sai**; entram as variáveis das contas via
  `carregarContas(process.env)` (Etapa 7). Erro de configuração continua saindo com código 2 e
  nomeando a variável. `WORKSPACE_AGENT_CLIENT` e `WORKSPACE_AGENT_SECRET` continuam por processo
  — são a identidade do **serviço**, não do humano (`client.ts:80-94`).
- `/turno` sem sessão devolve 401 `sessao_ausente`; com sessão expirada, 401 `sessao_expirada`;
  com sessão válida, segue o fluxo de hoje usando o registry daquela conta.
- Testes: turno sem cookie é recusado; turno com cookie da conta 1 usa o registry da conta 1
  (prove com dois registries de mentira distinguíveis); corpo com `requester` dá 422; o
  `requesterUserId` do registro de execução é o id da conta, nunca o e-mail.

**Verificação:**

```
pnpm run test
pnpm run typecheck
pnpm --filter @cora/server run build
node apps/server/dist/servidor.mjs ; echo "codigo=$?"
```

Esperado: suíte inteira verde, sem nenhum teste antigo virando `skipped`; typecheck silencioso; e
o servidor continua saindo com `codigo=2` nomeando uma variável faltante — agora podendo ser uma
das variáveis de conta.

**Depende de:** Etapa 9 (mesmo `server.ts`). Usa também a Etapa 7.

---

### Etapa 11 — Servir a SPA na mesma origem, X-Robots-Tag e bind/hosts configuráveis

**Objetivo:** o mesmo processo que responde `/turno` entrega a tela; o servidor consegue escutar
fora de 127.0.0.1 e aceitar o subdomínio de produção; e nada do que ele serve é indexável.

**Arquivos:** `apps/server/src/http/server.ts`; `apps/server/src/http/server.test.ts`;
`apps/server/src/http/boot.ts`; `apps/server/src/http/boot.test.ts`;
`apps/server/src/http/main.ts`.

**Contexto:**

- `server.ts`: se nenhuma rota conhecida casar e a raiz estática estiver configurada, use
  `resolverArquivoEstatico` (Etapa 8) e transmita o arquivo. **Não** use `enviar()`
  (`server.ts:39-43`) — ela fixa `Content-Type: application/json`. Sem raiz estática
  configurada, o comportamento atual (`rota_desconhecida`, 404 tipado) permanece, e é assim que
  os testes existentes continuam válidos.
- `X-Robots-Tag: noindex, nofollow` em **toda** resposta, inclusive `/turno` e `/health`
  (`estrategia_de_aquisicao`, item 1). Um lugar só, no começo de `handleRequest`.
- `boot.ts`: uma função lê `CORA_HOSTS_PERMITIDOS` (lista separada por vírgula) e **acrescenta**
  aos padrões, sem substituí-los — perder `localhost` quebraria o desenvolvimento; outra lê
  `CORA_BIND`, com padrão 127.0.0.1. Valor inválido é erro nomeado, como `porta()` já faz
  (`boot.ts:33-41`).
- `main.ts`: passa os três valores novos (hosts permitidos, endereço de escuta e a raiz estática
  vinda de `CORA_RAIZ_ESTATICA`) e **atualiza o comentário das linhas 80-81** — ele diz hoje que
  não há autenticação de usuário humano, e a partir da Etapa 10 há.
- Testes: arquivo existente é servido com o tipo certo; rota desconhecida sem extensão cai no
  `index.html`; `..` no caminho é recusado (a defesa já foi testada na Etapa 8; aqui é a prova de
  que o servidor usa o módulo certo); `X-Robots-Tag` presente em `/health`, em `/turno` e no
  HTML; host fora da lista continua 400 `host_nao_permitido`; host configurado por ambiente passa.

**Verificação:**

```
pnpm run test
pnpm run typecheck
pnpm --filter @cora/web run build
```

Esperado: suíte verde, typecheck silencioso, build da web funcionando. A prova ponta a ponta com
navegador é a Etapa 19; aqui bastam os testes do servidor.

**Depende de:** Etapa 10 (mesmo `server.ts`). Usa o módulo da Etapa 8.

---

### Etapa 12 — Web: textos literais, cliente da API e estado de sessão

**Objetivo:** todo texto visível da fase existe num lugar só, igual ao `design.md`, e a tela tem
uma camada de acesso ao servidor com os erros nomeados que o `design.md` exige.

**Arquivos:** `apps/web/src/textos.ts`; `apps/web/src/textos.test.ts`;
`apps/web/src/api/cliente.ts`; `apps/web/src/api/cliente.test.ts`;
`apps/web/src/estado/sessao.ts`.

**Contexto:**

- `textos.ts` é um objeto `as const` com **todas** as frases da seção `textos` do `design.md`:
  login, chat, os cinco chips de estado, erros de conexão, prompt de PWA e menu de conta. Nenhuma
  frase pode ser inventada, encurtada ou reescrita.
- `textos.test.ts` é o que torna "literal" verificável: lê o `design.md` com `node:fs` e, para
  cada string folha do objeto de textos, afirma que ela aparece no documento. Roda no vitest da
  raiz, ambiente node, sem DOM.
- `api/cliente.ts` segue a convenção do repositório: **`fetchImpl` injetável**, a mesma decisão de
  `packages/workspace-client/src/client.ts:40`; envia credenciais junto (cookie) e usa caminhos
  relativos (`/auth/entrar`, `/auth/sair`, `/auth/sessao`, `/turno`) — nunca URL absoluta, que
  quebraria a mesma origem e o empacotamento.
- O cliente traduz status em união discriminada, sem jogar exceção para a tela: sucesso,
  `credenciais_invalidas`, `bloqueado_por_tentativas`, `sessao_expirada`,
  `servidor_indisponivel` e `sem_internet`. **`sem_internet` e `servidor_indisponivel` são
  estados diferentes** — o `design.md` desenha telas diferentes para eles (banner reversível
  contra tela cheia), e fundi-los é o erro que o repositório inteiro proíbe.
- `estado/sessao.ts`: estado simples sobre `GET /auth/sessao`, sem biblioteca de estado global
  (são duas telas).
- Testes com `fetchImpl` falso: cada status vira o erro certo; 401 de sessão vira
  `sessao_expirada`; falha de rede vira `sem_internet` quando o sinal de conectividade disser que
  está offline, e `servidor_indisponivel` caso contrário — passe esse sinal por parâmetro, para o
  teste não depender de `navigator`.

**Verificação:**

```
pnpm run test
pnpm --filter @cora/web run typecheck
```

Esperado: os testes novos aparecem na suíte da raiz (são `.ts`, ambiente node) e passam; o
typecheck da web fica silencioso.

**Depende de:** Etapa 1. Pode rodar em paralelo com todo o trilho do servidor.

---

### Etapa 13 — Web: máquina de estados da conversa (pura, sem React)

**Objetivo:** a regra de "mensagem que falha nunca some, e dá para reenviar sem redigitar" existe
como lógica testável, separada de qualquer componente.

**Arquivos:** `apps/web/src/estado/conversa.ts`; `apps/web/src/estado/conversa.test.ts`.

**Contexto:**

- Modele cada mensagem com id, autor (pessoa ou Cora), texto, situação (enviando, enviada,
  falhou, recebida) e, quando houver, o estado do resumo operacional para o chip.
- Reducer puro com as transições: enviar (otimista, entra como enviando), confirmar (vira enviada
  e a resposta da Cora entra como recebida), falhar (vira falhou e **permanece na lista**),
  reenviar (volta a enviando reaproveitando o texto) e a regra explícita do `design.md`: **o
  rascunho digitado no campo não é limpo quando a mensagem anterior falha**.
- Os cinco chips vêm dos estados nomeados de `apps/server/src/inbox/resumo.ts`
  (`com_pendencias`, `sem_pendencias`, `sincronizacao_incompleta`, `erro_de_acesso`,
  `sem_registros`). A tela **não inventa estado** e **não funde** dois deles. Um teste deve
  afirmar que os cinco rótulos são distintos entre si, no molde de
  `apps/server/src/tools/workspace-create-task.test.ts:378-383`.
- Nada de DOM aqui: arquivo `.ts`, testado pelo vitest da raiz.

**Verificação:** `pnpm run test` inclui os casos "mensagem que falhou continua na lista",
"reenviar reaproveita o texto", "rascunho atual não é limpo por falha anterior" e "cinco rótulos
de estado distintos". `pnpm --filter @cora/web run typecheck` fica silencioso.

**Depende de:** Etapa 1. Paralela à Etapa 12 — arquivos diferentes.

---

### Etapa 14 — Web: tela de login (tela 1 do `design.md`)

**Objetivo:** Thaís e o dono entram pela tela desenhada, com os seis estados que o `design.md`
nomeia.

**Arquivos:** `apps/web/src/telas/Login.tsx`; `apps/web/src/telas/Login.css`;
`apps/web/src/componentes/MarcaCora.tsx`; `apps/web/src/assets/CREDITOS.md`;
`apps/web/src/App.tsx`.

**Contexto:**

- Estados obrigatórios (`design.md`, tela 1): normal; enviando (botão vira `Entrando…` e
  desabilita, campos ficam somente-leitura e **não escondidos**); senha errada (mensagem única
  abaixo do formulário, que **nunca** diz qual campo errou); conta bloqueada (o botão `Entrar`
  continua clicável — quem decide o bloqueio é o servidor, a cada tentativa); campo vazio
  (validação local antes de chamar o servidor, com o foco indo para o primeiro campo vazio);
  servidor fora do ar.
- **Dois fracassos reais já documentados que esta tela nasce evitando** (nota de implementação do
  `design.md`, vinda do `LoginPage.tsx` do Workspace): o campo de senha **é limpo** ao voltar de
  um erro, nada de pontos residuais; e o e-mail preenchido por autofill fica visível e legível com
  o rótulo à mostra, para a pessoa perceber a conta errada antes de clicar em Entrar.
- Textos **só** de `textos.ts` (Etapa 12). Nenhuma string literal nova dentro de `.tsx`.
- `MarcaCora.tsx` insere o `wordmark-lockup.svg` **inline** — o `design.md` exige inline para
  herdar claro/escuro —, copiado de `docs/esteira/.../design/assets/`, trocando o
  `font-family="Inter, ..."` por `var(--font-sans)`. É a contradição nº 4 do Contexto verificado.
  Copie também o `CREDITOS.md` de origem para `apps/web/src/assets/` e acrescente a linha da troca.
- Layout de 360px: coluna única, respiro lateral de 16px, corpo nunca abaixo de 16px, alvo de
  toque nunca abaixo de 44px. Foco de teclado usa `--focus-ring`, nunca `outline: none` sozinho.
- `App.tsx` decide entre login e um marcador de chat conforme o estado de sessão (Etapa 12). A
  tela de chat de verdade chega na Etapa 15.

**Verificação:**

```
pnpm --filter @cora/web run typecheck
pnpm --filter @cora/web run build
pnpm run test
pnpm --filter @cora/web run dev
```

Esperado: typecheck silencioso, build gerando `dist/`, suíte da raiz intacta, e a tela abrindo em
`http://localhost:5173` com a marca, os dois campos e o botão `Entrar`. Compare lado a lado com
`docs/esteira/fase-4-acesso-windows-e-pwa-android/design/preview.html`, em 360px de largura
(modo celular do DevTools).

**Depende de:** Etapa 12.

---

### Etapa 15 — Web: tela de chat com todos os estados (telas 2 e 3 do `design.md`)

**Objetivo:** a conversa acontece, e os estados de carregamento, falha e desconexão aparecem
exatamente como desenhados — sem fundir "sem internet", "servidor fora do ar" e "sessão expirada".

**Arquivos:** `apps/web/src/telas/Chat.tsx`; `apps/web/src/telas/Chat.css`;
`apps/web/src/componentes/Mensagem.tsx`; `apps/web/src/componentes/ChipDeEstado.tsx`;
`apps/web/src/componentes/CampoDeEntrada.tsx`;
`apps/web/src/componentes/BannerSemInternet.tsx`; `apps/web/src/componentes/TelaDeErro.tsx`;
`apps/web/src/componentes/Ilustracao.tsx`; `apps/web/src/App.tsx`.

**Contexto:**

- Consome a máquina de estados da Etapa 13 e o cliente da Etapa 12. Não reimplementa regra nenhuma
  dentro do componente.
- Estados obrigatórios da tela 2: vazio de primeira vez com o `ilustracao-vazio.svg` inline;
  enviando (mensagem otimista com o rótulo `Enviando…`, campo e botão desabilitados); erro de
  envio (a mensagem continua **visível**, com o aviso e o botão `[Tentar de novo]` em
  `--color-erro`); `Cora está digitando…` como linha própria no fim da lista; chip de estado
  **acima** do texto da bolha, com ícone e rótulo — a cor é reforço, nunca o único sinal.
- Estados obrigatórios da tela 3: banner de `--color-alerta` no topo quando sem internet, com a
  conversa **utilizável por baixo**; tela cheia com `ilustracao-erro-conexao.svg` quando o
  servidor não responde; tela cheia de sessão expirada com `[Entrar de novo]`, que leva ao login.
- **Escapar HTML é obrigatório** no texto vindo do servidor: a fixture de título com injeção já
  existe no repositório (`docs/ROADMAP.md`), e `packages/policy/src/untrusted.ts` só embrulha —
  quem exibe é quem escapa. Em React isso significa **nunca** usar `dangerouslySetInnerHTML`.
  Escreva isso como comentário no componente de mensagem.
- Ritmo vertical: `--gap-mesma-autoria` (8px) entre mensagens do mesmo autor e
  `--gap-troca-autoria` (24px) na troca. Bolha até cerca de 85% da largura, nunca 100%. Em 360px,
  a legenda `Assistente da MedConsultoria` some primeiro.
- Textos **só** de `textos.ts`.

**Verificação:**

```
pnpm --filter @cora/web run typecheck
pnpm --filter @cora/web run build
pnpm run test
```

Mais o roteiro manual, com o servidor real de pé (contas sintéticas e motor roteirizado),
anotando o resultado de cada item: (1) entrar; (2) mandar mensagem e ver a resposta; (3) derrubar
o servidor e mandar outra — a mensagem fica na lista com `[Tentar de novo]`; (4) subir o servidor
e reenviar — funciona; (5) marcar `Offline` no DevTools — aparece o banner e a conversa continua
visível; (6) apagar o cookie e mandar mensagem — tela cheia de sessão expirada.
Esperado: os seis itens conferem com o `design.md` em 360px de largura.

**Depende de:** Etapas 13 e 14 (as duas mexem em `App.tsx`).

---

### Etapa 16 — Web: menu de conta (tela 6 do `design.md`)

**Objetivo:** dá para sair da conta e trocar de usuário, com as duas confirmações desenhadas.

**Arquivos:** `apps/web/src/componentes/MenuDeConta.tsx`;
`apps/web/src/componentes/MenuDeConta.css`; `apps/web/src/telas/Chat.tsx` (só o cabeçalho).

**Contexto:**

- Painel deslizante a partir do cabeçalho, que fecha ao tocar fora. **Não** é rota nova.
- Mostra nome e e-mail da sessão real (Etapa 12), nunca dado de demonstração.
- `Sair da conta` sempre; `Trocar de usuário` só aparece se houver mais de uma conta configurada
  no aparelho. Se não houver como saber isso hoje, o item **não aparece**, e essa decisão fica
  escrita em comentário — não invente estado que o servidor não expõe.
- Confirmações com `[Cancelar]` e a ação à direita (`[Sair]` em `--color-erro`), lado a lado
  mesmo em 360px, com alvo de toque de 44px.
- Sair chama `POST /auth/sair` e volta ao login; a conversa em memória é descartada, porque não há
  persistência (decisão da spec).
- Foco de teclado: ao abrir o painel o foco vai para o primeiro item, e `Esc` fecha.

**Verificação:**

```
pnpm --filter @cora/web run typecheck
pnpm --filter @cora/web run build
```

Manual: abrir o menu, clicar em `Sair da conta`, cancelar (volta ao chat), confirmar (volta ao
login) e conferir no DevTools que o cookie de sessão foi expirado.

**Depende de:** Etapa 15 (`Chat.tsx`).

---

### Etapa 17 — PWA: ícones, manifest, service worker mínimo e prompt de instalação (tela 4)

**Objetivo:** no Android a Cora é instalável, aparece na tela inicial com ícone próprio e abre em
tela cheia — e o prompt de instalação só aparece quando o navegador diz que pode.

**Arquivos:** `apps/web/scripts/gerar-icones.mjs`; `apps/web/public/icons/icon-192.png`,
`icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`;
`apps/web/public/favicon.svg`; `apps/web/public/manifest.json`; `apps/web/public/sw.js`;
`apps/web/src/pwa/instalacao.ts`; `apps/web/src/pwa/instalacao.test.ts`;
`apps/web/src/componentes/PromptDeInstalacao.tsx`; `apps/web/index.html`;
`apps/web/src/main.tsx`; `apps/web/src/telas/Chat.tsx`; `apps/web/src/assets/CREDITOS.md`;
`apps/web/package.json` (só um script).

**Contexto:**

- `gerar-icones.mjs` usa o `sharp` (instalado na Etapa 1) para rasterizar
  `docs/esteira/fase-4-acesso-windows-e-pwa-android/design/assets/icon-any.svg` e
  `icon-maskable.svg` nos quatro PNGs. **Os PNGs são commitados** — o build de CI não pode
  depender de rasterizador. Registre o comando como script `icones` no `package.json` do pacote.
- `manifest.json` é o bloco JSON literal do `design.md` (seção `estrategia_de_aquisicao`, item 3),
  com `theme_color` igual a `#003591` e o `background_color` convertido de
  `--color-background: oklch(0.984 0.003 248)` para sRGB — calcule, não chute: o `design.md` diz
  que `#FCFCFD` é aproximação para revisão, não fonte de verdade.
- `sw.js` **mínimo, e o mínimo tem motivo**: ele existe porque sem service worker registrado o
  Chrome no Android não dispara o `beforeinstallprompt` (web.dev, citado na spec). Cacheie **só**
  a casca versionada (`index.html` e os arquivos sob `/assets/`), com estratégia de rede primeiro
  para o HTML, e **nenhuma** interceptação de `/turno` nem de `/auth/*` — dado do resumo
  operacional é sempre atualizado, e cache aqui seria mentira com autoridade. Escreva isso em
  comentário dentro do arquivo.
- `instalacao.ts` guarda o evento `beforeinstallprompt`, expõe se dá para instalar e a ação de
  instalar, e lembra a recusa **só na sessão atual** (`design.md`, tela 4). Lógica pura, testada
  com um evento falso, sem DOM real.
- `PromptDeInstalacao.tsx`: cartão flutuante ancorado na base (`--shadow-flutuante`,
  `--radius-md`), largura cheia menos 16px de cada lado, 8px acima do campo de entrada, **nunca**
  sobrepondo o botão `Enviar`. Só aparece depois do evento do navegador — nunca por temporizador.
- `index.html` ganha o `link` para o manifest e o favicon; o `main.tsx` registra o service worker
  **só em produção** e falha em silêncio se o navegador não suportar.

**Verificação:**

```
pnpm --filter @cora/web run icones
pnpm --filter @cora/web run build
pnpm run test
```

Mais a conferência do manifest por leitura do JSON: precisa ter quatro ícones, `display` igual a
`standalone` e `start_url` igual a `/`. Os quatro PNGs precisam existir com as dimensões certas
(512 por 512 nos dois de 512). O build precisa copiar `manifest.json`, `sw.js`, `robots.txt` e a
pasta `icons/` para `dist/`.
Manual, e é o critério que importa: servir o `dist/` por HTTPS ou por `localhost`, abrir no Chrome
Android e confirmar que o Lighthouse (modo celular) reporta instalável e que o prompt aparece.

**Depende de:** Etapa 16 (`Chat.tsx`) e Etapa 1.

---

### Etapa 18 — `apps/desktop`: janela Tauri para a URL publicada, e o aviso do SmartScreen

**Objetivo:** existe um pacote Tauri v2 que abre a Cora numa janela própria, com ícone, apontando
para uma URL **configurável** — e o papel que acompanha o instalador já está escrito.

**Arquivos:** `apps/desktop/src-tauri/tauri.conf.json`; `apps/desktop/src-tauri/Cargo.toml`;
`apps/desktop/src-tauri/build.rs`; `apps/desktop/src-tauri/src/main.rs`;
`apps/desktop/src-tauri/icons/` (gerados); `apps/desktop/package.json` (só `scripts`);
`apps/desktop/ANTES-DE-INSTALAR.md`; `apps/desktop/README.md`.

**Contexto:**

- **Rust e MSVC não existem na máquina onde este plano foi escrito.** Esta etapa entrega
  configuração, ícones e documentação; o `tauri build` é passo manual na máquina do dono, com os
  pré-requisitos escritos no `README.md`: Rust stable MSVC 1.77 ou mais novo, Microsoft C++ Build
  Tools, Node 20 ou mais novo. O WebView2 já vem de fábrica no Windows 10 1803 ou mais novo e no
  Windows 11 — fonte na `spec.md`, seção `fontes_externas`.
- `tauri.conf.json`: janela única, título `Cora — MedConsultoria`, tamanho inicial adequado à tela
  de chat, e a URL da janela apontando para a produção. **A URL não pode ser fixa no código**
  (spec, `fora_de_escopo`: mudar de casa não pode virar reescrita): leia-a de um único lugar
  declarado, e documente no `README.md` qual linha trocar para apontar para outro servidor — e que
  a troca exige reempacotar.
- Permissões: o mínimo. A janela só carrega uma URL remota. Nenhum comando nativo, nenhum acesso
  a sistema de arquivos, nenhum plugin de atualização automática (fora de escopo).
- Ícones gerados pelo CLI do Tauri a partir de
  `docs/esteira/fase-4-acesso-windows-e-pwa-android/design/assets/icon-windows-source.svg`
  (1024 por 1024). Os arquivos gerados são commitados.
- `ANTES-DE-INSTALAR.md` recebe o texto **literal** da seção "Mensagem de primeira execução do app
  Windows" do `design.md`: título, explicação do aviso azul, os três passos numerados e a saída
  para dúvida. É a tela 5 do design — documento, não software.

**Verificação:**

```
node -e "console.log(JSON.stringify(require('./apps/desktop/src-tauri/tauri.conf.json'),null,2))"
pnpm --filter @cora/desktop exec tauri icon docs/esteira/fase-4-acesso-windows-e-pwa-android/design/assets/icon-windows-source.svg --output apps/desktop/src-tauri/icons
ls apps/desktop/src-tauri/icons
pnpm run test
pnpm run typecheck
```

Esperado: o JSON é válido e imprime a janela com a URL configurável; o comando de ícones cria pelo
menos `icon.ico`, `icon.png` e os PNGs quadrados do Windows; a suíte e o typecheck da raiz seguem
intactos, já que o pacote não tem `.ts` no alcance da raiz.
**Não declare o instalador pronto nesta etapa** — o `.msi`/`.exe` sai do `tauri build` na máquina
do dono, com Rust instalado, e esse resultado é evidência da Etapa 20.

**Depende de:** Etapa 1.

---

### Etapa 19 — `scripts/verificacao-fase-04.ts`: a prova de ponta a ponta do login

**Objetivo:** existe um script que prova, contra o servidor HTTP de verdade, o que mock nenhum
prova: entrar, conversar, sair, sessão expirada, sessão adulterada e freio de tentativas.

**Arquivos:** `scripts/verificacao-fase-04.ts`; `package.json` (raiz, só um script novo).

**Contexto:**

- Molde: `scripts/verificacao-fase-01.ts` e `scripts/verificacao-fase-02.ts` — cabeçalho
  explicando o que é, tabela numerada de resultados no fim e código de saída 0 só se tudo passar.
- Diferença importante em relação aos anteriores: **este não precisa do Workspace real**. Ele sobe
  o `criarServidorHttp` em porta efêmera com contas sintéticas (`SYNTH-`), hash gerado na hora,
  `ScriptedMotor` (`apps/server/src/engine/scripted.ts`) e `now` controlado, e bate nele com
  `fetch` local. Continua **fora** de `pnpm run test` por subir servidor, no mesmo espírito dos
  outros dois.
- Itens a provar, um por linha da tabela: (1) senha certa entra e recebe cookie com `HttpOnly`,
  `SameSite=Lax` e `Secure` quando configurado; (2) senha errada recusa; (3) e-mail inexistente dá
  resposta idêntica à senha errada; (4) o limite de falhas bloqueia; (5) `/turno` sem cookie é
  recusado; (6) `/turno` com cookie funciona e o `requesterUserId` do registro é o id da conta;
  (7) as duas contas usam tokens de delegação diferentes; (8) sessão expirada é recusada com
  `sessao_expirada`; (9) cookie adulterado é recusado; (10) `X-Robots-Tag` presente; (11)
  travessia de caminho no servimento estático é recusada; (12) o `index.html` é servido para uma
  rota de SPA desconhecida.
- Nenhum valor de senha, hash ou token pode ser impresso. Imprima só o resultado.
- O `package.json` da raiz ganha o script `verificacao:fase04`.

**Verificação:**

```
pnpm run verificacao:fase04 ; echo "codigo=$?"
```

Esperado: tabela de 12 linhas, a frase final dizendo que todas as 12 verificações passaram, e
`codigo=0`. `pnpm run test` e `pnpm run typecheck` continuam iguais.

**Depende de:** Etapa 11. Fica melhor depois da 17, para o `dist/` da web existir no item 12 — se
não existir, gere uma pasta temporária com um `index.html` de mentira e diga isso na saída.

---

### Etapa 20 — Documentação da fase e o roteiro de publicação manual na TineHost

**Objetivo:** quem for publicar (outra sessão, com o sim do dono) tem o passo a passo completo, e a
documentação do repositório deixa de descrever o software de ontem.

**Arquivos:** `docs/OPERATIONS.md`; `docs/SECURITY.md`; `docs/ARCHITECTURE.md`;
`docs/ROADMAP.md`; `docs/THIRD-PARTY.md`; `docs/publicacao/tinehost.md` (novo); `CLAUDE.md` (só a
tabela "Onde está o quê", se ganhar linha nova).

**Contexto:**

- **Corrigir o que ficou velho:** `docs/OPERATIONS.md:14` diz "282 testes"; a seção "Ainda não
  existe" (por volta da linha 269) diz que faltam autenticação de usuário humano e CORS; e
  `docs/SECURITY.md:126-133` diz que o `requesterUserId` é afirmação não verificada — a partir da
  Etapa 10 ele vem da sessão.
- **Variáveis novas, todas documentadas com o papel de cada uma e nenhum valor:**
  `CORA_CONTA_1_EMAIL`, `CORA_CONTA_1_NOME`, `CORA_CONTA_1_SENHA_HASH`, `CORA_CONTA_1_DELEGACAO`
  e as mesmas com `_2_`; mais `CORA_BIND`, `CORA_HOSTS_PERMITIDOS`, `CORA_RAIZ_ESTATICA` e
  `CORA_COOKIE_INSEGURO`. E registrar a saída da variável única de delegação, que deixou de existir.
- `docs/publicacao/tinehost.md` **escreve, não executa**. Baseie no processo real já usado no mesmo
  provedor: `C:\Users\Desktop\source\repos\medconsultoria-bkp\DEPLOY.md` (Application Root,
  Startup File, Node 20, variáveis no painel, Install/Restart/Rebuild, SSL pelo painel). O roteiro
  precisa conter, em ordem: criar o subdomínio (recomendado `cora.medconsultoria.com.br`); emitir
  o certificado Let's Encrypt pelo painel; criar a aplicação Node 20 com o Startup File apontando
  para `apps/server/dist/servidor.mjs` (Etapa 2); enviar o `apps/web/dist` e apontar
  `CORA_RAIZ_ESTATICA` para ele; preencher as variáveis **no painel**, com os hashes gerados por
  `scripts/hash-senha.ts` rodado **dentro do servidor**; acrescentar o subdomínio a
  `CORA_HOSTS_PERMITIDOS`; **testar o `@node-rs/argon2` antes de tudo** (risco 1 deste plano), com
  um comando de uma linha; e a conferência final (`/health`, entrar, uma mensagem, sair).
- Escreva também, com todas as letras, o que **não** acontece nesta fase: nada de deploy
  automático, nada de gatilho de push em workflow de publicação, nada de segredo no repositório.
- `docs/THIRD-PARTY.md` ganha as licenças novas: React, Vite, Tauri (MIT ou Apache-2.0),
  `@node-rs/argon2`, `@fontsource/montserrat`, `sharp` e `esbuild`.
- `docs/ROADMAP.md` ganha a seção da Fase 4 no mesmo tom das anteriores: o que foi feito e o que
  **não** foi (instalador não assinado; nenhuma publicação executada; sem histórico persistido;
  sem 2FA; sem SSO), mais o ticket aberto.

**Verificação:**

```
pnpm run test
pnpm run typecheck
```

Mais duas conferências de texto: procurar por "282 testes" dentro de `docs/` não pode devolver
nada, e procurar pela variável antiga de delegação em `docs/` e `apps/` também não. E nenhuma
linha com hash real: procurar por `argon2id` fora de arquivo marcado com `SYNTH-` não pode devolver
nada.

**Depende de:** todas as etapas de código (1 a 19).

---

### Etapa 21 — Ticket ao Workspace sobre SSO (fora do worktree)

**Objetivo:** a consequência que a decisão 1 da spec manda executar fica registrada no canal certo,
sem bloquear nada.

**Arquivos:** `med-coordination/tickets/CORA-006/` — **outro repositório**.

**Contexto:**

- **Esta etapa não é do neguin-executor.** Regra do `CLAUDE.md` deste repositório: pedido ao
  Workspace vira ticket em `med-coordination/tickets/`, e **só a sessão CORA roda Git em
  `med-coordination`** nesta máquina. Quem executa é a sessão principal, não um worktree de
  `cora-med`.
- Conteúdo: perguntar se faz sentido, no futuro, um endpoint autenticado que emita ou renove um
  token de delegação a partir de uma sessão de navegador válida — hoje só existe o comando de
  operador (`docs/OPERATIONS.md:174`). Deixe claro que **não bloqueia** a Fase 4, que a Cora nasceu
  com login próprio por decisão registrada, e que a fronteira já está no lugar certo: a chamada ao
  Workspace continua sendo por token de delegação.
- Siga o formato dos tickets CORA-001 a CORA-005 já existentes.

**Verificação:** a pasta `med-coordination/tickets/CORA-006/` existe com o ticket escrito no
formato dos anteriores, e o `docs/ROADMAP.md` cita o ticket na seção da Fase 4 (a citação entra na
Etapa 20).

**Depende de:** nenhuma. Pode acontecer a qualquer momento.

---

## Paralelismo

**Grupo 0 — sozinho, bloqueia todo o resto:** Etapa 1.

**Grupo 1 — todas em paralelo depois da Etapa 1**, porque nenhuma toca arquivo de outra:
Etapas **2, 3, 4, 5, 6, 7, 8, 12, 13 e 18**.
A Etapa 2 mexe em `apps/server/package.json` e no `build.mjs`; as Etapas 4 a 7 criam arquivos
novos em `apps/server/src/auth/`; a 8 cria `apps/server/src/http/estaticos.ts`; a 3 fica em
`packages/contracts`; as 12 e 13 ficam em `apps/web/src` em arquivos distintos; a 18 fica em
`apps/desktop`.

**Grupo 2:** Etapa **9** (depende de 3, 4, 5, 6 e 7) em paralelo com a Etapa **14** (depende de 12).

**Grupo 3:** Etapa **10** (depende de 9) em paralelo com a Etapa **15** (depende de 13 e 14).

**Grupo 4:** Etapa **11** (depende de 10, usa a 8) em paralelo com a Etapa **16** (depende de 15).

**Grupo 5:** Etapa **17** (depende de 16).

**Grupo 6:** Etapa **19** (depende de 11; melhor depois da 17).

**Grupo 7:** Etapa **20** (depende de tudo).

**Fora da fila:** Etapa **21**, a qualquer momento, e **não** por um executor de worktree.

## Sequencial obrigatório, e por quê

- **9 depois 10 depois 11**: as três editam `apps/server/src/http/server.ts` e o
  `server.test.ts`. Em paralelo é conflito garantido.
- **12 depois 14 depois 15 depois 16 depois 17**: o `App.tsx` é editado pelas Etapas 14 e 15; o
  `Chat.tsx` pelas 15, 16 e 17.
- **1 depois 2**: as duas mexem em `apps/server/package.json`.
- **1 antes de tudo**: é a única etapa que instala dependência e altera o `pnpm-lock.yaml`. Duas
  worktrees instalando pacote ao mesmo tempo produzem lockfile conflitante — o conflito mais caro
  de resolver de todos os listados aqui.

## O que eu não consegui confirmar

1. **Se o `@node-rs/argon2` instala e roda no Node.js Selector da TineHost.** Não há acesso ao
   painel daqui, e a evidência do provedor é indireta: o Workspace roda Node lá, mas não confirmei
   que ele usa esse binário naquele servidor. É o risco 1, com plano B nomeado.
2. **Se o `tauri build` completa nesta máquina.** `cargo` e `rustc` não existem aqui; a Etapa 18
   foi escrita para ser verificável sem eles, e o instalador fica declaradamente pendente.
3. **Se o `sharp` instala sem atrito no Windows desta máquina.** Não instalei nada — sou
   somente-leitura. Se falhar, o contorno está no risco 3.
4. **A contagem exata de testes ao final da fase.** Sei o ponto de partida medido (354) e que cada
   etapa acrescenta; não estimei o total.
5. **O nome final do subdomínio.** A spec recomenda `cora.medconsultoria.com.br` e deixa a criação
   como passo do dono no painel. Todo lugar que precisa dele lê de configuração
   (`CORA_HOSTS_PERMITIDOS`, `tauri.conf.json`, `og:image`), então escolher tarde não custa
   retrabalho — mas a escolha precisa acontecer antes da publicação.
6. **Se `docs/esteira/.../design/textos.md` e a seção `textos` do `design.md` são idênticos.** Li o
   `design.md` inteiro e o usei como fonte; o teste literal da Etapa 12 aponta para ele. Se os dois
   divergirem, o teste denuncia — e a regra é: o `design.md` vence.

## Uma observação que não virou etapa

`docs/OPERATIONS.md` e `docs/SECURITY.md` carregam afirmações que esta fase torna falsas (contagem
de testes, "não existe autenticação de usuário humano", `requesterUserId` como afirmação não
verificada). Corrigi-las é obrigação da Etapa 20, não refatoração extra — documentação que descreve
o software de ontem mente com autoridade. Fora isso, não vi nada no caminho pedindo refator, e não
acrescentei nenhum.
