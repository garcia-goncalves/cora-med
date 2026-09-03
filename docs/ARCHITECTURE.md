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
usuário → mensagem
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
| `apps/server` | `MotorPort`, `AnthropicMotor`, registro de ferramentas, laço `runTurn` | implementado |
| `apps/desktop` | aplicativo Windows (Electron) | **não existe** |

## Decisões que já valem

**Motor.** ADR 0001: Hermes **não** embutido. Orquestrador próprio atrás de `MotorPort`.
`HermesMotorAdapter` existe e falha de propósito.

**Provedor de modelo.** ADR 0002: API da Anthropic, modelo `claude-opus-5`, raciocínio
adaptativo, esforço `medium`. O cliente entra por injeção em `AnthropicMotor`, e é por isso
que a suíte continua sem rede. O custo por passo é calculado com preço **verificado e
datado** em `pricing.ts`; modelo fora da tabela produz custo `null`, nunca zero.

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

**Tetos são da aplicação.** 10 chamadas de modelo e 120 segundos por padrão, aplicados em
`runTurn`. Alerta de provedor não é corte.

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
