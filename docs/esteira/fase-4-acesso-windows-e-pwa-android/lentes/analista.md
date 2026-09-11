# Lente do Analista — Fase 4: acesso Windows e PWA Android

## Quem usa, onde, com que pressa

### Usuário principal: Thaís, no celular, entre uma reunião e outra

Thaís Garcia Fristachi é a fundadora e quem toca a operação da MedConsultoria no dia a
dia — ela já é a única pessoa nomeada que usa a Fase 3 (`workspace.inbox.resumo`) hoje.
O cenário mais comum não é ela sentada numa mesa: pelo tipo de trabalho descrito na
entrevista (`docs/negocio/entrevista-thais.md`) — relacionamento com operadoras,
negociação, credenciamento, faturamento — boa parte do dia dela é fora do computador
fixo: em ligação, em reunião com operadora, entre uma clínica e outra. É por isso que o
briefing pede especificamente **Android PWA** para ela, não só Windows.

O que ela já tentou antes de chegar aqui: hoje, para saber "como estão minhas
pendências", o único caminho é o Workspace (login real, que já usa) ou pedir para
alguém rodar `POST /turno` via ferramenta técnica — que não é uma opção real para ela.
Ela **não é desenvolvedora** (confirmado no briefing) e não vai abrir Postman ou linha
de comando. Sem uma tela, a Fase 3 inteira (fila, resumo operacional, 5 estados)
continua inacessível para a única pessoa que ela serve — é dado construído sem porta de
entrada.

**Aparelho e pressa:** celular Android em primeiro lugar (é o que está sempre com ela),
desktop Windows em segundo (na mesa, sessão mais longa). A entrada por celular precisa
sobreviver a conexão ruim e a interrupção no meio — ela vai fechar o app e voltar depois
sem ter mandado a mensagem.

### Usuário secundário: o dono, em acompanhamento

O dono usa para acompanhar — sessão mais espaçada, provavelmente mais Windows do que
Android (é quem constrói o sistema, tende a estar no computador). Pressa menor que a da
Thaís: não é quem depende da Cora para o trabalho do dia, é quem confere se está
funcionando.

### Lente DX secundária: quem mantém o app Windows (o próprio dono, chapéu diferente)

O briefing já resolve isso: "nenhum dos dois é desenvolvedor — a lente DX não se aplica
à tela; aplica-se só ao empacotamento do app Windows." Isso quer dizer que o dono, no
papel de mantenedor, é quem vai rodar `tauri build` (ou equivalente) depois de cada
mudança na tela web, sem duplicar código de interface. Fracasso aqui: o instalador
quebrar silenciosamente numa atualização, ou o wrapper apontar para uma URL hardcoded
que força reescrever o app nativo quando o servidor mudar de casa — o próprio
`fora_de_escopo` do briefing já nomeia esse risco ("URL do servidor fica configurável,
nunca hardcoded"). Tempo até rodar pela primeira vez importa menos aqui do que
manutenção repetida: é um app que vai ser reconstruído toda vez que a tela web mudar,
não uma vez só.

## Momentos de uso, em ordem de frequência

1. **"Como estão minhas pendências?"** — Thaís abre o app (celular, no intervalo entre
   compromissos) e pergunta o resumo operacional. É literalmente o que a Fase 3 já
   entrega (`workspace.inbox.resumo`) — hoje sem porta de entrada. Este é o caso comum;
   a tela tem que ser rápida para ele, não para o caso raro.
2. **Conversa livre com a Cora** — perguntar algo fora do resumo fixo, usando o motor de
   linguagem (`POST /turno` já aceita mensagem livre). Frequência menor que (1), mas é o
   que diferencia "abrir uma lista" de "ter uma assistente".
3. **Login** — acontece uma vez por sessão (ou por dias, se a sessão persistir). Não é o
   uso em si, mas é o primeiro contato e o ponto onde mais gente desiste antes de
   experimentar qualquer coisa — por isso entra como momento próprio, não como detalhe
   técnico.
4. **Instalar o app** (PWA no Android, instalador no Windows) — acontece **uma vez**,
   bem no início. É baixa frequência mas alta consequência: se travar aqui, a pessoa
   nunca chega ao momento 1.
5. **Acompanhamento do dono** — sessão esparsa, provavelmente mais "abrir e checar" do
   que conversa ativa.

O caso raro que não pode moldar a tela do caso comum: o dono debugando ou testando a
integração a fundo. Isso é trabalho de desenvolvedor, roda direto contra `POST /turno`
ou em ambiente local — não deveria empurrar a tela de produção para um painel técnico.

## O que seria fracasso

- **Login falha sem dizer por quê**, ou trava sem devolver o foco — o próprio
  `LoginPage.tsx` do Workspace (`apps/web/src/features/auth/LoginPage.tsx`) documenta,
  em comentário, dois casos reais que já aconteceram lá: autofill do navegador
  preenchendo conta errada silenciosamente, e senha antiga parecendo preenchida (pontos)
  depois de um erro. Se a Fase 4 reaproveitar ou reconstruir login, ignorar essas duas
  lições é repetir um problema já resolvido em outro lugar do mesmo dono.
- **PWA não instala de verdade** — aparece como aba comum em vez de ícone na tela
  inicial. Para Thaís, que já teria que lembrar de abrir "mais um site", isso é
  suficiente para ela desistir e voltar ao Workspace, que ela já sabe usar.
  Especificamente: manifest sem os campos certos, ou service worker que não registra em
  HTTPS (crítico: PWA exige HTTPS para instalar — isso amarra a esta fase o mesmo risco
  de produção real nomeado no briefing).
- **Conexão ruim no celular derruba a mensagem sem avisar** — Thaís está em campo, não
  numa rede estável. Enviar uma pergunta e não saber se foi ou não é pior que um erro
  claro.
- **Resposta de "sem pendências" indistinguível de "não consegui checar"** — a Fase 3 já
  resolveu isso a nível de dado (`resumo.ts`, cinco estados nomeados, com o teste que
  trava vazio ≠ erro). Fracasso aqui é a tela **desfazer** essa garantia — por exemplo,
  mostrando um estado genérico de carregamento que não distingue "zero pendências" de
  "erro de rede" de "erro de acesso" (que na Fase 3 são três frases diferentes:
  `sem_pendencias`, `erro_de_acesso`, `sem_registros`).
- **App Windows abre uma aba de navegador reconhecível** em vez de janela própria — o
  próprio critério de aceitação do briefing já marca isso como o teste de "pronto":
  "não é uma aba de navegador comum".
- **Instalador do Windows pede algo que a Thaís ou o dono não sabem fazer** (assinar
  certificado, aceitar aviso de SmartScreen sem explicação) — instalador sem
  acompanhamento nenhum de "o que vai aparecer" é o mesmo erro que a CLAUDE.md global
  proíbe para comando de terminal ("nunca é só rodar o build"), só que replicado para
  instalação de app.

## Funcionalidade sem dono (candidata a corte do Diretor)

- **Nada no briefing aponta funcionalidade nova de produto** além de login + a mesma
  tela de chat + dois empacotamentos. Isso é bom sinal — o escopo já está contido ao que
  Thaís e o dono pediram.
- Ponto de atenção, não corte: o `plano_de_voo` prevê "tokens e direção visual" (fase de
  design) **antes** da persona específica da MedConsultoria existir (a entrevista com a
  Thaís continua pendente). Isso é aceitável — o próprio briefing já resolveu isso
  ("a tela nasce com a persona de hoje e é ajustada depois, sem retrabalho estrutural")
  — mas é uma dependência que **vale nomear de novo aqui**: a tela de chat que Thaís vai
  usar de verdade vai soar genérica ("assistente de uma clínica") na primeira versão,
  não com o tom da MedConsultoria. Não é motivo para atrasar a Fase 4, mas é motivo para
  o Diretor não prometer "tela pronta" como se fosse "tela com a voz certa da Cora" —
  são coisas diferentes, e só a segunda depende da entrevista com a Thaís.
- **Notificação push nativa está fora de escopo** (declarado no briefing) — e é
  coerente com o uso real: sem isso, Thaís precisa lembrar de abrir o app. Não é
  candidata a corte porque já foi cortada deliberadamente; só registro de que o momento
  de uso nº 1 ("como estão minhas pendências") depende inteiramente de ela lembrar de
  perguntar, sem nenhum empurrão do sistema. Aceitável para esta fase, mas é a lacuna
  mais óbvia que a Fase 5+ deveria endereçar se o uso real mostrar que ela esquece.

## Quem não pode ver aquele dado (produto de saúde)

- A tela mistura **dois papéis** com acesso ao mesmo tipo de dado (resumo operacional,
  potencialmente nome de cliente/paciente vindo do Workspace, conforme já documentado em
  `docs/ARCHITECTURE.md` e no aviso do `ROADMAP.md` sobre `Cliente.nome` nascendo de
  formulário público não autenticado) — Thaís e o dono. O briefing não distingue escopo
  de dado entre os dois; vale confirmar na fase de arquitetura se ambos devem ver
  **exatamente** o mesmo resumo ou se algum recorte é esperado (ex.: dado financeiro só
  para o dono). Não achei nada no repositório que resolva essa pergunta — está marcada
  abaixo como dúvida para o dono.
- **Qualquer pessoa que não seja Thaís ou o dono** não pode ver nada — não há terceiro
  usuário nomeado nesta fase, e isso inclui: sessão de um esquecida aberta no aparelho do
  outro, e o próprio instalador do Windows não deve embutir credencial nenhuma (o
  critério de aceitação já cobre isso: "sem senha nem hash aparecendo em código, log,
  commit ou documentação").
- Conteúdo vindo do Workspace continua sendo **dado, nunca instrução**
  (`wrapUntrusted`, já em produção na Fase 3) — a tela nova não pode introduzir um
  caminho que exiba esse conteúdo de um jeito que pareça comando do sistema (ex.: HTML
  não escapado vindo de `titulo` de tarefa, o mesmo vetor de injeção já testado no
  `ROADMAP.md` como "fixture com título de injeção de prompt").

## Dúvidas para o dono

1. **Thaís e o dono veem o mesmo resumo, ou há recorte por papel?** Não achei nada no
   código ou na documentação que resolva isso — a Fase 3 não modela papel de usuário no
   resumo, só a fonte do dado. Recomendação: para esta fase, os dois verem o mesmo
   resumo é a opção mais simples e consistente com "login real substituindo a credencial
   compartilhada" sem inventar controle de acesso novo; se houver dado que só o dono deve
   ver, isso é decisão de produto, não técnica.
2. **PWA e app Windows recebem push mais tarde, ou o silêncio (sem notificação) é
   aceitável indefinidamente para o uso real da Thaís?** Está fora de escopo desta fase
   por decisão já registrada no briefing — não é bloqueio, é só o ponto onde o momento de
   uso nº 1 depende inteiramente de lembrança humana. Não precisa resposta agora, mas
   vale o dono saber que é a lacuna mais visível do design resultante desta fase.

---

## Resumo (até 10 linhas)

Usuária real: Thaís, no celular, entre compromissos, perguntando "como estão minhas
pendências" — a Fase 3 já responde isso, mas ainda não tem porta de entrada. Dono é
secundário, mais Windows, acompanhamento espaçado. Momentos em ordem: resumo
operacional > conversa livre > login > instalação (rara, mas fatal se falhar) >
acompanhamento do dono. Fracasso: login que engana com autofill (o Workspace já viveu
isso, documentado em `LoginPage.tsx`), PWA que não instala de verdade, mensagem perdida
em conexão ruim, e principalmente a tela **apagar** a distinção que a Fase 3 já construiu
entre "sem pendências" e "não consegui checar". Nenhuma funcionalidade sem dono
encontrada — o escopo já está contido. Duas dúvidas reais para o dono: se Thaís e ele
veem o mesmo resumo ou há recorte por papel, e a ausência de notificação como lacuna
conhecida e aceita por ora.
