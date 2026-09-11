## estrategia_de_aquisicao

Título herdado do papel, mas a pergunta muda de lugar: a Cora não tem "aquisição" — tem
**duas contas nomeadas** (Thaís, o dono) que já sabem que ela existe. Não existe funil,
não existe estranho para converter, e o sucesso aqui é o oposto do SEO comum: **ninguém
de fora encontra isto no Google**, o link não vaza conteúdo se colado por engano, e a
tela abre rápido no celular da Thaís em rede ruim. Cada item abaixo resolve um desses
três problemas — não um problema de marketing que não existe neste sistema.

### 1. Indexação — bloquear, não otimizar

Ferramenta interna atrás de login, podendo carregar dado de paciente depois da
autenticação. Regra: **nada aqui deve aparecer em busca, nunca, mesmo sem querer.**

- `apps/web/public/robots.txt`:
  ```
  User-agent: *
  Disallow: /
  ```
  Bloqueia o crawler antes mesmo de ele ler qualquer HTML — primeira linha de defesa,
  redundante de propósito com a tag abaixo (um crawler que ignora `robots.txt` ainda
  esbarra na meta tag; um que lê só a meta tag ainda esbarra no `robots.txt`).
- Meta tag em **toda página servida**, login incluído (login é a página mais sensível de
  indexar — vaza que o sistema existe e qual é a URL):
  ```html
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
  ```
  `noarchive` e `nosnippet` cobrem o caso do Bing/outros motores que às vezes ignoram
  `noindex` sozinho mas respeitam essas duas. Como a SPA é uma casca só (`index.html`) com
  roteamento no cliente, esta tag entra uma vez no `<head>` do único HTML servido — não há
  N páginas para lembrar de marcar cada uma.
- **Sem `sitemap.xml`.** Um sitemap é um convite a ser indexado; aqui seria o oposto do
  que se quer.
- Nenhum `<link rel="canonical">` apontando para si mesmo como se fosse conteúdo público —
  omitir é o padrão certo, não um esquecimento.
- Cabeçalho HTTP adicional no `apps/server` (reforço no nível do servidor, não só do HTML,
  para o caso de algum bot ler cabeçalho e ignorar meta tag): `X-Robots-Tag: noindex,
  nofollow` em toda resposta que serve a SPA ou responde `POST /turno`. Custo: uma linha
  no handler que já escreve cabeçalhos em `server.ts`.

### 2. Título da aba e favicon

Coerente com a Direção A (sóbria e institucional), sem inventar identidade visual nova —
usa o `--color-primary` (azul-petróleo, `oklch(0.38 0.085 255)`) já fixado em `design.md`.

- `<title>Cora — MedConsultoria</title>`. Curto, sem CTA, sem palavra de venda — é a aba
  de uma ferramenta de trabalho, não uma landing page. Aparece igual na aba do navegador,
  no atalho instalado no Android e na barra de título da janela Tauri no Windows.
- Favicon: um único glifo simples (a letra "C" ou um símbolo de balão de conversa
  minimalista) em `--color-primary` sobre fundo `--color-background`, gerado como SVG e
  exportado nos tamanhos que os navegadores ainda pedem em `.ico`/PNG: `favicon.ico`
  (multi-tamanho 16/32/48), `favicon-16x16.png`, `favicon-32x32.png`. Produção destes
  ícones é tarefa do papel de Assets desta mesma sessão da esteira (skill
  `imagem-por-codigo`), não desta seção — aqui só se fixa a direção de cor e a lista de
  arquivos que o manifest e o `<head>` esperam encontrar.
- `apple-touch-icon.png` (180×180) para o caso de alguém abrir no Safari/iOS mesmo a Fase
  4 não visando iOS — custo zero, evita o ícone genérico cinza do Safari se algum dia
  alguém tentar.

### 3. Manifest do PWA (`apps/web/public/manifest.json`)

Caminho no monorepo confirmado pelo Arquiteto: `apps/web` é o pacote-irmão de
`apps/server`, servido como estático pelo próprio `apps/server` na mesma origem
(`docs/esteira/.../spec.md`, seção `solucao`). `manifest.json` e os ícones vivem em
`apps/web/public/`, copiados para o build final junto com `index.html` — mesmo padrão
Vite que qualquer outro asset estático do projeto segue, nada especial para o PWA.

```json
{
  "name": "Cora — MedConsultoria",
  "short_name": "Cora",
  "description": "Assistente interna da MedConsultoria para consultar pendências e conversar com a Cora.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#FAFAFC",
  "theme_color": "#28456B",
  "lang": "pt-BR",
  "orientation": "portrait-primary",
  "prefer_related_applications": false,
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Decisões e a fonte de cada uma:

- **`background_color`/`theme_color` tirados dos tokens do `design.md`, não inventados
  aqui.** `theme_color: #28456B` é o hex mais próximo de `--color-primary: oklch(0.38
  0.085 255)` (a cor da splash screen do Android e da barra de status/título); `#FAFAFC`
  é o hex mais próximo de `--color-background: oklch(0.98 0.004 250)`. O papel de
  implementação deve gerar o hex exato por conversão OKLCH→sRGB na hora de codar — os
  valores acima são aproximação visual para revisão, não a fonte de verdade (a fonte é o
  bloco `tokens` do `design.md`).
- **192 e 512, `any` e `maskable`, quatro arquivos — não dois.** A spec já pedia 192/512
  "por compatibilidade"; a parte que faltava nomear é `maskable`: o Android recorta o
  ícone `any` dentro de formas variadas (círculo, squircle, quadrado arredondado
  conforme o launcher do fabricante) e um ícone sem uma versão `maskable` desenhada com
  margem de segurança (conteúdo dentro dos 80% centrais, ~40px de sangria em 512) fica
  cortado ou com fundo transparente estranho em parte dos aparelhos Android. Fonte, com
  data: MDN, "Making PWAs installable" — critérios de instalabilidade, incluindo ícone —
  consultada em 11/09/2026 (mesma fonte já citada em `spec.md`, seção `fontes_externas`).
  Confirmado também por web.dev, "Learn PWA: Installation" (mesma data de consulta,
  também já citada na spec): o Chrome/Android usa o manifest para decidir o prompt de
  instalação, e ícone ausente ou mal formado é causa comum de o prompt simplesmente não
  aparecer — silêncio, não erro.
- **`start_url: "/"` e `scope: "/"`** — coerente com "zero duplicação de tela" da spec: a
  SPA inteira mora sob uma rota só, não há subseção a isolar.
- **`display: "standalone"`**, herdado literal da spec — sem barra de endereço, com
  cabeçalho do próprio app, mas sem entrar em `fullscreen` (que esconderia até a barra de
  status do sistema, desnecessário e generalizando de mais para uma tela de trabalho).
- **`prefer_related_applications: false`** — herdado da spec, some com qualquer redireção
  para uma loja de app que não existe.
- **`lang: "pt-BR"`** — único idioma do sistema, evita o navegador supor idioma pela
  configuração do aparelho.
- **Service worker mínimo**, já decidido em `spec.md` ("cacheando só o shell"): é
  pré-requisito técnico de instalabilidade no Chrome/Android (web.dev confirma: sem
  service worker registrado, mesmo com manifest válido, o `beforeinstallprompt` não
  dispara) — não é feature de "app que funciona sem internet", que está fora de escopo.

### 4. Open Graph — o problema não é descoberta, é vazamento acidental

A pergunta do papel original ("como um estranho descobre isto") não se aplica; a que se
aplica é: **se Thaís ou o dono colarem a URL da Cora numa conversa de WhatsApp por
engano** (querendo mandar outra coisa, ou só testando o link), o preview gerado não pode
mostrar nada de uma conversa real, um nome de paciente ou um estado do resumo
operacional — porque OG é gerado do HTML estático da rota, sempre o mesmo, nunca de
conteúdo de sessão.

```html
<meta property="og:title" content="Cora — MedConsultoria" />
<meta property="og:description" content="Ferramenta interna da MedConsultoria." />
<meta property="og:type" content="website" />
<meta property="og:image" content="https://cora.medconsultoria.com.br/og-cover.png" />
<meta property="og:locale" content="pt_BR" />
<meta name="twitter:card" content="summary" />
```

- **Descrição deliberadamente neutra e curta** — nunca "veja suas pendências", "converse
  com a Cora sobre X", nada que sugira o que existe atrás do login. O texto acima é o
  teto de quanto contexto o OG deve carregar.
- **`og:image` é uma imagem estática genérica** (o mesmo ícone/wordmark do favicon, sobre
  fundo sóbrio), nunca um screenshot da tela de chat ou do resumo — mesmo desfocado.
  Produção via skill `imagem-por-codigo`, mesma direção visual da Direção A. Card
  `summary` (pequeno), não `summary_large_image`: um preview grande chama mais atenção
  visual num grupo de WhatsApp, o oposto do objetivo aqui.
- Como a página é servida com `noindex`, o OG só importa para o caso humano-colou-o-link
  acima — não existe cenário de "otimizar para compartilhamento" porque não há conteúdo a
  compartilhar de propósito.
- **Sem `og:url` apontando para rotas internas** (ex.: `/conversa/123`) — não existem
  rotas assim (spec: sem histórico persistido, sem deep link de conversa), então não há
  risco disso hoje; registrado aqui para quando/se existir, o preview continua sendo o
  genérico da raiz, nunca o de uma rota autenticada.

### 5. Core Web Vitals — critério de aceitação, não métrica de SEO

Sem tráfego de busca, CWV aqui não mede posicionamento — mede a experiência real que a
spec já nomeia como cenário nº 1: **Thaís abrindo o PWA no celular, em campo, rede
móvel instável** (`spec.md`, seção `solucao`, e a decisão 4 de `contradicoes_resolvidas`
sobre mensagem não poder sumir em silêncio nessa mesma rede ruim).

Alvos de aceitação para a tela publicada (medidos em 3G rápido/4G simulado, não só em
wifi de escritório):

| Métrica | Alvo | Por que este número, aqui |
|---|---|---|
| **LCP** (maior elemento visível) | ≤ 2,5 s | O maior elemento da tela de chat é o campo de entrada/lista — SPA pequena, sem imagem de herói, sem fonte de terceiro pesada (Inter é a única família, já decidida no `design.md` justamente para não pesar o primeiro carregamento em rede móvel). 2,5s é o limiar "bom" padrão do CWV; nada aqui justifica relaxar. |
| **INP** (resposta à interação) | ≤ 200 ms | Enviar mensagem e receber o indicador de "pensando" precisa parecer instantâneo mesmo com a resposta do servidor demorando — a percepção de responsividade da interação (tocar "Enviar", abrir o campo) é separada da latência da resposta da Cora, que pode levar segundos e é coberta pelo estado de carregamento, não pelo INP. |
| **CLS** (estabilidade visual) | ≤ 0,1 | Lista de mensagens crescendo para cima, chip de estado do resumo aparecendo depois de carregar — nenhum desses pode empurrar o campo de texto ou um botão no momento em que o polegar da Thaís já estava indo tocar ali. Reforça a regra de `design.md`: alvo de toque nunca abaixo de 44px, junto com espaço reservado (skeleton, não "pulo") para o que ainda está carregando. |

- **Onde isso vira critério de aceitação, não intenção:** medir com Lighthouse (modo
  mobile, throttling simulado) contra o build de produção antes de cada publicação que
  toque `apps/web`, e registrar o resultado na evidência da fase (mesmo padrão de
  `scripts/verificacao-fase-0X.ts` que a spec já usa para prova manual e documentada,
  já que E2E contra a TineHost real está fora de escopo).
- **O que isso não é:** não existe orçamento de performance para "taxa de conversão" ou
  "tempo até a primeira compra" — não há funil. O único usuário que sofre com CWV ruim
  aqui é uma das duas pessoas nomeadas, em campo, tentando saber se uma tarefa ficou
  pendente.

### O que fica fora, e por quê

Nada de: palavra-chave, meta description otimizada para clique, schema.org de
produto/organização, Search Console, backlink, AMP, hreflang (um idioma só), sitemap,
qualquer coisa que pressupõe um visitante que ainda não conhece o sistema. O "funil" desta
ferramenta tem dois nomes e uma senha entregue pessoalmente — a estratégia inteira é
**não aparecer**, abrir rápido, e não vazar nada se o link escapar por engano.
