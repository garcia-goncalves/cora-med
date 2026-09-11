# Direção B — Calorosa e humana

Proposta cega de Diretor de Arte (1 de 3), skill `esteira` fase 3 (Design), para a tela
de chat da Cora (`docs/esteira/fase-4-acesso-windows-e-pwa-android/spec.md`). Lida contra
`lentes/analista.md`: quem usa é a Thaís, no celular, entre compromissos, perguntando "como
estão minhas pendências" — e o dono, em acompanhamento espaçado, mais no Windows.

## 1. A sensação, em uma frase

Abrir a Cora deve parecer puxar a cadeira da colega que resolve as coisas com você — não
entrar num app de bem-estar nem bater num painel técnico frio.

## 2. Paleta

Base neutra **quente** (creme, não cinza-azulado) e uma única cor de marca — terracota —
em vez de duas cores de marca competindo. Os cinco estados do resumo operacional da Fase 3
usam a mesma lógica de cor que erro/sucesso/neutro, para que a tela nunca funda "sem
pendências" com "não consegui checar" (a garantia que a Fase 3 já construiu no dado, que a
lente do Analista marca como fracasso se a tela desfizer).

### Modo claro

| Token | Hex | Papel |
|---|---|---|
| `background` | `#FDFBF9` | fundo da página, branco com sopro quente |
| `foreground` | `#2B2420` | texto principal, marrom quase preto |
| `muted-bg` | `#F4EFE9` | fundo secundário (bolha da Cora, cartão) |
| `muted-fg` | `#7A6F63` | texto de apoio, timestamp |
| `border` | `#E3DAD0` | traço, divisória, contorno de campo |
| `primary` | `#C1562F` | ação principal — enviar, entrar |
| `primary-hover` | `#A8451F` | hover/active do primário |
| `primary-foreground` | `#FFF8F3` | texto sobre o primário |
| `accent` | `#B8842E` | destaque secundário, badge |
| `destructive` | `#B3261E` | erro, falha de envio, apagar |
| `success` | `#4F7A52` | confirmação |
| `warning` | `#C98A1D` | alerta que não é erro |
| `focus-ring` | `#C1562F` | anel de foco, 3:1 mínimo contra o fundo |

**Contraste conferido:** `foreground` sobre `background` ≈ 14,8:1; `primary-foreground`
sobre `primary` ≈ 6,3:1; `muted-fg` sobre `background` ≈ 4,7:1 (passa AA para texto
normal). `primary` sobre `background` ≈ 5,1:1 — passa para texto e para componente de UI.

### Os cinco estados do resumo operacional (Fase 3)

Cada estado tem cor de texto/ícone e um fundo de tonalidade baixa (tint) — nunca só cor de
texto, porque cor sozinha falha para quem não distingue cor (regra que a skill de
acessibilidade cobra, e que aqui é ainda mais crítica: os cinco estados existem
*exatamente* para não se confundirem).

| Estado | Cor | Fundo (tint) | Leitura |
|---|---|---|---|
| `com_pendencias` | `#C1562F` (primary) | `#FBE8DE` | precisa de atenção, mas é rotina — mesma cor da ação principal, não é alarme |
| `sem_pendencias` | `#4F7A52` (success) | `#EDF3EA` | tudo em dia |
| `sincronizacao_incompleta` | `#C98A1D` (warning) | `#FCF1DE` | parcial, não é erro nem sucesso pleno |
| `erro_de_acesso` | `#B3261E` (destructive) | `#FBEAE7` | falhou de verdade, precisa de ação |
| `sem_registros` | `#8A7D6E` (neutro, nem success nem destructive) | `#F4EFE9` | vazio de verdade — visualmente **discreto**, para não parecer nem conquista nem problema |

### Modo escuro

Nunca preto puro nem branco puro; chroma da marca reduzido para não vibrar sobre fundo
escuro; elevação vira "mais claro", não sombra.

| Token | Hex |
|---|---|
| `background` | `#211B17` |
| `foreground` | `#F2EAE2` |
| `muted-bg` | `#2E2620` |
| `muted-fg` | `#B3A79A` |
| `border` | `#3D332B` |
| `primary` | `#E07A4C` |
| `primary-hover` | `#EA8E63` |
| `primary-foreground` | `#241209` |
| `accent` | `#D6A94F` |
| `destructive` | `#E5655A` |
| `success` | `#7FA876` |
| `warning` | `#E0A83D` |
| `focus-ring` | `#E07A4C` |

| Estado (escuro) | Cor | Fundo (tint) |
|---|---|---|
| `com_pendencias` | `#E07A4C` | `#3A2418` |
| `sem_pendencias` | `#7FA876` | `#223324` |
| `sincronizacao_incompleta` | `#E0A83D` | `#3A2E17` |
| `erro_de_acesso` | `#E5655A` | `#3A211D` |
| `sem_registros` | `#A99C8D` | `#2E2620` |

## 3. Escala tipográfica

**Manrope**, Google Fonts, SIL Open Font License 1.1 (livre para uso comercial,
redistribuição e modificação). Escolhida em vez de Inter porque os terminais levemente
arredondados leem como mais acolhedores sem perder o ar de ferramenta de trabalho — é uma
geométrica séria, não uma fonte "fofa". Auto-hospedada (baixar os `.woff2` e servir junto
do build da SPA; nunca `<link>` para `fonts.googleapis.com` em produção — evita salto de
layout e requisição a terceiro no caminho crítico). Fallback de sistema:
`Manrope, "Segoe UI", system-ui, sans-serif` (o `Segoe UI` importa aqui: é o app Windows
via Tauri, e o fallback deve parecer nativo se a fonte falhar ao carregar).

Base 16px, razão 1,25 (terça maior — interface densa, não página de marketing):

| Token | px | Uso |
|---|---|---|
| `text-xs` | 12 | timestamp, legenda |
| `text-sm` | 14 | texto de apoio, rótulo |
| `text-base` | 16 | corpo — mensagem de chat, nunca menor |
| `text-lg` | 20 | nome de estado no resumo, subtítulo |
| `text-xl` | 25 | título de tela (login, cabeçalho do chat) |

Só dois pesos: `400` (texto corrido) e `600` (ênfase, nome de estado, botão). Sem `700` —
numa tela de chat com cinco pesos disponíveis, a tentação é grifar demais; dois pesos
bastam e mantêm a leitura calma. Altura de linha `1,5` no corpo, `1,2` no título.
Letter-spacing `-0.01em` só no `text-xl`.

## 4. Espaçamento

Base 4px: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`.

Regra de proximidade aplicada ao chat: `gap` interno de uma bolha de mensagem (entre
avatar, nome e texto) = `8px`; espaço entre uma mensagem e a próxima do mesmo autor =
`8px`; espaço entre mensagens de autores diferentes = `24px`. É essa diferença — não a cor
— que faz o olho separar "conversa" em turnos, do jeito que WhatsApp e Slack já ensinaram
todo mundo a ler.

## 5. Forma

- **Raio:** base `0.625rem` (10px) para campo de texto e botão; `0.875rem` (14px) para
  bolha de mensagem e cartão do resumo — levemente mais arredondado que o controle, porque
  é o elemento que "acolhe" o conteúdo; avatar em círculo completo.
- **Sombra:** só dois níveis, e com tinta quente (nunca preto puro), porque sombra decora
  pouco e indica elevação: `elevado` (cartão de resumo sobre o fundo) e `flutuante`
  (indicador de "pensando", toast de erro de envio). Repouso não tem sombra.
- **Densidade:** confortável, não compacta — é uma conversa, não uma planilha. Altura
  mínima de alvo tocável `44px` (crítico no PWA Android, onde a Thaís usa o polegar em
  movimento, não o mouse).

## 6. Referência honesta

Inspira-se no tom do **37signals (Basecamp/HEY)** — cor quente, tipografia direta, sem
gradiente nem ícone fofo, e a prova real de que "humano" e "ferramenta de trabalho séria"
não se excluem — e na estrutura de conversa operacional do **Front** (inbox de
atendimento onde cada mensagem carrega estado e contexto, não só texto solto). Não se
inspira em app de meditação/bem-estar (paleta pastel, ícone arredondado demais, mascote):
é o oposto do que a Thaís precisa às 11h de uma segunda-feira entre duas ligações com
operadora.

## 7. Tokens CSS

```css
:root {
  /* cor — modo claro */
  --color-background: #FDFBF9;
  --color-foreground: #2B2420;
  --color-muted-bg: #F4EFE9;
  --color-muted-fg: #7A6F63;
  --color-border: #E3DAD0;
  --color-primary: #C1562F;
  --color-primary-hover: #A8451F;
  --color-primary-foreground: #FFF8F3;
  --color-accent: #B8842E;
  --color-destructive: #B3261E;
  --color-success: #4F7A52;
  --color-warning: #C98A1D;
  --color-focus-ring: #C1562F;

  /* estados do resumo operacional — modo claro */
  --state-com-pendencias-fg: #C1562F;
  --state-com-pendencias-bg: #FBE8DE;
  --state-sem-pendencias-fg: #4F7A52;
  --state-sem-pendencias-bg: #EDF3EA;
  --state-sincronizacao-incompleta-fg: #C98A1D;
  --state-sincronizacao-incompleta-bg: #FCF1DE;
  --state-erro-de-acesso-fg: #B3261E;
  --state-erro-de-acesso-bg: #FBEAE7;
  --state-sem-registros-fg: #8A7D6E;
  --state-sem-registros-bg: #F4EFE9;

  /* tipografia */
  --font-family-base: "Manrope", "Segoe UI", system-ui, sans-serif;
  --text-xs: 0.75rem;   /* 12px */
  --text-sm: 0.875rem;  /* 14px */
  --text-base: 1rem;    /* 16px */
  --text-lg: 1.25rem;   /* 20px */
  --text-xl: 1.5625rem; /* 25px */
  --font-weight-regular: 400;
  --font-weight-emphasis: 600;
  --line-height-body: 1.5;
  --line-height-title: 1.2;
  --letter-spacing-title: -0.01em;

  /* espaçamento */
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-12: 3rem;    /* 48px */
  --space-16: 4rem;    /* 64px */

  /* forma */
  --radius-control: 0.625rem;  /* 10px — campo, botão */
  --radius-surface: 0.875rem;  /* 14px — bolha, cartão */
  --radius-full: 9999px;       /* avatar */
  --shadow-elevado: 0 2px 8px -2px oklch(0.45 0.08 40 / 0.16);
  --shadow-flutuante: 0 8px 24px -4px oklch(0.45 0.08 40 / 0.22);
  --target-tocavel-min: 2.75rem; /* 44px */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-background: #211B17;
    --color-foreground: #F2EAE2;
    --color-muted-bg: #2E2620;
    --color-muted-fg: #B3A79A;
    --color-border: #3D332B;
    --color-primary: #E07A4C;
    --color-primary-hover: #EA8E63;
    --color-primary-foreground: #241209;
    --color-accent: #D6A94F;
    --color-destructive: #E5655A;
    --color-success: #7FA876;
    --color-warning: #E0A83D;
    --color-focus-ring: #E07A4C;

    --state-com-pendencias-fg: #E07A4C;
    --state-com-pendencias-bg: #3A2418;
    --state-sem-pendencias-fg: #7FA876;
    --state-sem-pendencias-bg: #223324;
    --state-sincronizacao-incompleta-fg: #E0A83D;
    --state-sincronizacao-incompleta-bg: #3A2E17;
    --state-erro-de-acesso-fg: #E5655A;
    --state-erro-de-acesso-bg: #3A211D;
    --state-sem-registros-fg: #A99C8D;
    --state-sem-registros-bg: #2E2620;

    --shadow-elevado: 0 2px 8px -2px oklch(0.1 0.02 40 / 0.45);
    --shadow-flutuante: 0 8px 24px -4px oklch(0.1 0.02 40 / 0.55);
  }
}

:root[data-theme="dark"] {
  --color-background: #211B17;
  --color-foreground: #F2EAE2;
  --color-muted-bg: #2E2620;
  --color-muted-fg: #B3A79A;
  --color-border: #3D332B;
  --color-primary: #E07A4C;
  --color-primary-hover: #EA8E63;
  --color-primary-foreground: #241209;
  --color-accent: #D6A94F;
  --color-destructive: #E5655A;
  --color-success: #7FA876;
  --color-warning: #E0A83D;
  --color-focus-ring: #E07A4C;

  --state-com-pendencias-fg: #E07A4C;
  --state-com-pendencias-bg: #3A2418;
  --state-sem-pendencias-fg: #7FA876;
  --state-sem-pendencias-bg: #223324;
  --state-sincronizacao-incompleta-fg: #E0A83D;
  --state-sincronizacao-incompleta-bg: #3A2E17;
  --state-erro-de-acesso-fg: #E5655A;
  --state-erro-de-acesso-bg: #3A211D;
  --state-sem-registros-fg: #A99C8D;
  --state-sem-registros-bg: #2E2620;

  --shadow-elevado: 0 2px 8px -2px oklch(0.1 0.02 40 / 0.45);
  --shadow-flutuante: 0 8px 24px -4px oklch(0.1 0.02 40 / 0.55);
}
```
