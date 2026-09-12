/**
 * Marca `Cora`, inserida inline (nunca via `<img>`) para herdar as variáveis CSS do
 * tema claro/escuro — é o que `design.md` exige para a tela de login e o cabeçalho do
 * chat. Copiado de
 * `docs/esteira/fase-4-acesso-windows-e-pwa-android/design/assets/wordmark-lockup.svg`,
 * com uma única troca: `font-family="Inter, ..."` virou `var(--font-sans)` (Montserrat)
 * — a contradição nº 4 do plano da Fase 4, registrada em `../assets/CREDITOS.md`.
 */
export function MarcaCora() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 40" role="img" aria-label="Cora">
      <title>Cora</title>
      <rect x="0" y="0" width="40" height="40" rx="9" fill="var(--color-primary, oklch(0.38 0.085 255))" />
      <path
        d="M30.65,27.46 A13,13 0 1,1 30.65,12.54"
        fill="none"
        stroke="var(--color-primary-foreground, oklch(0.99 0.004 250))"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <text
        x="52"
        y="28"
        fontFamily="var(--font-sans)"
        fontSize={26}
        fontWeight={600}
        letterSpacing="-0.02em"
        fill="var(--color-foreground, oklch(0.20 0.020 250))"
      >
        Cora
      </text>
    </svg>
  )
}
