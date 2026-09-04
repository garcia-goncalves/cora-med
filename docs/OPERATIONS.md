# Operação da Cora

## Rodar no computador

Requisitos: Node 20.19+ (medido: v20.19.5) e pnpm 10 (medido: 10.19.0).

```bash
cd C:\Users\Desktop\source\repos\cora-med
pnpm install
pnpm run test
pnpm run typecheck
```

**O que aparece se der certo:** `Test Files 16 passed (16)` e `Tests 282 passed (282)`.
O typecheck não imprime nada quando passa — silêncio é sucesso.

**Se der errado:** `ERR_PNPM_...` normalmente é falta de rede na hora do install; rode
`pnpm install` de novo. Erro de tipo aponta arquivo e linha; o build não é ignorável.

## Servidor HTTP da Cora

Expõe o motor de conversa (`AnthropicMotor` + `runTurn` + `ToolRegistry`) em dois
endpoints: `GET /health` e `POST /turno`. Sem framework — Node `http` nativo (ver
`docs/ARCHITECTURE.md`). Escuta só em `127.0.0.1`, de propósito: ainda não existe
autenticação de usuário humano, então não aceita conexão de fora da máquina.

```bash
cd C:\Users\Desktop\source\repos\cora-med
WORKSPACE_BASE_URL=http://localhost:4319 \
WORKSPACE_AGENT_CLIENT=<emitido pelo Workspace> \
WORKSPACE_AGENT_SECRET=<emitido pelo Workspace> \
WORKSPACE_DELEGATION_TOKEN=<token de delegação> \
ANTHROPIC_API_KEY=<chave da Anthropic> \
pnpm --filter @cora/server run dev
```

**Motor de teste (Gemini gratuito) — ver `docs/decisions/0003-motor-de-teste-gemini.md`.**
Enquanto a Anthropic não está ligada com chave paga, `MOTOR_PROVIDER=gemini` troca o
motor sem tocar em código. Custo zero — nível gratuito do Google AI Studio, sem cartão.

```bash
cd C:\Users\Desktop\source\repos\cora-med
WORKSPACE_BASE_URL=http://localhost:4319 \
WORKSPACE_AGENT_CLIENT=<emitido pelo Workspace> \
WORKSPACE_AGENT_SECRET=<emitido pelo Workspace> \
WORKSPACE_DELEGATION_TOKEN=<token de delegação> \
MOTOR_PROVIDER=gemini \
GEMINI_API_KEY=<chave do Google AI Studio> \
pnpm --filter @cora/server run dev
```

**O que aparece se der certo:**
```
Cora escutando em http://127.0.0.1:4320 — GET /health, POST /turno
```

```bash
curl -s http://127.0.0.1:4320/health
# {"status":"ok","contrato":"0.2.1"}

curl -s -X POST http://127.0.0.1:4320/turno \
  -H 'Content-Type: application/json' \
  -d '{"requester":{"requesterUserId":"...","deviceId":null},"mensagem":"..."}'
```

**Se der errado:**
- Falta qualquer variável (`WORKSPACE_BASE_URL`, `WORKSPACE_AGENT_CLIENT`,
  `WORKSPACE_AGENT_SECRET`, `WORKSPACE_DELEGATION_TOKEN`, e `ANTHROPIC_API_KEY` ou
  `GEMINI_API_KEY` conforme `MOTOR_PROVIDER`): o processo imprime
  `Falta a variável <NOME>. Veja a lista completa em docs/OPERATIONS.md.` e sai com
  código `2` — nenhum valor aparece impresso. Confirmado rodando sem nenhuma variável.
- `MOTOR_PROVIDER` com valor que não é `anthropic` nem `gemini`: mesma saída, código `2`,
  nomeando os dois valores aceitos.
- Corpo malformado ou sem `requester`: `400`/`422`/`413`/`415` com corpo
  `{"erro":{"categoria":"...", "mensagem":"..."}}` — nunca com stack.
- Motor ou Workspace falharam: `502`, mesmo formato de corpo; o motivo real vai só para o
  log do processo, nunca para a resposta HTTP.
- Falha interna inesperada: `500` com corpo genérico fixo — também nunca com stack.
- Cabeçalho `Host` que não bate com este servidor (defesa contra DNS rebinding): `400`
  `host_nao_permitido`.

**Porta**: `CORA_PORT`, padrão `4320`. **4319 é o Workspace — não confundir os dois.**

⚠️ **A conversa real com a Anthropic não foi comprovada nesta entrega.** O servidor foi
testado de ponta a ponta com `ScriptedMotor` (sem rede) e subiu de verdade com uma chave
sintética — o que prova é o encaixe HTTP ↔ `runTurn`. Nenhuma chamada real à Anthropic foi
feita; isso continua em aberto no `docs/ROADMAP.md`.

**A chamada real ao Gemini (motor de teste, ADR 0003) foi feita e provada em 04/09/2026**
— fora do servidor HTTP, direto no adaptador (`GeminiMotor`), com a chave criada nessa
sessão. Prova completa em `docs/decisions/0003-motor-de-teste-gemini.md`.

## Variáveis de ambiente

O arquivo de exemplo **não existe** neste repositório, e não é esquecimento: as regras de
permissão **desta máquina** bloqueiam criar, editar e até ler qualquer caminho `.env*` —
inclusive o exemplo, que não tem segredo nenhum dentro. Só a mão do dono cria esse arquivo.

Enquanto isso, **esta lista aqui é a canônica** — e ela está completa. Quem for criar o
arquivo de exemplo, copie o bloco abaixo inteiro:

```
# URL do Workspace local com banco isolado.
# ⚠️ A porta é 4319, não 3000. O valor 3000 esteve aqui e mandava quem seguisse a
# documentação para uma porta em que o Workspace nunca esteve.
WORKSPACE_BASE_URL=http://localhost:4319

# Credencial do SERVIÇO Cora — DUAS metades, conforme o contrato.
# Emitidas por `pnpm agente cliente --nome <nome>`, no repositório do Workspace.
WORKSPACE_AGENT_CLIENT=
WORKSPACE_AGENT_SECRET=

# Token de delegação que representa o usuário humano. Expira e é revogável.
# Formato exato definido pelo contrato workspace-agent-v1 (ticket CORA-001).
WORKSPACE_DELEGATION_TOKEN=

# Chave da API do provedor de modelo (ADR 0002). Sem ela não há conversa; a consulta
# de tarefas da Fase 1 continua funcionando. É SEGREDO: nunca versionar o valor.
ANTHROPIC_API_KEY=

# Qual motor o processo usa: "anthropic" (padrão, produção) ou "gemini" (ADR 0003, motor
# de teste gratuito, TEMPORÁRIO). Omitir equivale a "anthropic".
MOTOR_PROVIDER=

# Chave do Google AI Studio, só lida quando MOTOR_PROVIDER=gemini (ADR 0003). Nível
# gratuito, sem faturamento — mesmo assim é SEGREDO: nunca versionar o valor.
GEMINI_API_KEY=

# Só para os scripts de verificação (scripts/verificacao-fase-0*.ts). A aplicação NÃO
# lê estes: ela usa WORKSPACE_DELEGATION_TOKEN. TOKEN_A precisa de "tasks:read
# tasks:write"; TOKEN_SO_LEITURA, da mesma pessoa, só de "tasks:read".
TOKEN_A=
TOKEN_SO_LEITURA=

# Timeout de rede em milissegundos.
WORKSPACE_TIMEOUT_MS=10000

# Porta em que o servidor HTTP da Cora escuta. Padrão 4320 se omitida — 4319 é o
# Workspace, não confundir os dois processos.
CORA_PORT=4320

# Tetos de execução, aplicados pela própria aplicação.
CORA_MAX_MODEL_CALLS=10
CORA_MAX_RUN_SECONDS=120

# Chave do código de minimização do log de execução (HMAC). Opcional.
# Sem ela, uma chave aleatória por processo: o código correlaciona execuções da mesma
# sessão e some no reinício. Defina para correlacionar entre reinícios.
# É segredo: nunca versionar o valor.
CORA_LOG_HASH_KEY=
```

Nenhum valor real de segredo entra em arquivo versionado. `.env` está no `.gitignore`.

## Integração real com o Workspace (Fase 1)

```bash
pnpm run integracao:tarefas
```

O contrato está fixado (**0.2.1**, hash `19009cb7…1b50e`), então o script roda. Ele imprime
data, SHA dos dois repositórios, versão do contrato, alvo, resultado, número de páginas e
os **ids** das tarefas — sem título, para não vazar conteúdo.

**Antes** é preciso subir o Workspace local e emitir credenciais, no repositório dele:

```bash
cd /c/Users/Desktop/source/repos/workspace-medconsultoria
pnpm db:up && pnpm dev            # API em :4319, MySQL em 127.0.0.1:3307
pnpm contas:teste                 # admin@teste.local etc., senha teste1234
pnpm agente cliente --nome cora-dev
pnpm agente delegar --cliente <clientId> --email admin@teste.local --minutos 60
```

**Confira que subiu:** `curl -s http://localhost:4319/health` → `{"status":"ok",...}`.

⚠️ **Nunca rode `pnpm --filter @app/api test` no Workspace** — parte das integrações dele
envia e-mail de verdade. Esta sessão não executou a suíte de lá.

⚠️ **O segredo do serviço e o token aparecem UMA vez.** Perdeu, emita outro.

## Verificação completa da Fase 1

```bash
WORKSPACE_BASE_URL=http://localhost:4319 \
WORKSPACE_AGENT_CLIENT=... WORKSPACE_AGENT_SECRET=... \
TOKEN_A=... TOKEN_B=... TOKEN_EXPIRADO=... \
pnpm exec tsx scripts/verificacao-fase-01.ts
```

**O que aparece se der certo:** uma tabela de 16 linhas e
`TODAS AS 16 VERIFICAÇÕES PASSARAM`, com código de saída 0.

Este script **não** entra em `pnpm run test`: a suíte padrão continua sem rede. `TOKEN_B`
é a delegação de `funcionario@teste.local` (o "usuário B" do isolamento) e `TOKEN_EXPIRADO`
sai de `pnpm agente delegar ... --minutos -1`.

O cenário A/B precisa de dados nos dois lados; sem isso o teste de isolamento passa por
vacuidade e não prova nada. As fixtures usadas estão descritas na evidência
`med-coordination/evidence/cora/2026-09-03-fase-01-tarefas.md` (prefixo `CORA-T-`,
rollback de duas linhas). CORA-002 pede ao WORKSPACE um comando de semeadura, para isso
deixar de ser SQL nosso.

## Verificação completa da Fase 2 (a ESCRITA)

```bash
WORKSPACE_BASE_URL=http://localhost:4319 \
WORKSPACE_AGENT_CLIENT=... WORKSPACE_AGENT_SECRET=... \
TOKEN_A=... TOKEN_SO_LEITURA=... \
pnpm exec tsx scripts/verificacao-fase-02.ts
```

**O que aparece se der certo:** uma tabela de 28 linhas e
`TODAS AS 28 VERIFICAÇÕES PASSARAM`, com código de saída 0.

⚠️ **Este script CRIA tarefas de verdade** no banco local — 14 criações, contando as
recusadas. Só rode contra um Workspace de desenvolvimento. Todo título nasce com o prefixo
`SYNTH-verificacao-fase-02` mais o horário da rodada, então dá para achar e apagar tudo
com um `LIKE`.

`TOKEN_A` precisa de **`tasks:read tasks:write`**. `TOKEN_SO_LEITURA` é a mesma pessoa com
**só `tasks:read`** — sem ele, duas verificações saem como `PULADO`: que a prévia exige
escopo de escrita mesmo sem escrever nada (C6.11), e que a criação com delegação de leitura
dá 403 (C6.24).

Quatro verificações dependem das fixtures `cora-fx-*` do Workspace
(`pnpm agente:fixtures` lá): cliente único, cliente homônimo e as duas de injeção.

⚠️ **O texto hostil existe em DOIS artefatos**, e confundi-los faz uma verificação passar
pelo motivo errado: `cora-fx-cli-injecao` é o **cliente** (nome = `Clinica CORA ` + o
texto) e `cora-fx-injecao` é a **tarefa**, com o texto sozinho no título. Há um
`slice(0, 120)` no código deles que já foi descrito aqui como truncamento real — **não é**:
o texto tem 84 caracteres e o prefixo 13, então nada é cortado. A busca da prévia só alcança o cliente; a tarefa
aparece no `GET /tasks` e já foi exercida na Fase 1 (C5.15). O termo é `Ignore as
instruções`, e a C6.27 existe só para provar que ele resolve **um** cliente — sem ela, a
C6.26 passaria por ambiguidade e estaria provando outra coisa.

**C6.25 dispara duas criações em paralelo com a mesma `Idempotency-Key`.** É a prova W15 do
Workspace vista do lado de fora. Se vier `201` nas duas, o defeito é do índice único deles,
não desta verificação — o script mostra os dois resultados crus na coluna "obtido".

## Coordenação entre as duas sessões

As duas janelas do VS Code **não conversam sozinhas**. O fluxo é manual e é este:

1. Nesta janela (Cora), o ticket CORA-001 já está escrito.
2. Thiago abre `workspace-medconsultoria` em outra janela e cola o prompt da seção 17 do
   briefing.
3. Quando aquela sessão escrever `response.md`, Thiago volta aqui e diz:
   **"Leia a caixa de entrada de coordenação e prossiga"**.

Não há watcher, não há automação, não há aprovação simulada. E não fazemos espera em
laço: sem resposta, o estado vira `blocked` e a sessão devolve o próximo passo humano.

## Git

- Os dois repositórios do GitHub **nasceram públicos**. Foram tornados **privados** pelo
  Thiago em 02/09/2026, **antes** do primeiro push — nada foi publicado enquanto estavam
  abertos. A mudança de visibilidade exige a mão dele: o classificador do harness bloqueia
  `gh repo edit --visibility` nesta sessão.
- `med-coordination`: branch `main`, publicada.
- `cora-med`: `main` com o commit de base, `fase-0/fundacao` com a entrega, PR #1 aberto.
- Nesta máquina, **só a sessão CORA roda Git em `med-coordination`**.

## Ainda não existe

Banco de dados, publicação, Docker, CI. Nada disso foi criado, e nada foi publicado em
lugar nenhum. VPS, DNS e implantação seguem no roteiro (Fase 7), sem nenhuma ação tomada.

O servidor HTTP passou a existir (seção acima) — o que continua faltando nele é
autenticação de usuário humano, CORS, streaming de resposta, rate limit por IP e
persistência; nenhum tem cliente real esperando ainda (ver
`docs/esteira/fase-2b-servidor-conversa/spec.md`).
