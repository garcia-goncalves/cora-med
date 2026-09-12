# Lente do Diretor — Fase 4: acesso Windows e PWA Android

Pergunta desta lente: **o que a gente não vai construir agora?**
Entrega: o corte de escopo — o que fica, o que espera, o que some, e em que ordem entra o
que ficou.

Base lida: `briefing.md` desta fase, `docs/ROADMAP.md` (estado real das fases 0 a 3),
`CLAUDE.md` do repositório e a memória do projeto. Não li as outras lentes — cegueira
mútua.

---

## O que o dono pediu explicitamente (intocável — não entra em corte)

Quatro coisas, ditas na entrevista e registradas no briefing:

1. Alcance de rede = **TineHost**, produção real.
2. App **Windows nativo** (Tauri).
3. **Dois usuários** nomeados: Thaís e o dono.
4. **Login de verdade**, não a credencial de ambiente compartilhada de hoje.

Nenhuma das quatro é cortada. O que eu faço com elas é **ordenar**: a tela web publicada e
logada funcionando ponta a ponta primeiro; os dois invólucros depois, porque são
empacotamento da **mesma URL** e não existem sem ela. Ordem não é corte — é a diferença
entre uma entrega e três obras inacabadas em paralelo.

Também é intocável, por regra do repositório e por natureza da fase: **segurança**
(autenticação, autorização, CORS, revisão de segurança antes do aceite) e **qualquer
caminho por onde passe dado de paciente**. A Cora lê Tarefa do Workspace de uma clínica:
a partir do momento em que essa tela sai do laptop, o que ela mostra é dado real.

---

## Balde 1 — o que faz a coisa existir (entra agora)

Teste aplicado em cada item: *se isto não existir na primeira entrega, o que quebra?*

| Item | O que quebra sem ele |
|---|---|
| Sessão de usuário real no `apps/server` (emitir, validar, expirar, encerrar) | Sem isto não há "dois usuários": hoje o servidor usa credencial de ambiente compartilhada. É o pedido 4 do dono. |
| Identidade do usuário chegando até a chamada ao Workspace | Thaís e o dono veriam a mesma caixa de tarefas — o isolamento A/B provado na Fase 1 seria jogado fora na primeira tela. É correção, não recurso. |
| `POST /turno` recusando requisição sem sessão válida | Endpoint aberto na internet com um modelo pago atrás. Quebra dinheiro e quebra dado. |
| CORS restrito à origem publicada | Qualquer site abre a Cora no navegador da Thaís com a sessão dela. |
| Freio de tentativa de login e teto simples de turnos por sessão | Força bruta na senha e amplificação de custo. Contador, não infraestrutura. |
| Tela de chat: enviar, receber, estado de carregando, estado de erro, estado vazio, sair | É a fase. E "vazio ≠ erro" já é regra travada por teste neste repositório — a tela tem de honrar as duas frases. |
| URL do servidor configurável, nunca fixa no código | O briefing diz que a casa pode mudar (VPS). Sem isto, mudar de servidor é reescrever cliente e reempacotar os dois apps. |
| HTTPS válido no subdomínio da TineHost | Sem TLS não há sessão que se sustente, e PWA nem instala. |
| Publicação manual no DirectAdmin, documentada passo a passo em `docs/OPERATIONS.md` | Publicação que só uma sessão do Claude sabe fazer não é publicação. |
| Faixa/sinal visível de ambiente e ausência total de conta de teste em produção | Regra global 0.8. O servidor recusa seed e `@teste.local` lá. |
| PWA: `manifest.json`, ícones, service worker mínimo (só o shell), instalação no Android | Pedido do dono (item 4 do critério de aceitação). |
| Invólucro Tauri: instalador, ícone, atalho, janela própria | Pedido do dono (item 3 do critério de aceitação). |
| Suíte continua sem rede; autenticação testada por mecanismo | Regra dura do repositório. |
| Revisão de segurança antes do aceite | Autenticação nova + primeira publicação real. Não negociável. |

## Balde 2 — o que faz ficar boa (espera a fase seguinte)

Nada aqui quebra a primeira entrega. Tudo aqui é "ficaria melhor".

- **Streaming da resposta** (token a token). A Cora responde de uma vez; um indicador de
  "pensando" resolve a percepção por 1% do trabalho. O briefing da Fase 2b já registra que
  streaming ficou de fora de propósito.
- **Histórico de conversa persistido no servidor.** Na primeira entrega a conversa vive na
  memória do cliente e some ao recarregar. Custo real e pequeno para dois usuários; ganho
  desproporcional em desenho (onde guarda? por quanto tempo? é dado de paciente? quem
  apaga?). Guardar conversa de clínica é decisão de LGPD, não de UX — merece a própria fase.
- **Renderização rica** (markdown, tabela, destaque de código). Quebra de linha basta.
- **Recuperação de senha por e-mail.** Dois usuários conhecidos; o dono redefine na mão. E
  fluxo de recuperação é superfície de ataque nova, não conveniência neutra.
- **Rate limit sofisticado por IP/janela deslizante.** O teto simples do balde 1 cobre o
  risco de hoje com duas contas.
- **2FA.** Some segurança, não falta. Entra quando houver mais de dois usuários.
- **Assinatura de código do instalador Windows.** Custa dinheiro (certificado) e é decisão
  do dono — ver dúvidas.
- **Atualização automática do app Tauri.** Dois usuários, um reinstalador por e-mail resolve.
- **Service worker com modo offline de verdade.** Cora sem rede não responde; cachear o
  shell é o suficiente e é o que está no balde 1.
- **Tela de administração de usuários.** As duas contas são provisionadas à mão.

## Balde 3 — o que alguém achou legal (some, e não volta nesta fase)

Nenhum destes foi pedido pelo dono. São as tentações previsíveis deste tipo de trabalho:

- Notificação push nativa (já está em `fora_de_escopo` do briefing — e é Fase 5/7).
- Tema escuro / alternador de tema.
- Múltiplos idiomas (i18n). Dois falantes de português.
- Busca no histórico de conversas — que nem existe ainda.
- Exportar conversa em PDF/markdown.
- Avatar de usuário, upload de foto de perfil.
- Onboarding com tour guiado. São duas pessoas; o dono mostra a tela em dois minutos.
- **Testes E2E com Playwright contra a TineHost real.** Caro, frágil, e bate em produção
  com dado de clínica de verdade. O critério de aceitação desta fase é verificação manual
  documentada com evidência — o mesmo padrão dos `scripts/verificacao-fase-0X.ts`.
- Painel de métricas/uso dentro da própria tela.
- Sino de notificação in-app, som, badge.
- Animação de entrada de mensagem além do mínimo (a regra global manda animar só depois
  que a tela existe parada e funcionando).
- Abstração de "provedor de autenticação plugável" com mais de uma implementação, "camada
  de tema" configurável, "suporte a N usuários" parametrizado, wrapper genérico para um
  terceiro sistema operacional (macOS/iOS). Flexibilidade especulativa: um único uso,
  hoje e no horizonte visível.

**Não é corte meu, é fato registrado:** CI/CD automático para a TineHost. O briefing já
documenta que não há runner lá (sem `sudo`/`docker`/`systemctl`). Ninguém precisa gastar
uma hora redescobrindo isso.

---

## Ordem recomendada (pelo que destrava o resto)

1. **Decidir o mecanismo de autenticação** (ver dúvidas). Trava tudo: backend, tela,
   publicação e revisão de segurança dependem da resposta.
2. **Sessão de usuário no `apps/server`** — emissão, validação, expiração, encerramento,
   `POST /turno` protegido, identidade do usuário chegando ao Workspace, CORS, freio de
   login. Tudo testável sem rede, tudo antes de existir tela.
3. **Tokens e direção visual + tela de chat rodando contra o servidor local.** A fase de
   design da esteira está ligada; é a primeira interface visual da Cora.
4. **Publicação na TineHost com HTTPS e login real ponta a ponta.** *Este é o marco.* Se a
   fase parasse aqui, ela já entregou valor: Thaís abre no navegador do celular e do
   computador e conversa com a Cora. Portão de risco de produção antes deste passo.
5. **PWA Android** — `manifest`, ícones, service worker mínimo. É o invólucro mais barato e
   valida a tese "uma URL, dois invólucros" antes de investir na cadeia de build do Tauri.
6. **App Windows (Tauri)** — instalador, ícone, atalho, janela própria. Por último porque
   traz cadeia de ferramentas própria (Rust, empacotamento, aviso do SmartScreen) e é o
   único item cujo atraso não impede ninguém de usar a Cora.
7. **Revisão de segurança + evidência + fechamento do roteiro.**

**Custo do corte, em uma frase:** o dono ganha uma Cora com tela, login real e dois apps
instalados, mas cada conversa começa do zero ao recarregar, a resposta aparece de uma vez
em vez de ir surgindo, e o instalador do Windows vai mostrar um aviso do SmartScreen na
primeira execução.

---

## duvidas_para_o_dono

1. **Login próprio (senha + hash aqui dentro) ou reaproveitar a identidade que Thaís e o
   dono já têm no Workspace?**
   *Recomendação: reaproveitar o Workspace.* É o corte que faz a coisa existir com menos
   superfície nova: nenhum banco de senha novo, nenhum hash para errar, nenhum fluxo de
   recuperação, nenhum segredo a mais para rotacionar — e a identidade real já é resolvida
   lá desde a Fase 1, com isolamento A/B comprovado. Construir senha própria é criar um
   segundo lugar onde a senha da clínica pode vazar.
   **Ressalva honesta, para o Sintetizador cruzar:** o contrato `workspace-agent-v1` 0.2.1
   é agente-para-agente (três cabeçalhos, duas identidades), e não sei se existe caminho de
   **login humano** (OIDC/sessão de navegador) ou se emitir credencial por usuário exigiria
   ticket novo. **O Arquiteto está olhando o código de verdade nesta mesma rodada — a
   decisão é dele confirmar ou derrubar, e minha recomendação só vale se ele disser que o
   caminho existe hoje.** Se não existir sem ticket, o corte se inverte: senha própria com
   biblioteca consagrada de hash, mínima, para duas contas — e nunca um sistema de contas.
2. **Certificado de assinatura de código para o instalador Windows?** Custa dinheiro anual.
   *Recomendação: não comprar agora* — aceitar o aviso do SmartScreen na primeira execução,
   já que são dois usuários conhecidos que recebem o instalador da mão do dono. Revisitar se
   a Cora for para mais gente.
3. **A conversa da Cora pode ser guardada no servidor?** Não é pergunta de UX: o que a Cora
   mostra vem do Workspace de uma clínica. *Recomendação: nesta fase não guardar nada no
   servidor* — a conversa vive só na sessão do navegador. Guardar exige decisão de retenção,
   e essa decisão é de produto e de LGPD, não minha.
