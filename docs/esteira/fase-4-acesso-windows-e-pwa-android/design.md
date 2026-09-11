# Design — Fase 4: acesso Windows e PWA Android

O painel adversarial de 11/09/2026 (três direções inventadas, cegas entre si) foi
**descartado a pedido do dono**: ele quer a identidade visual real da MedConsultoria, não uma
proposta nova. Esta seção documenta onde ela foi achada e como virou token — nenhuma cor,
fonte ou raio abaixo foi inventado.

## direcao_visual_escolhida

**A marca real da MedConsultoria**, achada em duas fontes que concordam entre si:

1. **O Manual da Marca oficial** —
   `workspace-medconsultoria/brand/identidade/Manual da Marca - MedConsultoria.pdf`
   ("Manual Prático de Aplicação do Logotipo MedConsultoria", ambientes digitais, vers. 1.0,
   2022) — página **14** ("Paleta de cores") e página **16**
   ("Tipográfia para títulos/subtítulos/textos de apoio").
2. **A aplicação real em produção**, que já implementa essa mesma paleta e fonte:
   `workspace-medconsultoria/packages/ui/tailwind-preset.js` (linhas 17-24 e 78-79) e
   `workspace-medconsultoria/apps/web/src/index.css` (linhas 7-73), mais
   `workspace-medconsultoria/apps/web/package.json` (dependência `@fontsource/montserrat`).

O logotipo em si — `workspace-medconsultoria/brand/logos/medconsultoria-logo.png` (lido e
conferido, não só listado pelo nome) — é o espiral verde/azul com "med" em azul-escuro e
"consultoria" em azul, e bate exatamente com os quatro hex da página 14 do Manual.

### As quatro cores da marca (achado, Manual da Marca p. 14)

| Cor | Hex | Papel no Manual | Onde também aparece em produção |
|---|---|---|---|
| Degradê verde símbolo | `#30AD73` | Cor do símbolo (espiral) | `brand.green` — `tailwind-preset.js:21`; base de `--success` |
| Degradê azul símbolo | `#2DA8E1` | Cor do símbolo (espiral) | `brand.blueLight` — `tailwind-preset.js:22`; base de `--ring` |
| Fundo azul escuro | `#002463` | Fundo/aplicação escura | `brand.blueDark` — `tailwind-preset.js:23`; `--sidebar` |
| Fonte azul | `#003591` | Cor da palavra "med" | `brand.blueText` — `tailwind-preset.js:24`; `--primary` |

`#003591` (fonte azul) é literalmente a cor que a aplicação real usa como `--primary` (botão
"Entrar"/"Enviar" equivalente) — `index.css:19`, `hsl(218 100% 28%)` convertido bate com o hex
do Manual a menos de 1% de diferença de luminosidade (arredondamento HSL). Por isso a Cora usa
`#003591` como `--color-primary` direto do hex do Manual, não da conversão HSL da aplicação.

### Tipografia (achado, Manual da Marca p. 16 + produção)

**Montserrat** é a família oficial para título/subtítulo/texto de apoio (Manual, p. 16, com o
link `fonts.google.com/download?family=Montserrat` citado no próprio slide). A aplicação real
confirma isso e vai além: usa Montserrat também no corpo do texto inteiro
(`index.css:99: font-family: "Montserrat", system-ui, sans-serif;`) — não só em título. A Cora
segue o uso real (corpo inteiro em Montserrat), não o uso mais restrito do Manual.

**Importante — como a fonte chega ao navegador é diferente do que a `preview.html` consegue
fazer:** a aplicação real **auto-hospeda** os arquivos da fonte via o pacote
`@fontsource/montserrat` (`apps/web/package.json`; os `.woff2` compilados dos pesos 400/500/
600/700 aparecem em `apps/web/dist/assets/montserrat-*.woff2`), **não** carrega de um link do
Google Fonts. A `preview.html` desta fase usa um `<link>` do Google Fonts para Montserrat só
para a prévia renderizar sem exigir o pacote local — isso não é o mecanismo real de produção,
é uma conveniência de visualização; quem implementar a Fase 4 deve replicar `@fontsource/
montserrat` (ou equivalente auto-hospedado), não copiar o `<link>` da prévia.

O logotipo em si (a palavra "med" desenhada) usa uma fonte customizada de marca, "Brother
1816" (Manual, p. 15) — isso é só do lockup gráfico do logo, não da interface; a Fase 4 não
tem o arquivo dessa fonte e não precisa dele, porque nenhuma tela pede o logotipo como texto
editável (ele entra como SVG/imagem, ver `assets`).

### Forma — raio de borda (achado, produção real)

`--radius: 0.625rem` (10px) é o valor real declarado em `index.css:54`, com a escala derivada
em `tailwind-preset.js:72-77` (`sm = radius - 4px`, `md = radius - 2px`, `lg = radius`,
`xl = radius + 4px`). A Cora usa essa mesma escala: `--radius-md: 0.625rem` (10px, o valor
literal da aplicação, para cartão/modal) e `--radius-sm: 0.5rem` (8px, um degrau abaixo, para
campo/botão/bolha — mapeamento razoável já que o Workspace não expõe qual componente usa qual
degrau da escala).

### Cores de estado — o que é achado e o que é extrapolado

Os cinco estados de `resumo.ts` (Fase 3) continuam precisando de uma cor cada. Duas vêm direto
da paleta de quatro cores da marca; três não têm equivalente no Manual (que não é um design
system de interface, é um manual de aplicação de logotipo) — para essas, a Cora usa os
**tokens semânticos já em produção real** no Workspace (`index.css:18-52`), porque são valores
que já rodam na aplicação de verdade, mesmo não vindo das quatro cores centrais da marca:

| Estado (`resumo.ts`) | Token | Origem | Achado ou extrapolado |
|---|---|---|---|
| `com_pendencias` | `--color-acento` | `#2DA8E1` (azul símbolo) escurecido para servir como texto legível — ver contraste abaixo | **Achado** o hex; **extrapolada** a correção de luminosidade (ver abaixo) |
| `sem_pendencias` | `--color-sucesso` | `hsl(152 62% 27%)`, `index.css:39` — a própria aplicação já escurece o `#30AD73` da marca para passar AA como texto | **Achado**, valor real de produção |
| `sincronizacao_incompleta` | `--color-alerta` | `hsl(38 96% 29%)`, `index.css:43` (`--warning`) | **Achado**, valor real de produção — não deriva das 4 cores da marca |
| `erro_de_acesso` | `--color-erro` | `hsl(0 72% 47%)`, `index.css:34` (`--destructive`) | **Achado**, valor real de produção — não deriva das 4 cores da marca |
| `sem_registros` | `--color-neutro-estado` | igual a `--muted-foreground`, `hsl(215 16% 42%)`, `index.css:27` | **Achado**, valor real de produção |

**A única correção que a Cora faz por conta própria** (extrapolação, não achado): o azul-claro
da marca (`#2DA8E1`, `oklch(0.69 0.13 234)`) é claro demais para servir como cor de *texto* —
como texto sobre o fundo claro da Cora dá **2,9:1**, reprova AA. A própria aplicação real nunca
usa esse azul como texto (só como `--ring`, um contorno de foco, e como parte do degradê do
símbolo) — não há um "uso real como texto" para copiar. A Cora escurece a mesma matiz e croma
até `L 0.50` (mantendo hue 234, a identidade do azul-claro reconhecível) só o suficiente para
passar AA como texto (**5,43:1**, calculado abaixo) — mesma disciplina do painel anterior:
aritmética de luminosidade na mesma matiz, nunca uma cor nova.

### Focar ring — achado, detalhe que o Manual não cobre

A aplicação real usa uma cor própria para o anel de foco de teclado, distinta do azul primário:
`--ring: hsl(199 85% 55%)` (`index.css:48`) — um azul mais claro e mais saturado que `#003591`,
para o anel de foco se destacar sobre botões que já são azul-escuro. Convertido, é
`oklch(0.72 0.14 235)` — a mesma família de matiz do azul-claro da marca. A Cora reproduz esse
detalhe real como `--color-ring`, em vez de reusar `--color-primary` no foco como o design
anterior fazia.

### Sombra — achado, "tom azulado da marca"

`index.css:67-72` documenta explicitamente: *"Sombras em camadas — tom azulado da marca, bem
suaves"*, com `--shadow-color: hsl(218 55% 22%)` (convertido: `oklch(0.31 0.08 261)`) por trás
de toda sombra da aplicação, em vez do cinza neutro comum em outros design systems. A Cora
reproduz esse mesmo tom azulado nas duas sombras que os tokens já previam
(`--shadow-card`, `--shadow-flutuante`).

### Três restrições vinculantes para quem implementar

Estas restrições não dependiam do painel descartado — continuam valendo com a marca real:

1. **Estado nunca é só cor.** Os cinco estados de `resumo.ts` aparecem como chip com ícone +
   rótulo em texto; a cor é reforço. `com_pendencias` (azul-claro da marca, hue 234) e
   `primary` (fonte-azul da marca, hue 261) são vizinhos de matiz — o que os separa é forma e
   texto, não a cor, igual antes.
2. **Contraste é teste, não promessa.** Qualquer token novo ou alterado entra medido (ver
   tabela em `tokens`).
3. **16px de respiro lateral mínimo em qualquer largura**, corpo nunca abaixo de 16px, alvo
   de toque nunca abaixo de 44px — as três âncoras de 360px.

### Nota de escopo sobre o tema escuro

`spec.md` põe "tema escuro" em `fora_de_escopo` desta fase, e **a aplicação real do Workspace
não tem tema escuro** — foi removido como código morto (`index.css:88-90`: *"Tema escuro
removido: era código morto — não havia toggle nem classes `dark:` no app"*). Os tokens escuros
abaixo são, portanto, **inteiramente extrapolados pela Cora** (não há "achado" real de
tema escuro para copiar): a mesma matiz, hue e papel de cada token claro, com `L` invertido
para funcionar sobre fundo escuro, medido contra AA como antes. Ficam definidos porque custam
zero (um bloco de media query, nenhum seletor de tema na interface, nenhuma tela a mais) e
porque o Android e o Windows respeitam `prefers-color-scheme` por conta própria. O que
continua fora de escopo é **botão de trocar tema**: o bloco `:root[data-theme="dark"]` existe
para o dia em que houver, e até lá ninguém constrói o controle.

## tokens

```css
/* ---------- Claro (padrão) ---------- */
:root {
  color-scheme: light;

  /* Cor — neutros (achado: index.css:9-11,22,26,46 — hsl convertido para oklch) */
  --color-background: oklch(0.984 0.003 248);
  --color-foreground: oklch(0.302 0.034 266);
  --color-muted: oklch(0.968 0.007 248);
  --color-muted-foreground: oklch(0.514 0.036 257);
  --color-border: oklch(0.926 0.013 255);

  /* Cor — ação (achado: Manual da Marca p.14 "fonte azul" #003591 e "fundo azul escuro" #002463) */
  --color-primary: oklch(0.367 0.160 261);       /* #003591 */
  --color-primary-foreground: oklch(0.99 0.004 261);
  --color-primary-hover: oklch(0.284 0.119 260); /* #002463 */

  /* Cor — foco (achado: index.css:48 --ring, tom azul-claro distinto do primary) */
  --color-ring: oklch(0.72 0.14 235);

  /* Cor — estados do resumo operacional (Fase 3). Ver direcao_visual_escolhida para
     o que é achado direto e o que é extrapolação da Cora. */
  --color-sucesso: oklch(0.484 0.102 158);       /* sem_pendencias — achado, index.css:39 (deriva de #30AD73 da marca) */
  --color-sucesso-foreground: oklch(0.99 0.004 158);
  --color-acento: oklch(0.500 0.132 234);        /* com_pendencias — hex #2DA8E1 da marca, escurecido por AA (extrapolação) */
  --color-acento-foreground: oklch(0.99 0.004 234);
  --color-alerta: oklch(0.523 0.111 71);         /* sincronizacao_incompleta — achado, index.css:43 (--warning) */
  --color-alerta-foreground: oklch(0.99 0.004 71); /* branco — achado, index.css:44 (--warning-foreground: 0 0% 100%) */
  --color-erro: oklch(0.549 0.206 27);           /* erro_de_acesso — achado, index.css:34 (--destructive) */
  --color-erro-foreground: oklch(0.99 0.004 27);
  --color-neutro-estado: oklch(0.514 0.036 257); /* sem_registros — mesma cor de muted-foreground, de propósito */

  /* Tipografia (achado: Manual da Marca p.16 + index.css:99, @fontsource/montserrat) */
  --font-sans: "Montserrat", system-ui, -apple-system, "Segoe UI", sans-serif;
  --text-xs: 0.75rem;   /* 12px */
  --text-sm: 0.875rem;  /* 14px */
  --text-base: 1rem;    /* 16px */
  --text-lg: 1.25rem;   /* 20px */
  --text-xl: 1.5625rem; /* 25px */
  --font-weight-normal: 400;
  --font-weight-medium: 600;
  --font-weight-bold: 700;
  --leading-tight: 1.2;
  --leading-normal: 1.5;

  /* Espaçamento (sem fonte no Workspace para esta escala — mantida do desenho anterior) */
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px — respiro lateral mínimo em qualquer largura */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-12: 3rem;    /* 48px */
  --space-16: 4rem;    /* 64px */

  /* Forma (achado: index.css:54 --radius: 0.625rem; escala de tailwind-preset.js:72-77) */
  --radius-sm: 0.5rem;   /* 8px — campo, botão, bolha (um degrau abaixo do valor real) */
  --radius-md: 0.625rem; /* 10px — cartão, modal — valor literal de --radius em produção */
  --radius-full: 9999px; /* avatar, indicador de estado */

  /* Sombra (achado: index.css:67-72, "tom azulado da marca" — hsl(218 55% 22%) convertido) */
  --shadow-card: 0 1px 2px oklch(0.31 0.08 261 / 0.08);
  --shadow-flutuante: 0 8px 24px oklch(0.31 0.08 261 / 0.18);

  --focus-ring: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring);

  /* Toque */
  --target-tocavel-min: 2.75rem; /* 44px */

  /* Ritmo da conversa */
  --gap-mesma-autoria: var(--space-2);   /* 8px entre mensagens do mesmo autor */
  --gap-troca-autoria: var(--space-6);   /* 24px na troca de autor */
}

/* ---------- Escuro ---------- */
/* Extrapolado pela Cora — o Workspace real NÃO tem tema escuro (index.css:88-90: removido
   como código morto). Mesma matiz/hue de cada token claro, L invertido, medido contra AA. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;

    --color-background: oklch(0.16 0.010 256);
    --color-foreground: oklch(0.95 0.006 256);
    --color-muted: oklch(0.22 0.012 256);
    --color-muted-foreground: oklch(0.70 0.012 256);
    --color-border: oklch(0.31 0.014 256);

    --color-primary: oklch(0.67 0.110 261);
    --color-primary-foreground: oklch(0.15 0.012 261);
    --color-primary-hover: oklch(0.74 0.110 261);
    --color-ring: oklch(0.78 0.110 235);

    --color-sucesso: oklch(0.72 0.130 158);
    --color-sucesso-foreground: oklch(0.15 0.020 158);
    --color-acento: oklch(0.72 0.100 234);
    --color-acento-foreground: oklch(0.15 0.020 234);
    --color-alerta: oklch(0.78 0.130 71);
    --color-alerta-foreground: oklch(0.18 0.025 71);
    --color-erro: oklch(0.70 0.170 27);
    --color-erro-foreground: oklch(0.15 0.020 27);
    --color-neutro-estado: oklch(0.70 0.012 256);

    /* Elevação no escuro é fundo mais claro (--color-muted), não sombra mais forte */
    --shadow-card: 0 1px 2px oklch(0 0 0 / 0.35);
    --shadow-flutuante: 0 8px 24px oklch(0 0 0 / 0.45);

    --focus-ring: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring);
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;

  --color-background: oklch(0.16 0.010 256);
  --color-foreground: oklch(0.95 0.006 256);
  --color-muted: oklch(0.22 0.012 256);
  --color-muted-foreground: oklch(0.70 0.012 256);
  --color-border: oklch(0.31 0.014 256);

  --color-primary: oklch(0.67 0.110 261);
  --color-primary-foreground: oklch(0.15 0.012 261);
  --color-primary-hover: oklch(0.74 0.110 261);
  --color-ring: oklch(0.78 0.110 235);

  --color-sucesso: oklch(0.72 0.130 158);
  --color-sucesso-foreground: oklch(0.15 0.020 158);
  --color-acento: oklch(0.72 0.100 234);
  --color-acento-foreground: oklch(0.15 0.020 234);
  --color-alerta: oklch(0.78 0.130 71);
  --color-alerta-foreground: oklch(0.18 0.025 71);
  --color-erro: oklch(0.70 0.170 27);
  --color-erro-foreground: oklch(0.15 0.020 27);
  --color-neutro-estado: oklch(0.70 0.012 256);

  --shadow-card: 0 1px 2px oklch(0 0 0 / 0.35);
  --shadow-flutuante: 0 8px 24px oklch(0 0 0 / 0.45);
}
```

### Contraste medido (relação, AA exige 4,5:1 para texto normal)

Calculado por luminância relativa WCAG real (sRGB linearizado a partir da conversão OKLCH→
linear-sRGB, não a aproximação de `L*` de Lab usada no desenho anterior — mais precisa e mais
conservadora nesta paleta de croma alto).

| Par | Claro | Escuro |
|---|---|---|
| `foreground` / `background` | 12,96:1 | 16,78:1 |
| `muted-foreground` / `background` | 5,39:1 | — |
| `primary-foreground` / `primary` | 10,63:1 | 6,53:1 |
| `sucesso` preenchido com sua foreground | 5,93:1 | 8,36:1 |
| `acento` como texto / `background` | 5,43:1 | 7,97:1 |
| `alerta` preenchido com `alerta-foreground` (branco) | 5,41:1 | 9,22:1 |
| `erro` preenchido com `erro-foreground` (branco) | 5,26:1 | 6,86:1 |
| `erro` como texto / `background` | 5,17:1 | 6,74:1 |
| `neutro-estado` / `background` | 5,39:1 | 7,27:1 |
| `primary-foreground` / `primary-hover` | 14,27:1 | — |

Todos os pares passam AA (4,5:1) com folga — a paleta real da marca, ao contrário da Direção B
descartada do painel anterior, não precisou de correção agressiva: só o azul-claro
(`--color-acento`) exigiu escurecer a mesma matiz para servir como texto (ver
`direcao_visual_escolhida`). O restante das cores de estado já veio de valores que a própria
aplicação real usa em produção, já tunados para AA lá (comentários em `index.css:26,33,37,42`
confirmam que o Workspace já fez esse ajuste antes da Cora).

## telas

Seis telas mínimas, na ordem em que `spec.md`/`textos.md` implicam. Alvo principal:
**360px de largura** (celular da Thaís, rede móvel instável). Toda tela herda dos
`tokens`: 16px de respiro lateral mínimo, corpo nunca abaixo de 16px, alvo de toque
nunca abaixo de 44px, estado nunca só cor.

### 1. Login

Layout em coluna única e centralizada, sem imagem lateral nem ilustração de fundo —
`assets/wordmark-lockup.svg` no topo, depois os dois campos, depois o botão.

**Estados:**
- **Normal**: campos `E-mail`/`Senha` vazios, texto de ajuda fixo abaixo do e-mail
  (`Use o e-mail cadastrado pelo administrador.`), botão `Entrar` habilitado.
- **Enviando**: botão vira `Entrando…` e desabilita; os dois campos ficam
  read-only (não escondidos) para a pessoa não digitar em cima do envio em curso.
- **Senha errada**: mensagem única abaixo do formulário (nunca aponta qual campo
  errou) — `E-mail ou senha não conferem. Confira os dois campos e tente de novo.`
  O campo de senha **é limpo** ao voltar do erro (nunca mantém pontos residuais da
  tentativa anterior — fracasso documentado em `LoginPage.tsx` do Workspace); o
  e-mail permanece preenchido e visível, nunca escondido atrás de autofill.
- **Conta bloqueada por tentativas**: mesma posição de erro, texto
  `Conta bloqueada por excesso de tentativas. Espere alguns minutos e tente de novo.
  Se continuar bloqueada, fale com o administrador.` — botão `Entrar` continua
  clicável (o servidor decide o bloqueio a cada tentativa, a tela não trava sozinha).
- Campo vazio ao tentar entrar (validação local, antes de chamar o servidor):
  mensagem junto do campo (`Digite seu e-mail para entrar.` /
  `Digite sua senha para entrar.`), foco vai para o primeiro campo vazio.
- Servidor fora do ar durante o login: mesma posição de erro,
  `Não conseguimos falar com o servidor agora. Verifique sua conexão e tente de novo.`

**Em 360px:** único empilhamento possível — logo, campo de e-mail, campo de senha,
botão, todos em largura cheia menos os 16px de margem. Nenhum elemento lateral a
esconder porque não existe layout de duas colunas nesta tela em nenhuma largura.

### 2. Chat principal

Cabeçalho fixo (`Cora` + legenda opcional `Assistente da MedConsultoria` + acesso ao
menu de conta), lista de mensagens rolável ao centro, campo de entrada fixo no rodapé.

**Estados:**
- **Vazio — primeira vez**: sem mensagem nenhuma na lista,
  `assets/ilustracao-vazio.svg` centralizada com o texto
  `Oi! Eu sou a Cora. Pergunte "como estão minhas pendências" ou me escreva
  livremente.` Campo de entrada já ativo, placeholder `Escreva uma mensagem…`.
- **Enviando**: a mensagem da própria pessoa aparece imediatamente na lista (otimista),
  com rótulo discreto `Enviando…` ao lado; campo de entrada e botão `Enviar`
  desabilitados, com apoio `Aguarde a resposta anterior.` se houver espaço.
- **Erro de envio**: a mensagem **continua visível** (nunca some), com o aviso
  `Não foi enviada. A conexão falhou no meio do caminho.` e o botão
  `[Tentar de novo]` ao lado, na cor `--color-erro`. O texto do rascunho seguinte,
  se a pessoa já tinha começado a digitar outra coisa no campo, permanece intacto —
  o erro é da mensagem anterior, não limpa o campo de entrada atual.
- **Resposta chegando**: indicador `Cora está digitando…` como uma linha própria no
  fim da lista (sem streaming, é só o indicador — decisão da spec).
- **Resumo operacional citado inline**: a frase de `resumo.ts` chega como mensagem
  da Cora dentro de uma bolha comum, mas com um **chip de estado** acima do texto —
  ícone + rótulo (`Erro de acesso`, `Sincronização incompleta`, `Sem registros`,
  `Sem pendências`, `Com pendências`) na cor correspondente do token, nunca só a cor
  da bolha. O chip `sincronizacao_incompleta` é sempre preenchido com
  `--color-alerta-foreground` por cima, nunca texto âmbar solto (regra do painel).
- Ritmo vertical: `--gap-mesma-autoria` (8px) entre mensagens seguidas da mesma
  origem, `--gap-troca-autoria` (24px) quando alterna entre pessoa e Cora.

**Em 360px:** cabeçalho encolhe para só o nome `Cora` (a legenda
`Assistente da MedConsultoria` **some primeiro** — é opcional por design, já marcada
assim em `textos.md`); bolhas de mensagem ocupam até ~85% da largura, nunca a largura
cheia, para preservar a leitura de "quem falou"; campo de entrada e botão `Enviar`
ficam lado a lado numa única linha fixa no rodapé, sem quebrar em duas linhas.

### 3. Erro de conexão (tela cheia)

Não é toast — ocupa a área de conteúdo inteira, substituindo a lista de mensagens (o
cabeçalho e, quando aplicável, o campo de entrada continuam visíveis por baixo/acima,
conforme o caso abaixo).

**Estados (dois casos distintos, nunca fundidos):**
- **Sem internet (PWA offline)**: banner fixo no topo, abaixo do cabeçalho, cor
  `--color-alerta` preenchida — `Sem conexão com a internet. Suas mensagens serão
  enviadas quando ela voltar.` A lista de mensagens e o campo de entrada continuam
  visíveis e utilizáveis por baixo do banner (mensagens ficam em fila, não a tela
  toda trava) — este é o único dos seis que **não** ocupa a tela inteira, por ser
  reversível e temporário; os outros dois abaixo ocupam.
- **Servidor fora do ar** (ao abrir o app ou enviar mensagem, com internet normal):
  tela cheia com `assets/ilustracao-erro-conexao.svg`, texto
  `Não conseguimos falar com o servidor da Cora agora. Tente de novo em alguns
  minutos.` e botão `[Tentar de novo]` centralizado, cor `--color-erro`.
- **Sessão expirada**: tela cheia (substitui completamente a conversa — a sessão não
  é mais válida, não há o que mostrar por baixo), texto
  `Sua sessão expirou por segurança.` e botão `[Entrar de novo]`, que leva à tela 1.
  Nenhum dado da conversa em memória é reenviado automaticamente após reautenticar
  (fora de escopo: sem persistência de histórico).

**Em 360px:** ilustração reduz para o tamanho mínimo que preserva o selo de estado
(a forma que a diferencia da ilustração de vazio); texto e botão empilham em coluna
única, botão em largura cheia menos a margem de 16px, alvo de toque 44px preservado.

### 4. Prompt de instalação do PWA (Android)

Cartão flutuante (`--shadow-flutuante`, `--radius-md`) ancorado na base da tela,
sobre a conversa — não modal de tela cheia, porque a ação é opcional e de baixo risco.

**Estados:**
- **Aparece** (disparado pelo evento `beforeinstallprompt` do navegador, nunca antes
  disso): título `Instalar a Cora no seu celular`, corpo
  `Acesse mais rápido, direto da tela inicial, sem abrir o navegador.`, dois botões
  lado a lado — `Instalar` (primário) e `Agora não` (secundário, texto).
- **Recusado** (`Agora não`): cartão fecha, some da sessão atual; não reaparece na
  mesma sessão para não interromper de novo (evita repetir o incômodo).
- **Aceito** (`Instalar`): cartão fecha imediatamente ao clique — o próprio SO assume
  o fluxo nativo de instalação a partir daí, a tela não precisa de um estado
  "instalando" próprio.

**Em 360px:** cartão ocupa a largura cheia menos 16px de margem de cada lado, fixo a
8px acima do campo de entrada, nunca sobrepõe o botão `Enviar`.

### 5. Primeira execução do app Windows (aviso do SmartScreen)

Não é uma tela do app em si (a janela Tauri abre direto na tela 2 ou 1) — é uma
**página/papel entregue junto do instalador**, mostrado antes de a pessoa clicar em
qualquer coisa. Conteúdo fixo de `textos.md`: título `Antes de instalar a Cora`,
explicação do aviso azul `O Windows protegeu o computador`, passo a passo numerado
(`Mais informações` → `Executar assim mesmo` → seguir a instalação), e uma saída
explícita para dúvida (`entre em contato antes de continuar`).

**Estados:** um único estado — é conteúdo estático, sem interação de sistema (não é
tela do app rodando; PDF ou página impressa entregue pelo dono). Não há vazio,
carregamento ou erro aqui.

**Em 360px:** relevante mesmo sendo estático porque pode ser lido no celular antes de
ir ao computador — texto em coluna única, passos numerados como lista vertical (nunca
lado a lado), sem exigir zoom para ler os nomes exatos dos botões do Windows.

### 6. Menu de conta (sair / trocar de usuário)

Painel deslizante a partir do cabeçalho (não é uma rota nova, é uma sobreposição sobre
a tela 2), fecha ao tocar fora.

**Estados:**
- **Aberto**: mostra `[nome da pessoa] · [e-mail]` no topo (dado real, não de
  demonstração), depois os dois itens `Sair da conta` e `Trocar de usuário` — o
  segundo só aparece se houver mais de uma conta configurada no aparelho.
- **Confirmação de sair**: substitui o painel pelo texto
  `Sair da conta da Cora? Você vai precisar entrar de novo para continuar usando.`
  com `[Cancelar]` e `[Sair]` lado a lado, `[Sair]` na cor `--color-erro` por ser a
  ação que encerra a sessão.
- **Confirmação de trocar**: mesma estrutura,
  `Trocar de usuário? A conversa atual não fica salva — ela é apagada ao sair.`
  com `[Cancelar]` e `[Trocar]`.
- Nenhum dos dois é modal bloqueante com carregamento — a ação é local (limpar
  sessão/cookie) e volta para a tela 1 assim que confirmada.

**Em 360px:** painel ocupa a largura cheia (não é um dropdown ancorado à direita como
em telas largas), desliza de cima para baixo cobrindo a lista de mensagens; os dois
botões de confirmação empilham? Não — ficam lado a lado mesmo em 360px (dois botões
de 44px cabem com folga em 328px úteis), preservando o padrão "cancelar à esquerda,
ação à direita" que a pessoa já viu no resto do sistema.

## textos

Todo texto visível da interface da Fase 4 (tela de login, chat, PWA, app Windows), mais os
dados de demonstração. Convenções: nenhuma palavra em inglês na interface; botão nomeia a
ação; erro diz o que fazer; os cinco estados do resumo operacional (`resumo.ts`) nunca se
fundem. Vocabulário fixo: **"pendência"** (não "tarefa" na interface, mesmo que o dado interno
use `InboxItem`/status — a pessoa não vê schema), **"entrar"** (nunca "login"), **"mensagem"**
(nunca "chat" como substantivo na UI, só como nome do produto quando necessário).

---

### Tela de login

Campos:
- Rótulo do campo de e-mail: `E-mail`
- Rótulo do campo de senha: `Senha`
- Texto de ajuda abaixo do campo de e-mail (fixo, antes de qualquer erro): `Use o e-mail cadastrado pelo administrador.`
- Botão principal: `Entrar`
- Botão em estado de carregamento (texto muda, botão desabilitado): `Entrando…`

Erros (aparecem junto do formulário, não em alerta solto no topo — e nunca dizem qual dos dois campos errou, por segurança):
- Senha ou e-mail errados: `E-mail ou senha não conferem. Confira os dois campos e tente de novo.`
- Conta bloqueada por tentativas: `Conta bloqueada por excesso de tentativas. Espere alguns minutos e tente de novo. Se continuar bloqueada, fale com o administrador.`
- Campo de e-mail vazio ao tentar entrar: `Digite seu e-mail para entrar.`
- Campo de senha vazio ao tentar entrar: `Digite sua senha para entrar.`
- Servidor fora do ar durante o login: `Não conseguimos falar com o servidor agora. Verifique sua conexão e tente de novo.`

Nota de implementação (para quem constrói a tela, não é texto de interface): o campo de senha
não deve mostrar "pontos preenchidos" residuais de uma tentativa anterior depois de um erro —
limpar o campo ou deixar claro que está vazio, para não repetir o fracasso já documentado em
`LoginPage.tsx` do Workspace. Mesma cautela com autofill: se o navegador preencher e-mail e
senha de outra conta, a pessoa precisa perceber isso antes de clicar em "Entrar" — o rótulo
do e-mail preenchido deve ficar visível e legível, nunca escondido atrás do próprio valor.

---

### Tela principal de chat

Cabeçalho:
- Nome do produto na barra superior: `Cora`
- Legenda abaixo do nome (opcional, se houver espaço): `Assistente da MedConsultoria`

Estado vazio — primeira vez aqui (antes de qualquer mensagem):
```
Oi! Eu sou a Cora.
Pergunte "como estão minhas pendências" ou me escreva livremente.
```
Campo de entrada, texto de exemplo (placeholder, some ao digitar): `Escreva uma mensagem…`
Botão de enviar: `Enviar`

Mensagem enviando (aparece junto da mensagem da própria pessoa, enquanto não confirma):
`Enviando…`

Mensagem com erro de envio (a mensagem continua visível, com aviso e ação ao lado — nunca some):
```
Não foi enviada. A conexão falhou no meio do caminho.
[Tentar de novo]
```
Nota: o texto digitado não pode ser perdido — se a pessoa reabrir o rascunho, ele continua lá.

Resposta chegando (indicador de "pensando", já que streaming está fora de escopo):
`Cora está digitando…`

Campo de entrada desabilitado durante o envio (texto de apoio, se necessário): `Aguarde a resposta anterior.`

---

### Os 5 estados do resumo operacional, como citados na conversa

Estes textos vêm do motor (`resumo.ts`, `descreverResumo`) e a tela exibe a frase como
mensagem da Cora, sem reescrever o conteúdo — só formata a moldura da bolha de chat. Listados
aqui para conferência de tom e para os dados de demonstração abaixo baterem com eles.

1. **`erro_de_acesso`** (chip vermelho, ícone de alerta, rótulo `Erro de acesso`):
   > Não consegui consultar tudo: [frase da fonte que falhou]. Isso NÃO quer dizer que você
   > esteja sem pendências — só que não dá para confirmar agora.

2. **`sincronizacao_incompleta`** (chip âmbar preenchido, ícone de relógio, rótulo `Sincronização incompleta`):
   > Vi só parte das suas tarefas (li [N] página(s) e parei). A lista abaixo pode estar
   > faltando item:

3. **`sem_registros`** (chip neutro, sem ícone de alerta, rótulo `Sem registros`):
   > Consultei a lista inteira e o Workspace não devolveu nenhuma tarefa.

4. **`sem_pendencias`** (chip verde, ícone de check, rótulo `Sem pendências`):
   > Consultei a lista inteira: há [N] tarefa(s), e nenhuma está parada esperando por você.

5. **`com_pendencias`** (chip teal, ícone de lista, rótulo `Com pendências`):
   > Você tem [N] tarefa(s) pendente(s):

Regra de exibição herdada do `design.md`: o chip mostra sempre ícone + rótulo em texto — a cor
é reforço, nunca o único sinal (`com_pendencias` e a cor primária são vizinhas de matiz de
propósito).

---

### Erro de conexão

PWA sem internet (banner fixo no topo da tela, some quando a conexão volta):
`Sem conexão com a internet. Suas mensagens serão enviadas quando ela voltar.`

Servidor fora do ar (ao tentar enviar mensagem ou abrir o app, com conexão de internet normal):
```
Não conseguimos falar com o servidor da Cora agora.
Tente de novo em alguns minutos.
[Tentar de novo]
```

Sessão expirada (ao tentar enviar mensagem depois de tempo sem uso):
```
Sua sessão expirou por segurança.
[Entrar de novo]
```

---

### Tela de "instale para acesso rápido" do PWA (prompt de instalação Android)

Título: `Instalar a Cora no seu celular`
Corpo: `Acesse mais rápido, direto da tela inicial, sem abrir o navegador.`
Botão principal: `Instalar`
Botão secundário: `Agora não`

Nome do app na tela inicial (campo `short_name` do manifest, visível embaixo do ícone): `Cora`
Nome completo do app (campo `name` do manifest, visível na loja/instalação): `Cora — Assistente da MedConsultoria`

---

### Mensagem de primeira execução do app Windows (aviso do SmartScreen)

Tela ou papel entregue junto do instalador, antes de a pessoa clicar em qualquer coisa:

```
Antes de instalar a Cora

O Windows vai mostrar um aviso azul chamado "O Windows protegeu o computador".
Isso é esperado — o instalador é novo e ainda não é conhecido do Windows, mas
foi enviado por nós.

O que fazer:
1. Na tela azul, clique em "Mais informações".
2. Clique em "Executar assim mesmo".
3. Siga a instalação normalmente.

Se aparecer qualquer outra mensagem, ou se tiver dúvida, entre em contato antes de continuar.
```

Texto curto, para dentro do próprio instalador (se houver tela de boas-vindas do Tauri):
`Bem-vindo à instalação da Cora. Clique em Avançar para continuar.`

---

### Rodapé/menu: sair da conta, trocar de usuário

Item de menu — encerrar sessão: `Sair da conta`
Confirmação ao clicar em "Sair da conta" (ação de baixo risco — reversível com novo login, então confirmação simples, não exige digitar nome):
```
Sair da conta da Cora?
Você vai precisar entrar de novo para continuar usando.
[Cancelar]  [Sair]
```

Item de menu — trocar de usuário (quando duas contas estão configuradas no mesmo aparelho): `Trocar de usuário`
Ao trocar, tela de confirmação curta:
```
Trocar de usuário?
A conversa atual não fica salva — ela é apagada ao sair.
[Cancelar]  [Trocar]
```

Rótulo do nome da conta logada, no rodapé/menu (exemplo de dado real do sistema, não é dado de demonstração): `[nome da pessoa] · [e-mail]`

---

## dados de demonstração

Fixtures de interface para telas de exemplo, capturas de tela e desenvolvimento local. Todo
identificador segue o prefixo `SYNTH-` do restante do repositório. Nenhum nome, convênio ou
horário aqui corresponde a pessoa ou clínica real.

### Contas de demonstração (login)

| Nome | E-mail | Papel |
|---|---|---|
| Thaís Amaral Bezerra | `SYNTH-thais@clinica-demo.teste` | fundadora |
| Rogério Vasconcelos Lima | `SYNTH-rogerio@clinica-demo.teste` | administrador |

### Pendências de exemplo (estado `com_pendencias`)

```
- Retorno de Dra. Camila Bittencourt Teixeira, convênio Amparo Saúde, 14h30
  [PENDENTE, prioridade alta, id SYNTH-TASK-0142, fonte workspace:tasks]
- Encaixe de avaliação inicial, convênio particular, aguardando confirmação de horário
  [PENDENTE, prioridade média, id SYNTH-TASK-0143, fonte workspace:tasks]
- Renovação de credenciamento com convênio Vitalis Planos de Saúde
  [PENDENTE, prioridade alta, id SYNTH-TASK-0144, fonte workspace:tasks]
- Confirmação de exame de imagem para retorno de segunda-feira
  [PENDENTE, prioridade baixa, id SYNTH-TASK-0145, fonte workspace:tasks]
```

Frase de exemplo completa, como apareceria na conversa:
> Você tem 4 tarefa(s) pendente(s):
>
> Fonte workspace:tasks:
> - Retorno de Dra. Camila Bittencourt Teixeira, convênio Amparo Saúde, 14h30 [PENDENTE, prioridade alta, id SYNTH-TASK-0142, fonte workspace:tasks]
> - Encaixe de avaliação inicial, convênio particular, aguardando confirmação de horário [PENDENTE, prioridade média, id SYNTH-TASK-0143, fonte workspace:tasks]
> - Renovação de credenciamento com convênio Vitalis Planos de Saúde [PENDENTE, prioridade alta, id SYNTH-TASK-0144, fonte workspace:tasks]
> - Confirmação de exame de imagem para retorno de segunda-feira [PENDENTE, prioridade baixa, id SYNTH-TASK-0145, fonte workspace:tasks]

### Exemplo de item com procedimento e horário (para telas de conversa livre)

```
- Consulta de retorno — Cardiologia, convênio Amparo Saúde, 09h00, sala 2
  [FAZENDO, prioridade média, id SYNTH-TASK-0151, fonte workspace:tasks]
- Primeira consulta — Ortopedia, particular, 11h15
  [PENDENTE, prioridade alta, id SYNTH-TASK-0152, fonte workspace:tasks]
```

### Exemplo de mensagem livre da pessoa, para captura de tela da conversa

`Quais convênios têm consulta marcada essa semana?`

### Exemplo de resposta livre da Cora (curta, sem markdown, conforme fora_de_escopo)

`Essa semana há consultas marcadas para Amparo Saúde e Vitalis Planos de Saúde, além de dois atendimentos particulares. Quer que eu liste os horários?`

### Exemplo de erro de fonte (para o estado `erro_de_acesso` em captura de tela)

`Não consegui acessar o Workspace agora — a conexão falhou.`

## assets

Papel: Diretor de mídia. Pergunta que guiou cada item: **essa imagem existe, é livre, é
leve e combina?** Resposta curta: nada preexistia (busquei em `apps/`, `packages/` e na raiz
— não há logo, ícone nem wordmark no repositório hoje), tudo abaixo foi gerado por código
(skill `imagem-por-codigo`), então "livre" é automático, "leve" é medido (SVG puro, sem
raster embutido, cada arquivo abaixo de 1,5 KB) e "combina" porque cada cor vem literalmente
dos tokens de `design.md` — nenhum hex novo foi inventado.

Origem, autor e licença de cada arquivo — inclusive o gerado — estão em
`assets/CREDITOS.md`, como a regra do repositório exige.

### A marca

Um monograma geométrico — um arco "C" aberto à direita (traço, não glifo de fonte, para
ficar nítido em 16 px) sobre fundo `--color-primary`. Único elemento visual novo desta fase;
tudo o mais deriva dele.

- **`assets/favicon.svg`** — 32×32, aba do navegador e atalho do PWA. Inclui
  `prefers-color-scheme` embutido no próprio arquivo (troca de cor sozinho no tema escuro do
  SO, sem depender de o app estar aberto).
- **`assets/icon-any.svg`** — 512×512, ícone "any" do `manifest.json` (fundo arredondado,
  cantos próprios, não preenche a borda).
- **`assets/icon-maskable.svg`** — 512×512, ícone "maskable" do `manifest.json`: sangria até
  a borda, marca contida no círculo de segurança de 40% — o Android pode recortar em
  qualquer forma (círculo, "squircle") sem cortar o "C".
- **`assets/icon-windows-source.svg`** — 1024×1024, fonte para o instalador Windows/Tauri.

### A marca com o nome

- **`assets/wordmark-lockup.svg`** — marca + "Cora" em Inter 600, para o cabeçalho da tela de
  login e do chat.
- **`assets/wordmark-only.svg`** — só o nome, para espaço estreito.

Os dois usam `var(--color-*, <fallback oklch>)`: herdam o tema quando inseridos inline no
HTML (recomendado) e caem no valor claro se algum dia forem usados como arquivo solto.

### Estados da tela

- **`assets/ilustracao-vazio.svg`** — "sem pendências" e "primeira conversa" (lista vazia).
  Cartão de lista + selo de concluído, na cor `--color-sucesso` — a mesma cor semântica do
  chip `sem_pendencias` em `resumo.ts`, de propósito, para a ilustração não inventar um
  significado que o dado não tem.
- **`assets/ilustracao-erro-conexao.svg`** — "não consegui consultar" / falha de rede. Sinal
  cortado + selo de alerta, na cor `--color-erro`. É visualmente distinta da anterior em
  forma e cor, não só em texto — a mesma disciplina que `design.md` exige dos chips de
  estado (restrição 1 do painel).

Todas as ilustrações e wordmarks usam `var(--color-*)` com fallback e devem ser **inseridas
inline no HTML** (não via `<img src>`), para herdar claro/escuro automaticamente. Os quatro
ícones de app (`favicon`, `icon-any`, `icon-maskable`, `icon-windows-source`) são arquivos
autônomos por natureza — cor gravada em `oklch()` direto no arquivo, porque um favicon ou um
ícone de PWA é carregado fora do documento e não vê as variáveis CSS da página.

### O que falta — e por quê não está aqui

Nenhuma foto. A avaliação da ordem de trabalho se confirmou: isto é uma ferramenta interna
de chat, não site de marketing, e nada na tela pede imagem realista — login, lista, vazio e
erro em 360px, exatamente o que `design.md` desenha. Não há geração de foto realista dentro
do Claude Code (limite declarado), e mesmo se houvesse, não haveria onde usá-la aqui.

O que falta é **trabalho de build, não de mídia**, e fica registrado para quem escrever
`apps/web`/`apps/desktop` (nenhum dos dois existe ainda neste repositório):

- **PNG 192×192 e 512×512** para o `manifest.json` (a partir de `icon-any.svg` e
  `icon-maskable.svg`) — este ambiente não tem `sharp`, ImageMagick nem `rsvg-convert`
  instalados para rasterizar agora; é um passo de build de um comando (`pwa-asset-generator`
  ou `sharp-cli`), não um asset que falta desenhar.
- **`icon.ico`** do Windows — não se desenha à mão: o comando `tauri icon
  icon-windows-source.svg` (Tauri v2 CLI) já gera todos os tamanhos e o `.ico` sozinho a
  partir do arquivo entregue aqui, na máquina Windows do dono, no momento do build do
  instalador (`spec.md` já marca esse build como manual, fora de CI).
- **Apple touch icon / manifest iOS** — não falta: iOS está fora de escopo desta fase
  (`spec.md`, PWA é Android).

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
  "background_color": "#FCFCFD",
  "theme_color": "#003591",
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

- **`background_color`/`theme_color` corrigidos para a identidade real da MedConsultoria
  (atualizado após o dono pedir a marca real do Workspace, substituindo a paleta
  fictícia do painel adversarial original).** `theme_color: #003591` é o azul da marca
  (Manual da Marca p.14, "fonte azul" — o mesmo valor de `--color-primary` em
  `packages/ui/tailwind-preset.js` do Workspace); é a cor da splash screen do Android e
  da barra de status/título. `#FCFCFD` é o hex mais próximo de
  `--color-background: oklch(0.984 0.003 248)`. O papel de implementação deve gerar o hex
  exato por conversão OKLCH→sRGB na hora de codar — os
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

