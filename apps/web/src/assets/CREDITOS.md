# Créditos — assets inseridos em `apps/web`

Cópia de `docs/esteira/fase-4-acesso-windows-e-pwa-android/design/assets/CREDITOS.md`,
mantida junto do código que os usa. Ver origem, autoria e licença lá.

## Troca registrada (Etapa 14 do plano da Fase 4)

`wordmark-lockup.svg` foi inserido inline em `apps/web/src/componentes/MarcaCora.tsx`
com uma alteração: o `font-family="Inter, system-ui, -apple-system, 'Segoe UI',
sans-serif"` do arquivo original virou `font-family="var(--font-sans)"` (Montserrat).

Não é redesenho — é a correção da contradição nº 4 do plano da Fase 4: a
`estrategia_de_aquisicao` de `design.md` (herdada do painel descartado) ainda cita
Inter, mas a fonte de verdade aprovada (`tokens` e `direcao_visual_escolhida`) é
Montserrat, já auto-hospedada via `@fontsource/montserrat` em `apps/web`.
