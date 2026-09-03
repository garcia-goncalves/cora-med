# Terceiros e licenças

## Dependências em uso

| Pacote | Para quê | Licença |
|---|---|---|
| `zod` | validação de schema no limite de dado externo | MIT |
| `typescript` | tipos | Apache-2.0 |
| `vitest` | testes | MIT |
| `tsx` | rodar TypeScript direto | MIT |
| `@types/node` | tipos do Node | MIT |

As licenças acima são as declaradas pelos projetos. Confirmar no `node_modules` antes de
qualquer distribuição do produto — leitura de campo de metadado não substitui o arquivo
`LICENSE`.

## Avaliado e não adotado

**Hermes Agent** — `NousResearch/hermes-agent`, commit
`7840a0e2d96b66a5c6b2a219f79af1900a74e03c`, licença declarada MIT, Python.
**Não adotado** nesta fase; motivo em `docs/decisions/0001-agent-runtime.md`.
Nenhum código do Hermes foi copiado para este repositório.

**OpenClaw** — `openclaw/openclaw`, TypeScript. A API do GitHub reporta a licença como
`NOASSERTION`, ou seja **não identificada automaticamente**. Qualquer uso exige ler o
arquivo de licença do commit escolhido antes. Não avaliado a fundo.

**Playwright** — `microsoft/playwright`. Candidato para automação de navegador na Fase 6.
Não instalado.

## Regras que valem para qualquer coisa que entrar

1. **Licença de motor não é licença de pesos.** MIT no código de um agente não diz nada
   sobre o modelo de voz, de transcrição ou de linguagem que ele baixa. Cada peso tem
   licença própria e precisa ser verificada separadamente.
2. **Preservar `LICENSE` e avisos**, inclusive de dependências transitivas, se algum dia
   houver redistribuição.
3. **Verificar no commit adotado**, não na página do projeto. Licença muda.
4. **Nenhuma mídia com direito autoral de terceiro**, nem em protótipo descartável. Ou
   geramos, ou vem de banco gratuito com licença comercial, com origem registrada.

## Modelos de linguagem

Nenhum provedor foi escolhido ou configurado. Os modelos encontrados no Workspace
(`gpt-4o-mini`, `whisper-1`) **não** são decisão para a Cora.

Quando houver escolha, ela entra como ADR e traz: provedor, modelo, forma de contagem de
tokens e **preço verificado na data**. Sem preço conhecido, o custo é registrado como
**desconhecido**, nunca como zero.
