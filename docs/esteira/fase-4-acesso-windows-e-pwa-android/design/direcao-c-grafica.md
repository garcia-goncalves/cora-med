# Direção C — Gráfica e Ousada

Proposta cega de Diretor de Arte para a Fase 4 (acesso Windows e PWA Android). Não vi as
outras duas propostas.

## 1. A sensação, em uma frase

Abrir o app e sentir que está usando uma ferramenta feita por gente que se importa com
precisão — não o azul-clichê de painel corporativo, e sim a energia contida de um
instrumento de trabalho rápido, com identidade própria e confiança visual, sem soar
brinquedo.

## 2. Paleta

Base: violeta-grape como cor de marca (uma matiz só, derivada em tudo — inclusive nos
neutros, que carregam um traço dessa matiz em vez de cinza puro). Lima elétrica entra só
como destaque secundário gráfico, em doses pequenas, nunca em bloco de texto.

| Papel | Light | Dark | Nota |
|---|---|---|---|
| Fundo (`background`) | `#FBF7FF` | `#150D1F` | quase-branco/quase-preto com sopro de violeta, nunca puros |
| Superfície (`surface`, cartão) | `#F3EAFB` | `#1F1430` | um degrau acima do fundo |
| Texto principal (`foreground`) | `#1A1025` | `#F1E9FB` | tinta violeta-escura / quase-branco violeta |
| Texto secundário (`foreground-muted`) | `#5B4B6E` | `#B9A8CE` | legendas, timestamp, rótulo |
| Borda (`border`) | `#DCCBEE` | `#3A2A52` | contorno de campo, divisória, cartão |
| Ação primária (`primary`) | `#8B2FC7` | `#A855F7` | botão de enviar, link, foco |
| Ação primária — hover/pressed | `#6B2199` | `#C084FC` | −0,09 de L a partir do primary |
| Destaque secundário (`accent`) | `#C6F135` | `#D4F76A` | lima elétrica — chip, indicador ativo, nunca texto corrido |
| Erro (`destructive`) | `#E11D48` | `#FB7185` | texto de erro, botão destrutivo |
| Sucesso (`success`) | `#12B76A` | `#34D399` | confirmação |
| Alerta (`warning`) | `#F59E0B` | `#FBBF24` | atenção — **texto escuro sobre ele**, nunca branco |

### Os cinco estados do resumo operacional (Fase 3)

A tela não pode fundir esses cinco em "carregando" genérico — cada um tem cor e ícone
próprios, nunca só texto:

| Estado | Cor | Papel semântico |
|---|---|---|
| `com_pendencias` | `primary` (violeta) | "tem o que fazer, vá olhar" — mesma cor da ação, porque *é* uma chamada à ação |
| `sem_pendencias` | `success` (verde) | tudo certo, confirmado |
| `sincronizacao_incompleta` | `warning` (âmbar) | parcial, degradado — atenção, não alarme |
| `erro_de_acesso` | `destructive` (rosa-vermelho) | falha real, algo quebrou |
| `sem_registros` | neutro dedicado `#8B7B9E` / `#9E8CB5` (dark) | informativo, **não é erro nem sucesso** — precisa de uma quarta cor própria para não ser lido como "deu certo" (verde) nem "deu errado" (vermelho) |

Contraste conferido nos dois temas: `foreground` sobre `background` passa ~15:1 (light) e
~14:1 (dark); `primary` como fundo de botão com texto branco passa ~5,5:1 em ambos os
temas; `warning` como fundo exige texto escuro (`#1A1025`), não branco — âmbar claro
reprova AA com texto branco.

## 3. Escala tipográfica

Duas famílias, contraste deliberado — não duas sans parecidas competindo:

- **Space Grotesk** (Google Fonts, licença SIL Open Font License 1.1) para título, número
  grande do resumo e nome da Cora — geométrica, um pouco excêntrica, é o que dá a
  personalidade gráfica sem virar decoração.
- **Inter** (Google Fonts, SIL OFL 1.1) para corpo, mensagem de chat e rótulo — a
  legibilidade rápida que o uso real (Thaís no celular, entre compromissos) exige.

Carregadas via `next/font`/self-host de build, nunca `<link>` de terceiro em produção.

Escala, base 16px, razão 1,25 (interface densa):

```
12 · 14 · 16 · 20 · 25 · 31 · 39 · 49
```

Pesos — três no total: Inter 400 (corpo) e 600 (ênfase, rótulo de botão); Space Grotesk 700
(título, número do resumo). Corpo de texto nunca abaixo de 16px; linha de mensagem com
altura 1,5; título com 1,15 e `letter-spacing: -0.02em`.

## 4. Espaçamento

Base 4px, escala: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`.

Regra de proximidade: espaço entre rótulo e campo = 4–8; espaço entre grupos de campo =
24–32; espaço entre bolha de mensagem e a próxima = 12 (mesmo remetente) / 24 (troca de
remetente). Densidade média-compacta — é ferramenta de leitura rápida, não editorial.

## 5. Forma

- **Raio base 12px** (`0.75rem`) em campo e botão; cartão/bolha de mensagem em 18px
  (`1.125rem`, base × 1,5); avatar e indicador de estado em raio total. Chunky, não
  arredondado-a-esmo — é o traço gráfico mais visível da direção.
- **Borda em vez de sombra suave**: cartão e bolha de mensagem levam contorno sólido de
  1,5px em `border` — estética de bloco de cor definido, não de camada flutuando. Sombra
  reservada a elemento realmente sobreposto (modal de confirmação, menu) — três níveis:
  repouso (nenhuma), elevado (cartão com `border` só), flutuante (`box-shadow` colorido com
  a matiz do primary a 12% de opacidade, nunca preto puro).
- **Modo escuro inverte elevação**: superfície mais alta = fundo mais claro (`surface`
  acima de `background`), sombra não faz trabalho nenhum no escuro.

## 6. Referência honesta

Inspiração declarada, não copiada:

- **Raycast** — graphite escuro + um acento vívido só, tipografia confiante, é a prova de
  que ferramenta de produtividade pode ter identidade forte sem virar brinquedo.
- **Linear** — o uso de violeta como cor de marca única, derivada nos neutros em vez de
  cinza puro, e a disciplina de "uma cor de ação".
- **Arc (browser)** — blocos de cor com contorno definido em vez de sombra suave, raio
  generoso, é de onde vem a decisão de borda-sólida-em-vez-de-sombra desta proposta.

## 7. Tokens CSS

```css
:root {
  /* --- Cor: base (light) --- */
  --color-background:        oklch(0.98 0.010 300);
  --color-surface:            oklch(0.95 0.020 300);
  --color-foreground:        oklch(0.18 0.030 300);
  --color-foreground-muted:  oklch(0.42 0.050 300);
  --color-border:             oklch(0.85 0.040 300);

  --color-primary:            oklch(0.47 0.230 310);
  --color-primary-hover:      oklch(0.38 0.200 310);
  --color-primary-foreground: oklch(0.99 0.005 310);

  --color-accent:              oklch(0.92 0.190 118);
  --color-accent-foreground:   oklch(0.18 0.030 300);

  --color-destructive:            oklch(0.55 0.220 15);
  --color-destructive-foreground: oklch(0.99 0.005 15);

  --color-success:            oklch(0.68 0.160 155);
  --color-success-foreground: oklch(0.99 0.005 155);

  --color-warning:            oklch(0.75 0.160 70);
  --color-warning-foreground: oklch(0.18 0.030 70);

  --color-neutral-estado:            oklch(0.55 0.040 300); /* sem_registros */
  --color-neutral-estado-foreground: oklch(0.99 0.005 300);

  /* --- Tipografia --- */
  --font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-body: "Inter", ui-sans-serif, system-ui, sans-serif;

  --text-xs:   0.75rem;  /* 12px */
  --text-sm:   0.875rem; /* 14px */
  --text-base: 1rem;     /* 16px — corpo, nunca abaixo disso */
  --text-lg:   1.25rem;  /* 20px */
  --text-xl:   1.5625rem;/* 25px */
  --text-2xl:  1.9375rem;/* 31px */
  --text-3xl:  2.4375rem;/* 39px */
  --text-4xl:  3.0625rem;/* 49px */

  --font-weight-regular: 400;
  --font-weight-medium:  600;
  --font-weight-bold:    700;

  --leading-tight: 1.15;  /* título */
  --leading-normal: 1.5;  /* corpo, mensagem */
  --tracking-tight: -0.02em; /* título grande */

  /* --- Espaçamento --- */
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-12: 3rem;    /* 48px */
  --space-16: 4rem;    /* 64px */
  --space-24: 6rem;    /* 96px */

  /* --- Forma --- */
  --radius-base: 0.75rem;   /* 12px — campo, botão */
  --radius-card: 1.125rem;  /* 18px — cartão, bolha de mensagem */
  --radius-full: 9999px;    /* avatar, indicador de estado */

  --border-width: 1.5px;

  --shadow-elevado: none; /* elevação vem da borda, não da sombra */
  --shadow-flutuante: 0 8px 24px oklch(0.47 0.230 310 / 0.12);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-background:        oklch(0.16 0.020 300);
    --color-surface:            oklch(0.21 0.030 300);
    --color-foreground:        oklch(0.95 0.020 300);
    --color-foreground-muted:  oklch(0.72 0.040 300);
    --color-border:             oklch(0.30 0.050 300);

    --color-primary:            oklch(0.62 0.220 310);
    --color-primary-hover:      oklch(0.72 0.190 310);
    --color-primary-foreground: oklch(0.14 0.020 310);

    --color-accent:              oklch(0.88 0.170 120);
    --color-accent-foreground:   oklch(0.16 0.020 300);

    --color-destructive:            oklch(0.68 0.170 15);
    --color-destructive-foreground: oklch(0.14 0.020 15);

    --color-success:            oklch(0.75 0.160 155);
    --color-success-foreground: oklch(0.14 0.020 155);

    --color-warning:            oklch(0.80 0.150 75);
    --color-warning-foreground: oklch(0.16 0.020 75);

    --color-neutral-estado:            oklch(0.62 0.040 300);
    --color-neutral-estado-foreground: oklch(0.14 0.020 300);

    --shadow-flutuante: 0 8px 24px oklch(0 0 0 / 0.35);
  }
}

:root[data-theme="dark"] {
  --color-background:        oklch(0.16 0.020 300);
  --color-surface:            oklch(0.21 0.030 300);
  --color-foreground:        oklch(0.95 0.020 300);
  --color-foreground-muted:  oklch(0.72 0.040 300);
  --color-border:             oklch(0.30 0.050 300);

  --color-primary:            oklch(0.62 0.220 310);
  --color-primary-hover:      oklch(0.72 0.190 310);
  --color-primary-foreground: oklch(0.14 0.020 310);

  --color-accent:              oklch(0.88 0.170 120);
  --color-accent-foreground:   oklch(0.16 0.020 300);

  --color-destructive:            oklch(0.68 0.170 15);
  --color-destructive-foreground: oklch(0.14 0.020 15);

  --color-success:            oklch(0.75 0.160 155);
  --color-success-foreground: oklch(0.14 0.020 155);

  --color-warning:            oklch(0.80 0.150 75);
  --color-warning-foreground: oklch(0.16 0.020 75);

  --color-neutral-estado:            oklch(0.62 0.040 300);
  --color-neutral-estado-foreground: oklch(0.14 0.020 300);

  --shadow-flutuante: 0 8px 24px oklch(0 0 0 / 0.35);
}
```

**Sobre a tabela de hex no item 2:** os valores hex ali são a leitura de referência rápida
(o que o dono vê ao abrir o arquivo); a fonte real dos tokens é o bloco OKLCH acima —
gerar hover, estado e variação de tema é aritmética sobre `L`, não uma segunda paleta
inventada à mão.
