#!/usr/bin/env node
/**
 * Entrypoint do processo HTTP da Cora.
 *
 * Uso: `pnpm --filter @cora/server run dev` (ver `docs/OPERATIONS.md`).
 *
 * Recusa subir com configuração incompleta — nomeia a variável faltante e sai com
 * código 2. Subir "meio configurado" produziria 502 em toda chamada de `/turno`, o que é
 * mais confuso que recusar na hora.
 */
import Anthropic from '@anthropic-ai/sdk'
import { WorkspaceClient } from '@cora/workspace-client'

import { criarMotorPorTurno } from '../engine/anthropic-adapter.js'
import { criarClienteGeminiHttp, criarMotorGeminiPorTurno } from '../engine/gemini-adapter.js'
import type { MotorPort } from '../engine/port.js'
import { carregarContas, type ContaConfigurada } from '../auth/contas.js'
import { criarHashArgon2id } from '../auth/senha.js'
import { ArmazemDeSessoes } from '../auth/sessao.js'
import { FreioDeTentativas } from '../auth/freio.js'
import { montarRegistryPorConta, porta } from './boot.js'
import { criarServidorHttp } from './server.js'

function exigir(nome: string): string {
  const valor = process.env[nome]
  if (!valor) {
    console.error(`Falta a variável ${nome}. Veja a lista completa em docs/OPERATIONS.md.`)
    process.exit(2)
  }
  return valor
}

/**
 * Qual motor o processo usa. Padrão `anthropic` — silêncio nunca muda o motor de
 * produção. `gemini` é a decisão TEMPORÁRIA da ADR 0003, para testar sem gastar dinheiro.
 */
function escolherCriadorDeMotor(): () => MotorPort {
  const provider = (process.env.MOTOR_PROVIDER ?? 'anthropic').trim().toLowerCase()

  if (provider === 'gemini') {
    const geminiApiKey = exigir('GEMINI_API_KEY')
    return criarMotorGeminiPorTurno({ api: criarClienteGeminiHttp({ apiKey: geminiApiKey }) })
  }

  if (provider !== 'anthropic') {
    console.error(
      `MOTOR_PROVIDER="${provider}" não existe. Use "anthropic" (padrão) ou "gemini" ` +
        '(ADR 0003, motor de teste). Veja docs/OPERATIONS.md.',
    )
    process.exit(2)
  }

  const anthropicApiKey = exigir('ANTHROPIC_API_KEY')
  const anthropic = new Anthropic({ apiKey: anthropicApiKey })
  return criarMotorPorTurno({ messages: anthropic.messages })
}

function main(): void {
  const workspaceBaseUrl = exigir('WORKSPACE_BASE_URL')
  const serviceClientId = exigir('WORKSPACE_AGENT_CLIENT')
  const serviceSecret = exigir('WORKSPACE_AGENT_SECRET')
  const criarMotor = escolherCriadorDeMotor()

  let portaEscolhida: number
  try {
    portaEscolhida = porta()
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause))
    process.exit(2)
  }

  // As duas contas nomeadas, cada uma com seu próprio token de delegação — substitui a
  // antiga variável única `WORKSPACE_DELEGATION_TOKEN` (Etapa 7 e decisão D2 da Fase 4).
  let contas: ContaConfigurada[]
  try {
    contas = carregarContas(process.env)
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause))
    process.exit(2)
  }

  const registryPorConta = montarRegistryPorConta(
    contas,
    (conta) =>
      new WorkspaceClient({
        baseUrl: workspaceBaseUrl,
        serviceClientId,
        serviceSecret,
        delegationToken: conta.tokenDeDelegacao,
      }),
  )

  // UMA só instância: é ela que faz uma sessão criada em `POST /auth/entrar` valer em
  // `POST /turno` — duas instâncias separadas fariam todo turno cair em `sessao_ausente`
  // mesmo com login bem-sucedido.
  const armazemDeSessoes = new ArmazemDeSessoes()

  const server = criarServidorHttp({
    registryDaConta: (idDaConta) => registryPorConta.get(idDaConta),
    armazemDeSessoes,
    criarMotor,
    auth: {
      contas,
      armazemDeSessoes,
      freio: new FreioDeTentativas(),
      portaDeHash: criarHashArgon2id(),
      cookieInseguro: process.env.CORA_COOKIE_INSEGURO === '1',
    },
  })

  // 127.0.0.1 explícito, não 0.0.0.0: é a primeira porta de rede desta casa. A partir da
  // Etapa 10 da Fase 4 há autenticação de usuário humano (cookie de sessão em
  // `/auth/*` e `/turno`) — mas o bind continua local: expor a porta para fora da
  // máquina é decisão de publicação, não deste processo.
  server.listen(portaEscolhida, '127.0.0.1', () => {
    console.log(
      `Cora escutando em http://127.0.0.1:${portaEscolhida} — GET /health, POST /turno`,
    )
  })

  const desligar = () => {
    server.close(() => process.exit(0))
  }
  process.on('SIGINT', desligar)
  process.on('SIGTERM', desligar)
}

main()
