# Arquitetura da Cora

Fonte canônica do produto: `../med-coordination/CORA-MED-START-HERE.md`, seção 4.
Este documento descreve o que **existe no código** e o que está **planejado**, separados.

## A divisão que decide tudo

**Workspace** guarda a verdade operacional e manda em autorização. **Cora** guarda
conversa, preferência, execução, aprovação e dispositivos.

A Cora nunca cria cadastro empresarial paralelo. Não há tabela de "tarefas da Cora". Se
a informação é da empresa, ela mora no Workspace e a Cora consulta por API versionada.

## O caminho de uma ação (implementado)

```
usuário → POST /turno
            ↓
      valida corpo (Zod) → monta RequesterContext
            ↓
      runTurn()  ← aplica teto de chamadas, teto de tempo, cancelamento
            ↓
      MotorPort.step()   → devolve PROPOSTAS, nunca executa
            ↓
      decide()   ← política: catálogo fechado + categoria de risco + aprovação por hash
            ↓
   allow  |  needs_approval  |  deny
            ↓
      ToolRegistry.get(nome)  ← só executa o que tem executor registrado
            ↓
      WorkspaceClient  → HTTP com credencial de serviço + token de delegação
            ↓
      ExecutionRecord  ← quem pediu, qual ferramenta, forma dos argumentos, estado
```

Regra estrutural: **o modelo propõe, o código decide.** Não existe caminho em que uma
saída de modelo vire efeito sem passar por `decide()`.

## Peças

| Pacote | Papel | Estado |
|---|---|---|
| `packages/contracts` | schemas Zod do contrato do Workspace + tipos internos | implementado |
| `packages/workspace-client` | HTTP, erros tipados, paginação com detecção de duplicata e de laço, timeout | implementado |
| `packages/policy` | catálogo fechado de ferramentas, categorias de risco, hash de aprovação, bloco de dado não confiável | implementado |
| `apps/server` | `MotorPort`, `AnthropicMotor` + `GeminiMotor` (ADR 0003, teste), registro de ferramentas, laço `runTurn`, servidor HTTP (`GET /health`, `POST /turno`) | implementado e testado sem rede; chamada real exercida no `GeminiMotor`, ainda não no `AnthropicMotor` |
| `apps/desktop` | aplicativo Windows (Electron) | **não existe** |

## Decisões que já valem

**Motor.** ADR 0001: Hermes **não** embutido. Orquestrador próprio atrás de `MotorPort`.
`HermesMotorAdapter` existe e falha de propósito.

**Provedor de modelo.** ADR 0002: API da Anthropic, modelo `claude-opus-5`, raciocínio
adaptativo, esforço `medium`. O cliente entra por injeção em `AnthropicMotor`, e é por isso
que a suíte continua sem rede. O custo por passo é calculado com preço **verificado e
datado** em `pricing.ts`; modelo fora da tabela produz custo `null`, nunca zero.

**Motor de teste, temporário.** ADR 0003: `GeminiMotor`, sobre o nível gratuito do Google
AI Studio (modelo `gemini-3.6-flash`, escolhido por chamada real, não por documentação —
os dois "melhores" candidatos falharam: `3.8-flash` sobrecarregado, `2.5-flash`
aposentado). Escolhido por `MOTOR_PROVIDER=gemini` em vez de `AnthropicMotor`, sem tocar
`runTurn` nem política. Custo real: zero, sem faturamento habilitado no projeto do Google.
Tem uma degradação de esquema conhecida e testada: a API do Gemini não suporta `oneOf`,
então a regra "informe `id` OU `texto`, nunca os dois" sai do esquema JSON e vira só
instrução em texto — quem valida de verdade continua sendo o servidor.

**Esquema de ferramenta é fronteira do motor.** `tool-schemas.ts` descreve os argumentos
de cada ferramenta oferecida ao modelo, e só cobre o que tem executor hoje. Ferramenta do
catálogo sem esquema **não é oferecida**, e o adaptador falha alto em vez de deixar o
modelo inventar argumento.

**Contrato fixado, não seguido às cegas.** `CONTRACT_VERSION` e `CONTRACT_SHA256` vivem
no código da Cora. Enquanto o SHA for `null`, o script de integração recusa rodar. Resposta
com `contractVersion` diferente é recusada.

**Erro nunca vira vazio.** Falha de rede, timeout, 503, corpo fora do contrato — tudo vira
`WorkspaceApiError`. `describeTasksForUser()` tem frases distintas para "nada encontrado" e
"não consegui consultar", com teste travando as duas.

**Conteúdo externo é dado.** Título de tarefa, e-mail e documento passam por
`wrapUntrusted()`. Mas a defesa que segura é estrutural: catálogo fechado e aprovação por
hash. O bloco de texto é a camada de cima, não a única.

O motor **exige** a marca em vez de confiar em quem chamou: resultado de ferramenta sem
bloco não confiável é erro alto, não conteúdo aceito.

**Conteúdo externo tem teto de tamanho.** `MAX_CHARS_RESULTADO` (8 mil caracteres) corta
cada resultado **antes** de embrulhar — cortar depois decepa o marcador de fechamento e o
bloco vaza. Existe por custo real: o contrato não limita o título da tarefa, o histórico é
reenviado a cada um dos dez passos do turno, e quem consegue criar uma tarefa para a Thaís
transformaria cada pergunta dela em dólares. O corte é visível, com a contagem do que ficou
de fora.

**Uma instância de motor serve um turno.** `AnthropicMotor` se amarra ao `runId` do
primeiro passo e recusa outro. Sem isso, um motor único por processo — o jeito natural de
injetar dependência — levaria o histórico de uma pessoa para dentro da resposta a outra.

**Tetos são da aplicação.** 10 chamadas de modelo e 120 segundos por padrão, aplicados em
`runTurn`. Alerta de provedor não é corte.

**Servidor HTTP sem framework.** `apps/server/src/http` usa `node:http` puro — o
repositório não tinha nenhum framework instalado, e o gargalo real de qualquer chamada é
o provedor de modelo (segundos), não o roteamento HTTP (microssegundos). Testar bate um
`fetch()` numa porta efêmera (`server.listen(0)`) dentro do próprio teste vitest, sem
precisar de `supertest` nem de dependência nova.

**Um motor por requisição HTTP, sempre.** `POST /turno` chama `criarMotor()` **dentro**
do handler, nunca fora dele — a mesma regra de `AnthropicMotor` amarrado a um `runId`
(acima) vale aqui: hoistar a criação do motor para o boot do processo levaria o histórico
de uma pessoa para a resposta a outra.

**Erro HTTP nunca carrega `MotorError.message` nem `WorkspaceApiError.message`.** Os dois
podem ecoar trecho da própria requisição — por isso a tradução para o corpo HTTP
(`http/erros.ts`) é só por categoria fechada; o texto original vai apenas para o log do
processo.

## Ainda planejado

- **Persistência da Cora**: MySQL, banco lógico/usuário separado do Workspace. Nada
  escrito ainda.
- **Desktop Windows**: Electron + React, com `contextIsolation`, sandbox do renderer,
  `nodeIntegration` desligado e IPC com schema + allowlist. Pareamento por código curto
  e expirável.
- **Android**: Workspace responsivo com PWA, não app nativo.
- **Voz**: botão e atalho primeiro; wake word PT-BR só depois de comprovada no
  equipamento da Thaís.
- **Automação local**: ordem de preferência API → DOM/Playwright → UI Automation →
  visão. Perfil de navegador dedicado, nunca o pessoal da Thaís.

## Distinções que a Cora não pode borrar

**Tarefa** = pedido interno delegado. **Card** = etapa de projeto. **Evento** =
compromisso de agenda. São três entidades diferentes no Workspace e continuam três na
Cora. Nada de unificar em "tarefa empresarial".
