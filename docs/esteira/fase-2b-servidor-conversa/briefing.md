## pedido_original
"Continue de onde vc parou e faça tudo o que vc puder, sem parar." O "onde parou" foi
identificado em `docs/ROADMAP.md`: a Fase 2 (criação de tarefa) está feita e comprovada;
a Fase 2b (conversa com modelo) está pela metade — "o adaptador existe e é testado, mas
não há servidor que o exponha — nenhum processo desta casa escuta em porta."

## entendimento
Hoje a Cora tem um motor de conversa completo e testado (`AnthropicMotor`, `runTurn`,
`ToolRegistry`), mas nenhum processo escuta em porta — ninguém de fora consegue mandar
uma mensagem para ele. Vou construir o servidor HTTP mínimo que expõe esse motor: um
endpoint de saúde e um endpoint de turno de conversa, reaproveitando a política de
segurança já implementada no resto do código (catálogo fechado, aprovação por hash,
bloco de conteúdo não confiável, tetos de chamadas e tempo). Isso fecha a metade que
falta da Fase 2b do roteiro.

## usuario_alvo
Thiago, rodando localmente para testar a conversa da Cora ponta a ponta (via `curl` ou
script). Não há usuário final consumindo isto ainda — é a infraestrutura que o desktop
Windows e o PWA (fases futuras, ainda não existem) vão consumir depois.

## criterio_de_aceitacao
- `pnpm run test` continua verde e **sem rede**, incluindo os testes novos do servidor
  HTTP (motor e `WorkspaceClient` injetados, como já é o padrão do repositório).
- `pnpm run typecheck` limpo.
- Existe um comando documentado em `docs/OPERATIONS.md` que sobe um processo real
  escutando em porta local.
- `curl http://localhost:<porta>/health` responde `200` com corpo indicando status ok.
- Existe um endpoint de conversa que recebe uma mensagem, roda `runTurn()` de ponta a
  ponta e devolve o resultado do turno — incluindo o caso de pedir aprovação — testável
  com o `ScriptedMotor` de teste, sem precisar de rede nem de chave real.
- Corpo de requisição malformado ou sem autenticação nunca chega ao motor: devolve erro
  4xx tipado, nunca 500 nem exceção não tratada.
- Nenhum segredo (`ANTHROPIC_API_KEY`, credencial do Workspace, token de delegação)
  aparece em corpo de resposta de erro nem em log.
- `docs/ROADMAP.md`, `docs/ARCHITECTURE.md` e `docs/OPERATIONS.md` atualizados no mesmo
  commit, refletindo o servidor novo — nada de porta ou comando inventado sem testar.

## fora_de_escopo
Persistência da Cora (banco de dados — ainda planejado, nada muda aqui). Autenticação
própria de usuário humano / pareamento de dispositivo Windows (ainda plano, listado em
`docs/SECURITY.md`) — o endpoint aceita, por ora, as mesmas credenciais de ambiente que
o resto da aplicação já usa (`WORKSPACE_DELEGATION_TOKEN`), não um login novo. Interface
visual (desktop, PWA, voz). Chamada de ponta a ponta contra a Anthropic de verdade — o
código fica pronto para rodar com `ANTHROPIC_API_KEY`, mas só o dono tem a chave, e não
vou alegar "provado contra o provedor real" sem ele rodar e eu ver a saída. Deploy,
Docker, CI, publicação.

## riscos
Nenhum dado de paciente, pagamento, migration ou config de produção envolvido — é código
local, contra o Workspace de teste. O risco real é este ser a **primeira porta de rede**
do processo da Cora: por isso o critério de aceitação exige corpo de requisição tratado
como hostil (validado por schema, nunca repassado cru ao motor) e nenhum segredo vazando
em erro. Revisão de segurança entra na fase 6, antes de qualquer merge.

## plano_de_voo
Fases 1 a 7, sem fase 3 (não há interface visual — isto é uma API).

**Modo enxuto** — domínio conhecido (o repositório já documenta motor, política e
contrato em detalhe) e escopo pequeno-médio: a descoberta roda como **um despacho com as
quatro lentes** (Analista, Arquiteto, Pesquisador, Diretor), decidindo framework HTTP,
formato do payload, encaixe com `runTurn`/`ToolRegistry` existentes e tratamento de erro.

Modelos: descoberta e síntese em `sonnet`; plano (`neguin-planner`) em `sonnet`; execução
(`neguin-executor`) em `sonnet`, 1–2 etapas (servidor + testes, depois docs); revisão com
`typescript-reviewer` e `security-reviewer` (o endpoint novo mexe com autenticação e
segredo); cronista em `sonnet`.

Trabalho de risco (primeira superfície de rede, autenticação) → branch e PR, com CI
verde antes de mesclar, por regra do `CLAUDE.md` da máquina.

Despachos previstos: 1 (descoberta) + 1 (síntese) + 1 (plano) + 2 (execução) + 2
(revisão) + 1 (cronista) = **8**.
