# Verificação — Fase 4: acesso Windows e PWA Android

## Execução

21 etapas do plano (`docs/superpowers/plans/2026-09-11-fase-4-acesso-windows-e-pwa-android.md`),
executadas por `neguin-executor` em worktrees isoladas, mescladas em ordem de dependência no
branch `feature/fase-4-acesso-windows-e-pwa-android` (nunca em `main` — autenticação é trabalho
de risco, exige branch e PR).

## Revisão especialista (fase 6 da esteira)

Quatro revisores rodaram em paralelo contra o branch inteiro:

| Revisor | Veredito inicial | Achados |
|---|---|---|
| react-reviewer | corrija antes de mergear | 1 bloqueante (loop infinito em `useSessao`), 2 importantes (acessibilidade) |
| typescript-reviewer | corrija antes de mergear | 1 bloqueante (freio colapsa atrás de proxy), 2 importantes (Map sem limite, corrida no freio) |
| security-reviewer | corrija antes de mergear | 1 bloqueante (auto-DoS com 5 requisições), 4 importantes (força bruta distribuída, cookie inseguro sem trava, cookie sem `__Host-`, origem só por hostname) |
| design-reviewer | corrija antes de mergear | 0 bloqueantes, 1 importante (trap de foco no menu, achado também pelo react-reviewer) |

**Todos os achados bloqueantes e importantes foram corrigidos**, em dois despachos paralelos
(frontend e backend/segurança), com teste novo provando cada correção. A suíte cresceu de 532
para 548 testes.

**Achado extra, durante a verificação final desta sessão (não veio de revisor):** a correção do
item "corrida entre checar e registrar" no freio de tentativas introduziu um efeito colateral —
registrar a falha antes de checar contava a própria tentativa atual contra o limite dela,
bloqueando uma tentativa mais cedo do que o pretendido. Descoberto rodando
`scripts/verificacao-fase-04.ts` de novo depois da fusão das correções (item 04 falhou: bloqueou
na 4ª tentativa, não na 5ª). Corrigido invertendo a ordem (checar o estado anterior, só depois
registrar) — as duas operações continuam síncronas, sem reabrir a corrida original.

## Evidência de funcionamento (não simulada)

Todos os comandos abaixo foram executados de verdade nesta sessão, contra o branch final:

```
pnpm run test        → 36 arquivos, 548 testes, todos passando
pnpm run typecheck   → limpo (raiz + @cora/web)
pnpm --filter @cora/server run build   → gera apps/server/dist/servidor.mjs
pnpm --filter @cora/web run build      → gera apps/web/dist/ (manifest, ícones, SPA)
pnpm run verificacao:fase04            → 12 de 12 verificações passaram, contra o build real
```

As 12 verificações de ponta a ponta (login certo, senha errada, e-mail inexistente com resposta
idêntica, freio de tentativas, `/turno` sem cookie, `/turno` com cookie e conta certa, tokens de
delegação distintos por conta, sessão expirada, cookie adulterado, `X-Robots-Tag`, travessia de
caminho recusada, fallback de SPA) rodam contra um servidor real de verdade (`node:http`), não
contra mock — só o Workspace real e o provedor de IA continuam fora, como em todas as fases
anteriores.

## O que NÃO foi verificado, e não vale alegar que foi

- **Nenhuma publicação real na TineHost aconteceu.** O roteiro manual existe
  (`docs/publicacao/tinehost.md`), mas publicar exige acesso ao painel, que só o dono tem — fica
  para quando ele der o sinal.
- **O instalador Windows (`.msi`/`.exe`) não foi gerado.** Não há `cargo`/`rustc` nesta máquina;
  o `tauri.conf.json` foi validado como JSON e os ícones gerados, mas o build de verdade é passo
  do dono, numa máquina com o toolchain do Rust.
- **Instalação real do PWA num Android físico não foi testada** — só a estrutura do manifest e
  os ícones foram conferidos por código.
- **Nenhuma chamada real à Anthropic** — segue como em todas as fases, o motor de teste
  (`ScriptedMotor`) cobre a suíte inteira sem rede.
- **Revisão de acessibilidade não foi exaustiva** — cobriu os achados que os revisores
  encontraram; não houve teste com leitor de tela de verdade.

## Estado do repositório

- Branch: `feature/fase-4-acesso-windows-e-pwa-android`, ainda não mesclado em `main`, ainda não
  enviado ao GitHub — falta o PR (próximo passo do Cronista).
- CORA-006 aberto em `med-coordination` (SSO com o login do Workspace), exploratório, sem
  bloquear nada.
