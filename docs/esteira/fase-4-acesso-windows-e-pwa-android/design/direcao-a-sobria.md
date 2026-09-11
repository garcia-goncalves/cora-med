# Direção A — Sóbria e institucional

Proposta cega de Diretor de arte para a tela de chat da Cora (Fase 4). Não vi as outras
duas propostas.

## 1. A sensação, em uma frase

Abrir o app deve sentir-se como abrir o extrato do banco da empresa, não a recepção de
uma clínica: sério, exato, sem enfeite — e mesmo assim com um toque de calor humano no
que confirma que deu certo, para não virar terminal frio.

## 2. Paleta

Base neutra levemente azulada (hue 250, chroma quase zero — nunca cinza puro morto),
uma única cor de marca (`primary`, um azul-petróleo profundo, nada de azul-clichê de
hospital), e cores funcionais desviadas dela por luminosidade, não por matizes
concorrentes. Contraste AA (4,5:1 texto normal) conferido nos dois temas.

| Token | Papel | Claro | Escuro |
|---|---|---|---|
| `--color-background` | fundo da página | `oklch(0.98 0.004 250)` | `oklch(0.16 0.010 250)` |
| `--color-foreground` | texto principal | `oklch(0.20 0.020 250)` | `oklch(0.95 0.006 250)` |
| `--color-muted` | fundo secundário (linha de lista, cartão) | `oklch(0.95 0.007 250)` | `oklch(0.22 0.012 250)` |
| `--color-muted-foreground` | texto de apoio, timestamp | `oklch(0.46 0.015 250)` | `oklch(0.70 0.012 250)` |
| `--color-border` | traço, divisória, contorno de campo | `oklch(0.89 0.010 250)` | `oklch(0.31 0.014 250)` |
| `--color-primary` | ação primária (enviar, entrar) | `oklch(0.38 0.085 255)` | `oklch(0.68 0.095 255)` |
| `--color-primary-foreground` | texto sobre `primary` | `oklch(0.99 0.004 250)` | `oklch(0.15 0.012 255)` |
| `--color-primary-hover` | hover/active de `primary` | `oklch(0.33 0.085 255)` | `oklch(0.74 0.095 255)` |

**Cores dos cinco estados do resumo operacional** — cada uma com papel distinto, para que
a tela nunca funda o que a Fase 3 já separou:

| Estado (`resumo.ts`) | Leitura | Cor | Claro | Escuro |
|---|---|---|---|---|
| `sem_pendencias` | tudo certo | sucesso | `oklch(0.52 0.13 150)` | `oklch(0.72 0.13 150)` |
| `com_pendencias` | atenção, algo para ver | acento (teal, não confunde com botão azul) | `oklch(0.50 0.095 200)` | `oklch(0.72 0.10 200)` |
| `sincronizacao_incompleta` | dado parcial, cautela | alerta (âmbar) | `oklch(0.68 0.14 80)` | `oklch(0.78 0.13 80)` |
| `erro_de_acesso` | falha real, exige ação | erro | `oklch(0.55 0.19 25)` | `oklch(0.70 0.17 25)` |
| `sem_registros` | nunca houve dado — não é erro | neutro (mesma cor de `muted-foreground`) | `oklch(0.46 0.015 250)` | `oklch(0.70 0.012 250)` |

`sem_registros` usa neutro de propósito: é a única frase das cinco que não deve puxar o
olho — "nunca houve nada aqui" é informação de fundo, não alerta. As outras quatro têm
matiz própria e nenhuma reaproveita a matiz de outra, exatamente para que "sem
pendências" (verde) nunca seja confundida com "sincronização incompleta" (âmbar) no canto
do olho de alguém apressado.

## 3. Escala tipográfica

**Inter** (Google Fonts, licença SIL Open Font License — igual à da maioria dos painéis
bancários sóbrios, inclusive o que inspira esta direção). Carregar via `@font-face`
auto-hospedado no build do Vite (não `<link>` para fonts.googleapis.com em produção — o
mesmo motivo do guia de web moderno: evita domínio extra no caminho crítico).

Razão **1,25**, base 16 — interface densa, não página de marketing:

| Nível | Tamanho | Peso | Uso |
|---|---|---|---|
| `--text-xs` | 12px | 400 | timestamp, legenda |
| `--text-sm` | 14px | 400 | texto de apoio, rótulo |
| `--text-base` | 16px | 400 | corpo, mensagem do chat |
| `--text-lg` | 20px | 600 | título de seção |
| `--text-xl` | 25px | 700 | título de tela (ex.: "Entrar") |

Só três pesos: 400 (texto), 600 (ênfase, rótulo de estado), 700 (título). Altura de linha
1,5 no corpo, 1,2 em título. Largura de bolha de mensagem limitada a ~65ch.

## 4. Espaçamento

Base 4px, escala `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`. Regra de proximidade: 8px entre
rótulo e campo, 24px entre campos de grupos diferentes (ex.: bloco de login vs. bloco de
"esqueci"), 16px de respiro lateral mínimo em qualquer largura de tela.

## 5. Forma

- **Raio:** base `8px` (campo, botão, bolha de mensagem); cartão e modal `12px`; avatar
  e indicador de estado, `9999px` (cheio).
- **Sombra:** só para elevação, nunca decoração. Três níveis — repouso (nenhuma), cartão
  (`0 1px 2px oklch(0.20 0.02 250 / 0.06)`), flutuante/menu
  (`0 8px 24px oklch(0.20 0.02 250 / 0.12)`). No escuro, sombra quase não se vê: elevação
  ali é fundo mais claro (`--color-muted` em vez de `--color-background`), não sombra mais
  forte.
- **Densidade:** compacta-confortável — linhas de lista com `padding: 12px 16px` (não
  16/24, que seria respirado demais para alguém lendo pendências entre uma ligação e
  outra), mas nunca abaixo de 44px de alvo de toque, porque o uso real é o polegar de
  Thaís no celular.

## 6. Referência honesta

**Mercury** (mercury.com, painel bancário para empresas): neutros quase-cinza com leve
matiz fria, uma cor de marca só, densidade de informação alta sem parecer apertado, cor
funcional (verde/âmbar/vermelho) usada com parcimônia e nunca como decoração. É a prova
de que "sério" e "sem ansiedade" não se excluem — o oposto do azul-clichê genérico de
site de clínica. Contraste de disciplina: Linear (linear.app) confirma que restringir a
paleta a poucas cores com papel único, em vez de "tema colorido", é o que faz uma
interface parecer profissional em vez de decorada.

## 7. Tokens CSS

```css
/* ---------- Claro (padrão) ---------- */
:root {
  color-scheme: light;

  /* Cor — neutros */
  --color-background: oklch(0.98 0.004 250);
  --color-foreground: oklch(0.20 0.020 250);
  --color-muted: oklch(0.95 0.007 250);
  --color-muted-foreground: oklch(0.46 0.015 250);
  --color-border: oklch(0.89 0.010 250);

  /* Cor — ação */
  --color-primary: oklch(0.38 0.085 255);
  --color-primary-foreground: oklch(0.99 0.004 250);
  --color-primary-hover: oklch(0.33 0.085 255);

  /* Cor — estados do resumo operacional (Fase 3) */
  --color-sucesso: oklch(0.52 0.130 150);           /* sem_pendencias */
  --color-sucesso-foreground: oklch(0.99 0.004 150);
  --color-acento: oklch(0.50 0.095 200);            /* com_pendencias */
  --color-acento-foreground: oklch(0.99 0.004 200);
  --color-alerta: oklch(0.68 0.140 80);             /* sincronizacao_incompleta */
  --color-alerta-foreground: oklch(0.22 0.030 80);
  --color-erro: oklch(0.55 0.190 25);               /* erro_de_acesso */
  --color-erro-foreground: oklch(0.99 0.004 25);
  --color-neutro-estado: oklch(0.46 0.015 250);     /* sem_registros — mesma cor de muted-foreground, de propósito */

  /* Tipografia */
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
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

  /* Espaçamento */
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-12: 3rem;    /* 48px */
  --space-16: 4rem;    /* 64px */

  /* Forma */
  --radius-sm: 0.5rem;   /* 8px — campo, botão, bolha */
  --radius-md: 0.75rem;  /* 12px — cartão, modal */
  --radius-full: 9999px; /* avatar, indicador de estado */

  --shadow-card: 0 1px 2px oklch(0.20 0.02 250 / 0.06);
  --shadow-flutuante: 0 8px 24px oklch(0.20 0.02 250 / 0.12);

  --focus-ring: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-primary);
}

/* ---------- Escuro ---------- */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;

    --color-background: oklch(0.16 0.010 250);
    --color-foreground: oklch(0.95 0.006 250);
    --color-muted: oklch(0.22 0.012 250);
    --color-muted-foreground: oklch(0.70 0.012 250);
    --color-border: oklch(0.31 0.014 250);

    --color-primary: oklch(0.68 0.095 255);
    --color-primary-foreground: oklch(0.15 0.012 255);
    --color-primary-hover: oklch(0.74 0.095 255);

    --color-sucesso: oklch(0.72 0.130 150);
    --color-sucesso-foreground: oklch(0.15 0.020 150);
    --color-acento: oklch(0.72 0.100 200);
    --color-acento-foreground: oklch(0.15 0.020 200);
    --color-alerta: oklch(0.78 0.130 80);
    --color-alerta-foreground: oklch(0.18 0.025 80);
    --color-erro: oklch(0.70 0.170 25);
    --color-erro-foreground: oklch(0.15 0.020 25);
    --color-neutro-estado: oklch(0.70 0.012 250);

    /* Elevação no escuro é fundo mais claro, não sombra mais forte */
    --shadow-card: 0 1px 2px oklch(0 0 0 / 0.35);
    --shadow-flutuante: 0 8px 24px oklch(0 0 0 / 0.45);

    --focus-ring: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-primary);
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;

  --color-background: oklch(0.16 0.010 250);
  --color-foreground: oklch(0.95 0.006 250);
  --color-muted: oklch(0.22 0.012 250);
  --color-muted-foreground: oklch(0.70 0.012 250);
  --color-border: oklch(0.31 0.014 250);

  --color-primary: oklch(0.68 0.095 255);
  --color-primary-foreground: oklch(0.15 0.012 255);
  --color-primary-hover: oklch(0.74 0.095 255);

  --color-sucesso: oklch(0.72 0.130 150);
  --color-sucesso-foreground: oklch(0.15 0.020 150);
  --color-acento: oklch(0.72 0.100 200);
  --color-acento-foreground: oklch(0.15 0.020 200);
  --color-alerta: oklch(0.78 0.130 80);
  --color-alerta-foreground: oklch(0.18 0.025 80);
  --color-erro: oklch(0.70 0.170 25);
  --color-erro-foreground: oklch(0.15 0.020 25);
  --color-neutro-estado: oklch(0.70 0.012 250);

  --shadow-card: 0 1px 2px oklch(0 0 0 / 0.35);
  --shadow-flutuante: 0 8px 24px oklch(0 0 0 / 0.45);
}
```
