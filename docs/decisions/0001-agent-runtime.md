# ADR 0001 — Motor de agente da Cora

- **Data:** 02/09/2026
- **Estado:** aceita
- **Decide:** qual motor de agente a Cora usa na Fase 0–2
- **Substitui:** nada
- **Revisão obrigatória:** antes da Fase 5 (voz) e antes da Fase 6 (automação local)

## Contexto

O briefing (seção 5) indica o Hermes como **primeiro candidato**, explicitamente **não**
como compromisso de fundir o código-fonte. Pede uma avaliação limitada a uma sessão, com
provas de oito requisitos, e proíbe usar estrelas como critério.

## O que foi avaliado, e como

Avaliação **estática**, via API do GitHub, sem instalar nem executar o Hermes nesta
máquina. Isso é uma limitação real desta ADR e está declarada aqui de propósito.

| Item | Valor observado |
|---|---|
| Repositório | `NousResearch/hermes-agent` |
| Commit avaliado | `7840a0e2d96b66a5c6b2a219f79af1900a74e03c` |
| Data do commit | 02/09/2026 17:02 UTC |
| Branch padrão | `main` |
| Licença declarada | MIT (campo `license.spdx_id` da API) |
| Linguagem principal | Python (`.python-version`, `pyproject.toml`, `uv.lock`) |
| Arquivado | não |

Também avaliado por comparação: `openclaw/openclaw` — TypeScript, licença `NOASSERTION`
na API (ou seja, **licença não identificada automaticamente**; exigiria leitura do arquivo
antes de qualquer uso). Não foi avaliado a fundo porque o briefing proíbe rodar os dois
sem requisito que justifique ambos.

### Requisitos do briefing, e o que a inspeção mostrou

| Requisito | Evidência observada | Veredito |
|---|---|---|
| Execução de ferramenta própria | Diretórios `tools/`, `skills/`, `plugins/`, `optional-mcps/`, `toolsets.py`, `mcp_serve.py` | **atende** — e o MCP é a costura de extensão natural |
| Persistência | `hermes_state.py`, `hermes_state_registry.py`, `hermes_state_schema.py`, `hermes_state_search.py` (estado próprio, com busca FTS5 segundo o README) | **atende**, mas com banco/arquivos próprios |
| Cancelamento | README descreve TUI com "interrupt-and-redirect" | **provável**, não comprovado por execução |
| Limite de chamadas | não localizado na inspeção estática | **não comprovado** |
| Integração com API remota | providers/, adaptadores múltiplos, MCP | **atende** |
| Isolamento de ferramentas | sete backends de terminal (local, Docker, SSH, Modal, Daytona, Vercel Sandbox…) | **atende**, com custo operacional alto |
| **Contexto por usuário** | README: "builds a deepening model of who you are across sessions"; `SOUL.md`; estado por processo/máquina | **NÃO atende** — ver bloqueador 1 |
| Manutenção de upgrades | commit no mesmo dia da avaliação; ~90 módulos só em `agent/`; múltiplos gateways | **risco alto se houver fork** |

## Bloqueadores

**1. O Hermes é de um dono só; a Cora é de vários.**
O Hermes foi desenhado como assistente pessoal de **um** operador: memória, aprendizado
e "modelo de quem você é" são do processo, não de um `requesterUserId` por requisição.
A Cora precisa do oposto — toda ação carrega a identidade do usuário delegado, e o
Workspace revalida permissão a cada chamada (briefing, seção 6). Encaixar isolamento
multiusuário num motor que não nasceu assim é o tipo de adaptação que falha em silêncio,
e o que vaza é tarefa de uma pessoa aparecendo para outra.

**2. Segundo runtime.** Python ao lado do Node/TypeScript do Workspace e da Cora significa
segunda cadeia de dependências, segundo processo de atualização e segunda superfície de
segurança — num VPS de 4 vCPU que também roda MySQL, proxy, Workspace e automação de
navegador.

**3. Ritmo de mudança.** Commit no mesmo dia da avaliação, base grande. Consumir como
processo externo por uma interface estável é sustentável; manter um fork não é.

Observação de licença: MIT cobre o **código** do Hermes. **Não** cobre pesos de modelos de
voz nem dependências transitivas — o briefing é explícito nisso e a regra fica registrada
em `docs/THIRD-PARTY.md`.

## Decisão

**Não embutir o Hermes como motor da Cora nas Fases 0–2.**

Em vez disso:

1. A Cora define a porta **`MotorPort`** (`apps/server/src/engine/port.ts`) — a única
   fronteira por onde qualquer motor fala com o produto. O motor **propõe**; quem executa
   é o laço da Cora (`apps/server/src/run/turn.ts`), que aplica política, aprovação,
   tetos e cancelamento.
2. A Fase 0–1 não precisa de motor nenhum: a consulta de tarefas é uma chamada
   determinística. O motor entra na Fase 2, quando existir conversa de verdade.
3. `HermesMotorAdapter` existe, implementa `MotorPort` e **falha explicitamente**. É o
   marcador da decisão reversível, não um motor de mentira.
4. Se o Hermes for reconsiderado, o caminho é: Cora expõe suas ferramentas por **MCP** e
   fala com um processo Hermes separado — **sem fork**, sem misturar o estado dele com os
   registros da empresa.

## Consequências

**Boas:** um runtime só; identidade por requisição desde o primeiro dia; sem herdar o
ritmo de mudança de uma base de terceiro no caminho crítico; decisão reversível por uma
interface.

**Ruins:** a Cora escreve o próprio laço de agente — memória de sessão, compactação de
contexto e sub-agentes ficam por nossa conta. Se a Fase 5 (voz) ou a 6 (automação local)
mostrarem que o custo disso passou do custo de integrar, esta ADR é revisada, e o encaixe
para isso já existe.

**O que reabre a decisão:** precisar de wake word PT-BR pronta, de sub-agentes paralelos,
ou de gateway multi-plataforma (Telegram/WhatsApp) antes de termos isso de pé.

## O que esta ADR NÃO afirma

- Não afirma que o Hermes é ruim. Afirma que ele é de um dono só, e a Cora não é.
- Não afirma que o Hermes foi executado ou testado. **Não foi.**
- Não afirma nada sobre licença de pesos de modelo, nem sobre dependências transitivas.
