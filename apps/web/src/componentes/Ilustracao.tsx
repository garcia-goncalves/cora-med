/**
 * As duas ilustrações de estado da tela de chat (`design.md`, telas 2 e 3), inseridas
 * inline — nunca via `<img>` — para herdar as variáveis CSS do tema claro/escuro, mesma
 * convenção de `MarcaCora.tsx`. Copiadas sem alteração de
 * `docs/esteira/fase-4-acesso-windows-e-pwa-android/design/assets/ilustracao-vazio.svg`
 * e `ilustracao-erro-conexao.svg` (nenhuma troca de fonte aqui — são só formas, sem
 * `<text>` — por isso não há linha nova em `assets/CREDITOS.md`).
 */
export type VarianteDeIlustracao = 'vazio' | 'erro-conexao'

export interface PropsDaIlustracao {
  variante: VarianteDeIlustracao
}

export function Ilustracao({ variante }: PropsDaIlustracao) {
  return variante === 'vazio' ? <IlustracaoVazio /> : <IlustracaoErroConexao />
}

function IlustracaoVazio() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" role="img" aria-hidden="true">
      <path
        fill="var(--color-sucesso, oklch(0.48 0.130 150))"
        opacity="0.08"
        d="M120,28c33,0,64,15,78,44c13,27,7,61-13,83c-20,22-52,31-82,25
           c-30-6-56-27-64-56c-8-28,1-60,24-79C85,37,101,28,120,28Z"
      />
      <rect
        x="58"
        y="62"
        width="124"
        height="88"
        rx="12"
        fill="none"
        stroke="var(--color-border, oklch(0.89 0.010 250))"
        strokeWidth="2"
      />
      <line x1="76" y1="86" x2="150" y2="86" stroke="var(--color-muted, oklch(0.95 0.007 250))" strokeWidth="8" strokeLinecap="round" />
      <line x1="76" y1="106" x2="164" y2="106" stroke="var(--color-muted, oklch(0.95 0.007 250))" strokeWidth="8" strokeLinecap="round" />
      <line x1="76" y1="126" x2="130" y2="126" stroke="var(--color-muted, oklch(0.95 0.007 250))" strokeWidth="8" strokeLinecap="round" />
      <circle cx="176" cy="146" r="26" fill="var(--color-sucesso, oklch(0.48 0.130 150))" />
      <path
        d="M165,146 l8,8 l18,-18"
        fill="none"
        stroke="var(--color-sucesso-foreground, oklch(0.99 0.004 150))"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IlustracaoErroConexao() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" role="img" aria-hidden="true">
      <path
        fill="var(--color-erro, oklch(0.47 0.190 25))"
        opacity="0.07"
        d="M120,30c30,0,58,13,74,39c15,25,14,58,-2,83c-16,24,-46,38,-76,36
           c-30,-2,-58,-20,-70,-47c-12,-27,-5,-60,17,-80C81,42,100,30,120,30Z"
      />
      <path
        d="M84,120 a51,51 0 0 1 72,0"
        fill="none"
        stroke="var(--color-muted-foreground, oklch(0.46 0.015 250))"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M99,132 a29,29 0 0 1 42,0"
        fill="none"
        stroke="var(--color-muted-foreground, oklch(0.46 0.015 250))"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="120" cy="146" r="5" fill="var(--color-muted-foreground, oklch(0.46 0.015 250))" />
      <line
        x1="66"
        y1="96"
        x2="174"
        y2="176"
        stroke="var(--color-erro, oklch(0.47 0.190 25))"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="168" cy="70" r="24" fill="var(--color-erro, oklch(0.47 0.190 25))" />
      <line x1="168" y1="60" x2="168" y2="72" stroke="var(--color-erro-foreground, oklch(0.99 0.004 25))" strokeWidth="5" strokeLinecap="round" />
      <circle cx="168" cy="80" r="2.6" fill="var(--color-erro-foreground, oklch(0.99 0.004 25))" />
    </svg>
  )
}
