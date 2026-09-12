# Lente — Pesquisador (Fase 4: acesso Windows e PWA Android)

## 1. Tela de chat web — framework

**O que já existe pronto.** Não há biblioteca de "chat UI" madura e neutra o bastante
para justificar dependência nova — chat aqui é lista de mensagens + input, não um
produto de mensageria com threads/anexos. A decisão relevante é o *build tool/framework
de SPA*, não um pacote de chat.

- **Recomendação: Vite + React**, servido como estático pelo próprio `apps/server`
  (Express-like), consumindo `POST /turno` via `fetch`. É o caminho hoje recomendado
  pelo próprio time do React para SPA — Create React App está descontinuado e a
  documentação oficial do React aponta para Vite. Fonte:
  React Stack Patterns / ecossistema 2026 — <https://www.patterns.dev/react/react-2026/>
  (consultado 11/09/2026).
- **Alternativa mais leve avaliada: Preact** (~3 kB, mesma API ES6 do React), indicada
  quando bundle size é crítico (PWA, widget). Como esta fase já exige PWA no Android,
  Preact reduziria o peso do primeiro carregamento em rede móvel. Fonte:
  <https://www.alphabold.com/preact-vs-react/> (consultado 11/09/2026).
- **Por que não pesa a decisão:** o repositório é monorepo pnpm sem nenhum front-end
  hoje — não há um "padrão do projeto" a respeitar, então a escolha é aberta e cabe ao
  Arquiteto bater o martelo entre React (ecossistema maior, mais fácil achar exemplo) e
  Preact (mais leve, ótimo para o requisito de PWA). Registro em `duvidas_para_o_dono`
  não se aplica — é decisão técnica, não de produto.
- **Armadilha conhecida:** nenhuma migração de framework depois — como o requisito é
  "SPA de chat simples", qualquer um dos dois atende; a armadilha real é escolher algo
  pesado (Next.js completo, com SSR/roteamento de servidor) para um caso que não precisa
  de SSR e que já tem backend Express separado — duplicaria a camada de servidor sem
  necessidade.

## 2. PWA instalável no Android — requisitos reais de 2026

Fonte primária, MDN (atualizada, consultada 11/09/2026):
<https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable>

Requisitos confirmados para o Chrome no Android promover a PWA a WebAPK instalável:

1. **HTTPS obrigatório** (ou `localhost`/`127.0.0.1` em desenvolvimento) — nenhuma
   exceção em produção.
2. **`manifest.json`** referenciado via `<link rel="manifest" href="manifest.json">`,
   com os campos obrigatórios em navegadores Chromium: `name` ou `short_name`, `icons`
   (a versão mais recente do critério do Chrome não exige mais obrigatoriamente 192px
   *e* 512px — basta ao menos um ícone; a MDN ainda recomenda os dois tamanhos por
   compatibilidade ampla), `start_url`, `display` ou `display_override`, e
   `prefer_related_applications` ausente ou `false`.
3. **Service worker registrado** — a MDN descreve como não estritamente obrigatório
   para o critério mínimo, mas o comportamento real observado no Chrome/Android (guia
   `web.dev`) trata a ausência de service worker como bloqueio silencioso do prompt de
   instalação — recomendação: registrar um service worker mesmo que mínimo (cache
   estático), para não depender de um detalhe que varia entre versões do Chrome. Fonte:
   web.dev — <https://web.dev/learn/pwa/installation> (consultado 11/09/2026).
4. Resultado no Android: a PWA vira **WebAPK** de verdade — entra no launcher, aparece
   no task switcher e abre em `display: standalone` (tela cheia, sem barra de endereço),
   exatamente o critério de aceitação do briefing.

**HTTPS na TineHost:** confirmado que o DirectAdmin oferece emissão automática de
certificado Let's Encrypt pelo próprio painel (menu "SSL Certificates" → ACME →
Let's Encrypt), renovação automática a cada 90 dias, sem linha de comando — mas isso é
documentação de terceiros hospedando DirectAdmin (a TineHost não publica manual próprio
encontrável publicamente). Fonte, exemplo de provedor com o mesmo painel:
<https://www.homehost.com.br/blog/tutoriais/seguranca/instalar-certificado-ssl-lets-encrypt-directadmin/>
(consultado 11/09/2026) — **não é fonte TineHost**, é evidência de como o recurso
funciona no DirectAdmin em geral; o Workspace já publica em
`workspace.medconsultoria.com.br` com HTTPS, o que é a prova concreta de que a TineHost
oferece esse caminho.

**Armadilha:** o "critério mínimo" muda entre versões do Chrome (o exigir 192px+512px
foi relaxado). Não confiar em checklist antigo — testar com o Lighthouse/DevTools no
momento da implementação, não só ler a spec.

## 3. App Windows nativo com Tauri

Fonte primária, documentação oficial Tauri v2 (consultada 11/09/2026):
<https://v2.tauri.app/start/prerequisites/> e <https://v2.tauri.app/concept/size/>

- **Empacotar uma URL/web app existente:** o Tauri v2 permite apontar a janela nativa
  para uma URL remota (não só para assets locais empacotados) — é exatamente o caso de
  uso do briefing: abrir a mesma tela publicada na TineHost dentro de uma janela nativa,
  sem duplicar interface. Confirmar no momento da implementação a configuração
  `tauri.conf.json` → `app.windows[].url` apontando para a URL de produção (ou uma URL
  configurável por variável de ambiente, para não hardcodear — exigência do próprio
  briefing).
- **Requisitos de build no Windows:**
  - Rust via `rustup`, canal stable (MSVC), `rustc` 1.77+ (Tauri 2.9.x).
  - Node.js 20 LTS ou mais novo — **já é o que o Workspace usa em produção (Node
    20.19.2)**, sem conflito de versão a resolver.
  - **Microsoft C++ Build Tools** com "Desktop development with C++" — dependência de
    SO que precisa estar na máquina de build (do dono ou de CI local), não no servidor.
  - **WebView2**: já vem instalado de fábrica no Windows 10 (a partir da build 1803) e
    Windows 11 — não é uma instalação extra para o usuário final (Thaís/dono) na
    maioria dos casos; existe bootstrapper para os poucos casos sem WebView2.
- **Tamanho do instalador comparado a Electron:** bundles Tauri 2.9.x ficam em torno de
  **~3 MB**, contra **~96 MB** do Electron equivalente — redução de ~96%. Outra fonte
  cita ~5–10 MB vs 120 MB+. Isso confirma a escolha já feita no briefing (Tauri em vez
  de Electron) com número concreto. Fonte: <https://v2.tauri.app/concept/size/> e
  agregador de comparação (consultado 11/09/2026, número da doc oficial é o que vale).
- **Licença:** Tauri é **dual-licenciado MIT OR Apache-2.0**, sem royalty, sem taxa por
  assento, sem restrição comercial — compatível com uso interno da MedConsultoria sem
  ônus de licenciamento. Fonte: repositório oficial e documentação de arquitetura —
  <https://v2.tauri.app/concept/architecture/> (consultado 11/09/2026). Ressalva da
  própria Tauri: dependências transitivas podem ter licenças próprias — checar
  `cargo license` antes de fechar a fase, prática padrão e barata.

**Armadilha conhecida:** o build do instalador Windows precisa rodar numa máquina
Windows com toolchain Rust + C++ Build Tools instalados — isso não roda na TineHost
(que só serve Node.js via DirectAdmin) nem é coberto por CI aqui (fora de escopo do
briefing, sem runner). Ou seja: **o instalador é gerado localmente pelo dono/executor,
não publicado por pipeline** — coerente com "deploy manual" já assumido no briefing,
mas vale registrar que é *build* manual também, não só publicação.

## 4. Login real — reaproveitar Workspace vs. biblioteca própria

Esta pergunta depende de uma decisão de arquitetura (o Arquiteto confirma, em
paralelo, se o contrato `workspace-agent-v1` permite propagar identidade). A pesquisa
cobre os dois caminhos possíveis, sem escolher por eles:

### Se reaproveitar sessão/token do Workspace
Padrões seguros de 2026 para propagar sessão a um cliente novo:
- **Backend único, mesmo domínio (caso mais próximo do briefing — `apps/server` serve a
  SPA e a API):** cookie de sessão **httpOnly + Secure + SameSite=Lax**, nunca token
  Bearer em `localStorage` (exposto a XSS). É o padrão recomendado quando cliente e API
  estão sob o mesmo domínio.
- **SPA falando com API de domínio separado:** access token em memória (nunca
  persistido) + refresh token em cookie httpOnly restrito ao endpoint de auth.
- **Reverse proxy como terceira opção:** um proxy que lê o cookie httpOnly e reescreve
  como `Authorization: Bearer` para a chamada downstream — útil se o Workspace só aceita
  Bearer e a Cora quer manter cookie no cliente; adiciona uma peça de infraestrutura
  extra, a pesar contra a simplicidade.
- Fonte: comparação 2026 de cookie vs. Bearer, com essas três recomendações —
  <https://crosscheck.cloud/blogs/cookies-vs-jwt-authentication-2026/> e
  <https://dev.to/nadeem137/cookie-auth-vs-bearer-token-in-express-whats-the-difference-and-when-to-use-each-51h4>
  (consultado 11/09/2026).
- **Ponto de atenção de segurança:** cookie httpOnly é imune a XSS mas vulnerável a
  CSRF — se este caminho for escolhido, o item de "revisão de segurança obrigatória" do
  briefing precisa cobrir proteção CSRF (`SameSite=Lax` já mitiga boa parte para POST
  simples; `csurf`/token duplo se houver necessidade de `SameSite=None`).

### Se o Workspace NÃO for reaproveitável (fallback)
- **Armadilha grave encontrada:** a biblioteca mais citada para "sessão + hash de senha
  leve em Node" nos últimos anos, **Lucia**, foi **descontinuada em março de 2025** — o
  pacote npm carrega aviso oficial de depreciação e o projeto virou material de
  aprendizado ("implemente sessão do zero"), não mais uma dependência a instalar. Fonte:
  <https://github.com/lucia-auth/lucia> e discussão oficial
  <https://github.com/lucia-auth/lucia/discussions/1707> (consultado 11/09/2026).
  **Não recomendar Lucia nesta fase.**
- **Alternativa madura hoje: Better Auth** — biblioteca TypeScript de auth mais adotada
  por projetos pequenos/solo em 2026, cobre e-mail+senha, sessão, 2FA, sem exigir
  provedor externo. Licença **MIT** (confirmar versão exata da licença no `package.json`
  do pacote no momento da instalação). Fonte:
  <https://solodevstack.com/blog/betterauth-vs-lucia-solo-developers>
  (consultado 11/09/2026) — é conteúdo de blog, não documentação oficial; antes de
  adotar, ler `https://www.better-auth.com` diretamente (não verificado nesta pesquisa).
- **Auth.js (NextAuth)** segue mantido em "modo só-segurança" (recebe correções, não
  recursos novos) — funciona, mas não é o alvo natural para um app fora do ecossistema
  Next.js.
- **Se o volume for só dois usuários nomeados (Thaís + dono), como o briefing descreve**,
  vale considerar **sem biblioteca nenhuma**: hash de senha com `bcrypt`/`argon2` (já
  maduro, mantido, licença permissiva) e sessão via cookie httpOnly assinado — poucas
  linhas, sem dependência de framework de auth completo com recursos não usados (OAuth,
  organizações, RBAC). Coerente com a regra do projeto de não instalar pacote para o que
  vinte linhas resolvem.

## 5. Deploy Node.js na TineHost via DirectAdmin

- **Documentação pública oficial da TineHost:** `nenhuma` encontrada — a TineHost não
  publica manual próprio indexado publicamente sobre o Node.js Selector.
- **Documentação do mecanismo em si (Node.js Selector = CloudLinux):** existe, mas é do
  fabricante do recurso (CloudLinux), não da TineHost — <https://cloudlinux.com/getting-started-with-cloudlinux-os/42-profitability-and-php-features/959-nodejs-selector/>
  (consultado 11/09/2026). Confirma o fluxo genérico: Node.js Selector roda sobre
  CloudLinux + Apache, exige criar a aplicação no painel (root, versão do Node, arquivo
  de start), rodar "Install" (equivalente a `npm install`) e "Restart" — mesmo fluxo já
  descrito no guia interno.
- **Fonte interna já existente e válida (não é fonte externa, é leitura permitida):**
  `C:\Users\Desktop\source\repos\medconsultoria-bkp\DEPLOY.md` documenta o processo real
  usado pelo Workspace: Application Root, Startup File (`server/index.js` lá,
  `app.cjs` no caso do Workspace conforme o briefing), Node 18+/20.x, variáveis de
  ambiente no painel, botões Install/Restart/Rebuild/Stop/Status, e SSL via painel.
  Esse arquivo é a referência operacional mais confiável disponível — mais confiável que
  qualquer blog de terceiro sobre DirectAdmin genérico, por ser o mesmo provedor
  (TineHost) e o mesmo esquema (Node.js Selector) já em produção.
- **Armadilha registrada no próprio guia interno, vale carregar para a Cora:** o guia do
  Workspace tem uma pendência de segurança conhecida (deploy por senha SSH em vez de
  chave) — não é sobre o Node.js Selector, é sobre o workflow de CI/CD, que está fora de
  escopo desta fase (briefing exclui deploy automatizado). Mas é uma armadilha real do
  "jeito que o Workspace já publica" que vale não repetir se algum dia a Cora ganhar
  pipeline de deploy: nunca autenticar por senha em claro no repositório, usar chave SSH
  dedicada.

## fontes_externas
Todas listadas inline acima, cada uma com URL e data de consulta (11/09/2026).

## duvidas_para_o_dono
Nenhuma — a única decisão em aberto (reaproveitar login do Workspace vs. biblioteca
própria) é técnica e cabe ao Arquiteto confirmar via contrato, não ao dono.
