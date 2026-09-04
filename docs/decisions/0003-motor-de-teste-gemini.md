# ADR 0003 — motor de teste sobre o Gemini gratuito

- **Estado:** aceita, **temporária por natureza**
- **Data:** 04/09/2026
- **Decide:** um segundo `MotorPort` para a Fase 2 testar conversa de verdade sem gastar
  dinheiro, antes de ligar a Anthropic (ADR 0002) com chave paga.
- **Depende de:** ADR 0001 (o motor é próprio, atrás de `MotorPort`) e ADR 0002 (o
  provedor de produção continua sendo a Anthropic — esta ADR não a substitui).
- **Reabre-se automaticamente** quando: a fase de teste terminar (nesse ponto, a ADR 0002
  volta a valer sem precisar de nova decisão) ou quando o Google desativar o nível
  gratuito do modelo escolhido.

## Contexto

O dono pediu para não gastar dinheiro na fase de teste da Cora, mesmo sabendo que o custo
real da Anthropic (ADR 0002) é pequeno (estimativa não medida, na casa de poucos dólares
por mês no volume de uma pessoa testando todo dia). A instrução foi explícita: usar uma
API "bem barata" agora, e trocar para a Anthropic depois, quando a fase de teste acabar.

Comparado nesta mesma conversa: Claude Max 20x (assinatura pessoal do dono) **não pode**
autenticar um servidor de produção de terceiros — é uma conta separada da API, e usar o
login pessoal para isso viola os termos da assinatura. ChatGPT Plus tem a mesma separação
frente à API da OpenAI. Das opções realmente gratuitas ou quase gratuitas comparadas
(Gemini nível gratuito, DeepSeek, OpenAI GPT-4o-mini, Claude Haiku), só o **Gemini nível
gratuito do Google AI Studio** custa **zero de verdade**, sem cartão associado — as outras
custam centavos, mas exigem crédito pago.

## Decisão

**Motor de teste: `GeminiMotor`, sobre a API REST `generateContent` do Gemini (Google AI
Studio), no projeto padrão, sem faturamento habilitado.**

Implementado atrás do mesmo `MotorPort` da ADR 0001 — nenhuma outra parte do sistema (o
laço `runTurn`, o `ToolRegistry`, o servidor HTTP) sabe que existe um Gemini. A escolha de
motor entra por variável de ambiente:

| `MOTOR_PROVIDER` | Motor | Chave exigida |
|---|---|---|
| (omitido) ou `anthropic` | `AnthropicMotor` (ADR 0002, produção) | `ANTHROPIC_API_KEY` |
| `gemini` | `GeminiMotor` (esta ADR, teste) | `GEMINI_API_KEY` |

**Chave criada na conta correta.** A chave de teste foi gerada na conta Google
`faturamentomedconsultoria@gmail.com` (a de faturamento da clínica), não numa conta
pessoal — a sessão que criou a chave abriu por engano numa conta pessoal e trocou antes de
gerar qualquer coisa. Projeto "Default Gemini Project", nível gratuito, sem cartão.

**Modelo, escolhido por chamada real, não por documentação:**

| Modelo tentado | Resultado |
|---|---|
| `gemini-3.8-flash` (mais novo, lançado 02/09/2026) | `503 UNAVAILABLE` — alta demanda, 3 tentativas |
| `gemini-2.5-flash` | `404` — aposentado para contas novas; a própria API recomendou `gemini-3.6-flash` na mensagem de erro |
| **`gemini-3.6-flash`** | **respondeu** — é o padrão do adaptador |

Prova, rodada nesta sessão (04/09/2026), chamada de verdade contra a API:

```json
{
  "candidates": [{ "content": { "parts": [{ "text": "Oi, tudo bem com você?" }] }, "finishReason": "MAX_TOKENS" }],
  "usageMetadata": { "promptTokenCount": 11, "candidatesTokenCount": 7, "thoughtsTokenCount": 289 },
  "modelVersion": "gemini-3.6-flash"
}
```

**Observação de comportamento, não só de formato:** este modelo gasta boa parte do
orçamento de saída em raciocínio interno (`thoughtsTokenCount`) antes de escrever a
resposta visível — no teste acima, 289 de 300 tokens disponíveis. Com `maxOutputTokens`
baixo, a resposta pode ser cortada (`finishReason: "MAX_TOKENS"`) antes de aparecer nada
útil. O padrão do adaptador (`maxTokens: 4096`) dá folga para isso na prática; é algo a
observar se a Thaís relatar respostas cortadas.

**Custo: `custoUsd: 0`, não `null`.** Diferente de `pricing.ts` (Anthropic), onde modelo
sem preço na tabela produz `null` — "não sei" —, aqui o custo É zero de verdade: o projeto
não tem cartão associado, então estourar a cota gratuita produz `429`, nunca cobrança.
Documentado em `gemini-pricing.ts`, com o aviso de que isso deixa de valer no dia em que
alguém habilitar faturamento nesse projeto do Google.

## Degradações conhecidas — aceitáveis num motor de TESTE, não em produção

A API de function calling do Gemini não suporta todo o JSON Schema que `tool-schemas.ts`
usa (confirmado em 04/09/2026):

1. **`oneOf` não é suportado.** `tool-schemas.ts` usa `oneOf` para expressar "informe
   `id` OU `texto`, nunca os dois" (referências a cliente, projeto, responsáveis). O
   tradutor (`traduzirEsquemaParaGemini`) achata isso num objeto único com os dois campos
   opcionais — a regra "exatamente um" sai do esquema e vira só instrução em texto. Quem
   valida de verdade continua sendo o servidor (mesma trava de sempre), mas o esquema
   fica mais fraco: nada impede o modelo de mandar os dois campos juntos.
2. **`maximum` não é suportado.** `workspace.tasks.list.limit` perde o teto de 100 no
   esquema — a descrição do campo continua orientando, mas sem trava.

Ambas as degradações têm teste (`gemini-adapter.test.ts`, describe
`traduzirEsquemaParaGemini`) que prova o comportamento, não só documenta.

## O que esta ADR NÃO decide

- **Não substitui a ADR 0002.** A Anthropic continua sendo o motor de produção. Quando a
  fase de teste terminar, a mudança é trocar `MOTOR_PROVIDER` de volta (ou removê-lo, já
  que `anthropic` é o padrão) — nenhum código muda.
- **Não afirma que o Gemini é bom o bastante para produção.** A qualidade da extração de
  intenção em português com este modelo não foi medida além de "respondeu à pergunta
  feita" — é prova de encaixe, não de qualidade.
- **Não resolve as degradações de esquema.** Um motor de teste pode conviver com elas;
  um motor de produção, tocando prontuário de clínica, não pode.

## Como isto foi verificado

- Chamada real contra `generativelanguage.googleapis.com`, sem mock, com a chave criada
  nesta sessão — prova acima.
- Suíte completa depois da mudança: `pnpm run test` — **310 testes, 17 arquivos, todos
  sem rede** (os 28 novos do Gemini incluídos) — e `pnpm run typecheck` limpo.
- A chave nunca apareceu em texto nesta conversa, em log de commit, nem em arquivo
  versionado: foi copiada da tela para a área de transferência do Windows, gravada direto
  em `.env` (que está em `.gitignore`) por um comando que nunca ecoa o valor, e a área de
  transferência foi limpa em seguida.
