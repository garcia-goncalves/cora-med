# Briefing — Fase 3: organização e resumo operacional

## pedido_original

"Prossiga e faça tudo!" — em resposta à pergunta de qual próximo passo tomar entre
planejar a Fase 3 ou aguardar a entrevista com a Thaís. A Fase 3 em si está descrita no
briefing mestre (`med-coordination/CORA-MED-START-HERE.md`, seção 14): "Organização e
resumo operacional — Tarefa/Card/Evento distintos; importação revisável; vazio ≠ erro;
fontes."

## entendimento

A Cora vai organizar o que já sabe consultar (Tarefas do Workspace, via o contrato
0.2.1 já fixado) numa fila de entrada única, e responder "como estão minhas pendências"
distinguindo com precisão zero registros, sincronização incompleta, erro de acesso e
operação real sem pendências — nunca colapsando os quatro casos em "nada". Card e
Evento entram como pedido formal ao Workspace (ticket CORA-005) em paralelo, e são
encaixados quando a resposta chegar — não são bloqueio para começar.

## usuario_alvo

Thaís, pelo mesmo canal de conversa que já existe (`POST /turno`), pedindo um resumo
do que está pendente ou colando algo para a Cora classificar. Não é uma tela nova — é
capacidade nova de um motor que a Thaís já conversa por texto.

## criterio_de_aceitacao

- Existe uma fila de entrada (`InboxItem` ou equivalente) para itens ainda não
  classificados, e ela é uma estrutura própria da Cora — não um segundo cadastro que
  duplica o que o Workspace já tem.
- Dado o mesmo item de origem (mesma fonte + mesmo identificador do Workspace),
  reprocessar não cria duplicata na fila — há teste que prova isso.
- Aproximação por nome (dois clientes/responsáveis parecidos) **apenas sugere**; nunca
  funde dois registros sozinha — há teste que prova que a fusão automática não acontece.
- O resumo operacional distingue, em português, quatro respostas diferentes e
  testáveis: (a) zero tarefas encontradas, (b) sincronização com o Workspace incompleta
  ou parcial, (c) erro de acesso/consulta, (d) consultado com sucesso e sem pendências.
  Nenhuma delas usa a mesma frase que outra.
- Toda tarefa agregada no resumo aponta a fonte (Workspace, e qual endpoint) — não
  aparece número sem proveniência.
- `pnpm run test` continua sem rede e cobre os quatro casos do resumo mais a
  deduplicação.
- Ticket `CORA-005` aberto em `med-coordination/tickets/`, pedindo ao Workspace os
  endpoints (ou confirmação de que não existem ainda) para Card e Evento, no mesmo
  formato de autenticação e paginação do contrato 0.2.1 de Tarefa.

## fora_de_escopo

- Card e Evento **de verdade** (dados reais do Workspace) — ficam fora até a resposta
  do CORA-005. A fila de entrada é desenhada para os três tipos, mas só Tarefa tem dado
  real hoje.
- Importação em lote de fonte externa (e-mail, planilha, CSV) — a fonte ainda não foi
  escolhida; registrado como pendência explícita, não como "já decidido e adiado por
  preguiça".
- Chamada real à Anthropic, persona específica da MedConsultoria, voz, acesso Windows,
  PWA Android — continuam nas fases e bloqueios já registrados no `docs/ROADMAP.md`.
- Qualquer alteração em `workspace-medconsultoria` — vira ticket, nunca edição local.

## riscos

Nenhum dado de paciente, pagamento, migration ou deploy nesta fase. Fixtures continuam
com prefixo `SYNTH-`. O único ponto de atenção é o mesmo de sempre neste repositório:
conteúdo vindo do Workspace (título de tarefa, nome de cliente) é dado, nunca instrução,
e passa por `wrapUntrusted()` — já existe e será reaproveitado, não reescrito.

## plano_de_voo

- **Fase 2 (Descoberta), modo enxuto**: um despacho único com as quatro lentes
  (Analista, Arquiteto, Pesquisador, Diretor) em `sonnet`, porque o domínio já é
  conhecido (mesmo repositório, mesmo contrato, mesmo padrão de teste sem rede das
  fases 1 e 2). Sem portão de produto extra — as duas decisões de forma (Tarefa-only
  agora, importação adiada) já foram tomadas pelo dono nesta conversa.
- **Sem Fase 3 de design**: não há tela nova, é capacidade de conversa por texto que já
  existe.
- **Fase 4 (Plano)**: `neguin-planner` em `opus`, 1 despacho, produzindo etapas
  verificáveis.
- **Fase 5 (Execução)**: `neguin-executor` em worktrees isoladas, paralelo por etapa
  independente — estimativa de 2 a 4 despachos em `sonnet`, dependendo de quantas
  etapas o plano cortar.
- **Fase 6 (Revisão)**: `typescript-reviewer` (arquivos `.ts` tocados) e
  `security-reviewer` (por causa do `wrapUntrusted` e da fila que recebe dado externo),
  ambos em paralelo, mais o verificador técnico rodando `pnpm run test` e
  `pnpm run typecheck`. Sem portão de risco: nenhum dado de paciente, pagamento,
  migration ou deploy aqui.
- **Fase 7 (Cronista)**: atualiza `docs/ROADMAP.md`, `docs/LINKS.md` se alguma porta
  mudar, memória do projeto, commit e push — e abre o ticket `CORA-005` no
  `med-coordination` como parte do mesmo lote.
- **Total previsto**: cerca de 8 a 10 despachos, poucos e gordos, nenhum papel que não
  muda a decisão final.
