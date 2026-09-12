# Briefing — Fase 4: acesso Windows e PWA Android

## pedido_original
Fase 4 do cora-med: acesso Windows e PWA Android para a Cora. Entrevista de escopo:
alcance de rede = TineHost (confirmado rodando Node.js real via seletor de app do
DirectAdmin, mesmo esquema do Workspace); tipo de app Windows = nativo (Electron/Tauri);
público = Thaís e o dono; autenticação = login de verdade (não a credencial de ambiente
compartilhada de hoje).

## entendimento
A Cora hoje só existe como uma API HTTP sem nenhuma tela (`apps/server`, `POST /turno`).
Esta fase constrói a primeira interface visual de verdade: uma tela de chat web, com
login real de Thaís e do dono, publicada em produção na TineHost (mesmo esquema Node.js
já em uso pelo Workspace). Essa mesma tela ganha dois invólucros: um aplicativo Windows
nativo (Tauri) e um PWA instalável no Android — os dois abrem a mesma tela publicada, sem
duplicar interface.

## usuario_alvo
Dois usuários nomeados, ambos operando no dia a dia, não só testando: Thaís (operação da
clínica, quem já usa o resumo operacional da Fase 3) e o dono (acompanhamento). Nenhum dos
dois é desenvolvedor — a lente DX não se aplica à tela; aplica-se só ao empacotamento do
app Windows.

## criterio_de_aceitacao
- Login com e-mail e senha reais funciona para as contas de Thaís e do dono — sem senha
  nem hash aparecendo em código, log, commit ou documentação.
- A tela de chat abre em produção real na TineHost (subdomínio a definir na fase de
  arquitetura) e troca mensagem de verdade com a Cora via `POST /turno` já existente.
- No Windows, existe um instalador que abre essa mesma URL numa janela própria, com ícone
  e atalho na área de trabalho — não é uma aba de navegador comum.
- No Android, o site é instalável como PWA (manifest + service worker): aparece na tela
  inicial com ícone próprio e abre em tela cheia, sem barra de endereço.
- A suíte continua rodando sem rede (`pnpm run test`) — autenticação é testada por
  mecanismo (token válido/expirado/inexistente), nunca contra um provedor real.
- `pnpm run typecheck` limpo ao final.
- Revisão de segurança roda antes de fechar a fase (autenticação nova + primeira
  publicação real) e qualquer achado bloqueante é corrigido com teste antes do aceite.

## fora_de_escopo
Voz e wake word (Fase 5). Notificação push nativa. Automação de navegador. Deploy
automatizado por CI/CD — a TineHost não tem runner (falta `sudo`/`docker`/`systemctl`),
então a publicação nesta fase é manual pelo painel DirectAdmin, do jeito que o Workspace
já publica. Migração para um VPS novo — o dono ainda está decidindo esse servidor; esta
fase publica na TineHost sabendo que pode mudar de casa depois, sem reescrever a
aplicação (URL do servidor fica configurável, nunca hardcoded).

## riscos
Primeira publicação real do cora-med (até aqui só existiu local) — a tela pode expor
dado de paciente de verdade para fora do laptop do dono, então o portão de risco da
esteira (produção) se aplica antes do deploy final, não antes de construir. Autenticação
nova é código sensível — entra revisão de segurança obrigatória. Recomendação técnica a
confirmar na fase de arquitetura: reaproveitar o login que Thaís e o dono já têm no
Workspace (que já resolve identidade real hoje, conforme Fase 1 do roadmap) em vez de
construir um banco de senha novo e paralelo — evita duplicar segredo e trabalho; cabe ao
Arquiteto confirmar se o contrato atual permite.

## plano_de_voo
Fases 1 a 7, com a fase 3 (design) ligada — é a primeira interface visual da Cora, então
tokens e direção visual vêm antes da primeira tela, junto com a persona ainda genérica
(a entrevista com a Thaís continua pendente e não bloqueia esta fase: a tela nasce com a
persona de hoje e é ajustada depois, sem retrabalho estrutural).

Modo **completo** na descoberta (fase 2): o escopo cruza arquitetura (autenticação,
hospedagem, dois clientes nativos), não é domínio pequeno e conhecido — as quatro lentes
rodam em paralelo, não em um despacho só.

Modelos: Interrogador opus (feito, esta sessão). Descoberta sonnet, com corte de escopo
do Diretor em opus. Design sonnet, juiz de direção visual em opus. Plano em opus
(neguin-planner, por ter decisão de arquitetura). Execução sonnet nos worktrees.
Verificação: revisor de segurança e de tela em sonnet, típico haiku só no mecânico.
Cronista sonnet.

Despachos previstos: ~24 (4 lentes descoberta + síntese + 4 papéis de design + juiz +
planner + por volta de 8 a 10 executores, dado que há três frentes reais — backend de
auth, web/PWA, wrapper Windows — + 3 a 4 revisores + cronista).
