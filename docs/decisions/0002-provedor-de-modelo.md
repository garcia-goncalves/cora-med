# ADR 0002 — provedor e modelo de linguagem da Cora

- **Estado:** aceita
- **Data:** 03/09/2026
- **Decide:** provedor, modelo, forma de contagem de tokens e preço.
- **Depende de:** ADR 0001 (o motor é próprio, atrás de `MotorPort`).
- **Não decide:** o contrato de escrita no Workspace — isso é o CORA-003.

## Contexto

A Fase 2 precisa de um motor de verdade. Até aqui `MotorPort` tinha duas
implementações e nenhuma servia: `ScriptedMotor`, que é roteiro de teste, e
`HermesMotorAdapter`, que falha de propósito porque a ADR 0001 decidiu não embutir o
Hermes.

A escolha aqui é estreita por construção. A ADR 0001 já decidiu que o **laço é nosso**:
o motor propõe, `runTurn` decide, e os tetos (10 chamadas de modelo, 120 segundos) são
da aplicação. Logo esta decisão não escolhe um *framework de agente* — escolhe **quem
responde a uma chamada de "dado este histórico, o que você propõe"**.

## Decisão

**Provedor: Anthropic, API direta (primeira parte), pelo SDK oficial
`@anthropic-ai/sdk`.**

**Modelo: `claude-opus-5`.**

**Parâmetros fixados no adaptador:**

| Parâmetro | Valor | Por quê |
|---|---|---|
| `thinking` | `{ type: 'adaptive' }` | O raciocínio é adaptativo por padrão neste modelo; fixar orçamento de tokens de raciocínio foi removido da API e devolve erro 400. |
| `output_config.effort` | `medium` | A tarefa é extração de intenção sobre texto curto em português, não é código nem cadeia longa. `high` é o padrão da API e custa mais sem ganho medido aqui. Ajustável na construção do adaptador — **não** há variável de ambiente para isto hoje. |
| `max_tokens` | 4096 | A resposta da Cora é uma frase e/ou uma proposta de ferramenta. Nada aqui produz texto longo. |
| `temperature` | **não enviado** | Foi removido da API nesta família de modelos e devolve 400. |
| Prefill de assistente | **não usado** | Removido nesta família; devolve 400. |

**Contagem de tokens:** a do próprio provedor, lida em `response.usage` de cada
resposta (`input_tokens`, `output_tokens`, `cache_read_input_tokens`,
`cache_creation_input_tokens`). **Não** estimamos por caractere e **não** usamos
tokenizador de terceiro: este modelo usa um tokenizador próprio, e contar por fora
produziria um número que parece exato e está errado.

## Preço — verificado na fonte oficial em 03/09/2026

Fonte: `https://platform.claude.com/docs/en/about-claude/pricing`, consultada em
**03/09/2026**. Valores em dólar por **milhão** de tokens.

| Modelo | Entrada | Escrita de cache (5 min) | Leitura de cache | Saída |
|---|---|---|---|---|
| `claude-opus-5` (**o escolhido**) | $5,00 | $6,25 | $0,50 | $25,00 |
| `claude-sonnet-5` | $2,00 | $2,50 | $0,20 | $10,00 |
| `claude-haiku-4-5` | $1,00 | $1,25 | $0,10 | $5,00 |

**Regra dura, e ela está no código:** preço só entra em conta quando o modelo está
nessa tabela, com a data da verificação junto. Modelo fora da tabela produz
`custoUsd: null` — **desconhecido**, nunca zero. Um zero aqui vira relatório de custo
que mente para baixo, e ninguém revisa um número que parece bom.

A tabela **envelhece**. Ela carrega a data em `PRECOS_VERIFICADOS_EM`, e há teste que
falha quando a distância entre essa data e hoje passa de 180 dias — o teste não
adivinha o preço novo, ele obriga alguém a ir conferir.

### Ordem de grandeza por conversa

Uma conversa da Thaís é curta: instrução do sistema, o pedido dela e um ou dois
resultados de ferramenta. Com folga, algo como 3 mil tokens de entrada e 500 de saída
por turno:

- entrada: 3.000 × $5 ÷ 1.000.000 = **$0,015**
- saída: 500 × $25 ÷ 1.000.000 = **$0,0125**
- total por turno: **cerca de US$ 0,028**, uns 15 centavos de real

Cem turnos por dia útil dariam algo perto de **US$ 2,80 por dia**. Isso é **estimativa
sobre volume suposto**, não medição — o volume real da Thaís ninguém mediu ainda. O
número que vale é o que o `onUsage` do adaptador registrar em uso real.

## Alternativas consideradas

**`claude-sonnet-5`** — 2,5 vezes mais barato. Rejeitado **agora**, não para sempre. O
erro que importa nesta aplicação não é texto feio: é a Cora **escolher calado** entre
dois médicos com o mesmo sobrenome, ou preencher um prazo que a Thaís não disse. Esse
é exatamente o tipo de erro que aparece quando o modelo é bom o bastante para parecer
confiante. A conta acima mostra que a diferença de preço é de centavos por dia neste
volume — trocar qualidade por centavos, num sistema que escreve no Workspace de uma
clínica, é péssimo negócio. Se a medição de uso real mostrar volume muito maior, a
troca é uma linha de configuração, e este parágrafo é o que deve ser relido antes.

**`claude-haiku-4-5`** — mais barato ainda, mesmo raciocínio, com margem menor.

**Provedor de outra empresa** — não avaliado, e o motivo é honesto: não há requisito de
negócio que empurre para lá, e avaliar bem custa tempo que a Fase 2 não tem. Fica
registrado como não avaliado, e não como avaliado e descartado.

**Hospedar modelo aberto na máquina local** — descartado. A máquina da clínica não tem
GPU, o custo real seria o tempo de manutenção, e a Fase 2 precisa de qualidade de
extração de intenção em português.

## Consequências

**Boas:**

- O `MotorPort` continua sendo a única fronteira. Trocar de provedor é escrever outro
  adaptador, não reescrever o produto — que era o ponto inteiro da ADR 0001.
- O custo passa a ser **observável por turno**, com número do provedor e não estimativa
  nossa.

**Custos aceitos:**

- **Dependência de rede e de um fornecedor** para a conversa funcionar. A Fase 1
  (consulta de tarefas) não depende disso e continua funcionando com o motor fora do ar.
- **Uma chave de API vira segredo de operação.** Ela mora em variável de ambiente
  (`ANTHROPIC_API_KEY`), nunca em código, log, commit ou memória. O adaptador **não**
  imprime a chave nem o corpo das requisições.
- **O preço envelhece.** Mitigado pelo teste de validade da tabela, não por disciplina.

**O que continua exatamente como estava, e o adaptador não pode afrouxar:**

- o motor **propõe**, `runTurn` decide;
- conteúdo externo entra embrulhado por `wrapUntrusted`;
- tetos de chamadas e de tempo são da aplicação;
- o catálogo de ferramentas é fechado, e não existe `exec` genérico.

## Como isto foi verificado

- Preço lido na página oficial em 03/09/2026 e transcrito para
  `apps/server/src/engine/pricing.ts` com a data junto.
- Identificadores de modelo e forma dos parâmetros conferidos na referência `claude-api`
  antes de escrever a primeira linha — memória não é fonte para id de modelo.
- O adaptador é testado **sem rede**: o cliente entra por injeção, e a suíte usa um
  cliente falso. `pnpm run test` continua sem tocar a internet.
- **Não verificado, e não vale alegar que foi:** nenhuma chamada real à API da Anthropic
  foi feita por esta sessão. A qualidade da extração de intenção em português **não** foi
  medida. Isso é trabalho da Fase 2 com dado real, e entra na evidência de lá.
