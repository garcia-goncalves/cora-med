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
import { ArmazemDePrevias } from '../tools/workspace-create-task.js'
import { montarRegistry, porta } from './boot.js'
import { criarServidorHttp } from './server.js'

function exigir(nome: string): string {
  const valor = process.env[nome]
  if (!valor) {
    console.error(`Falta a variável ${nome}. Veja a lista completa em docs/OPERATIONS.md.`)
    process.exit(2)
  }
  return valor
}

function main(): void {
  const workspaceBaseUrl = exigir('WORKSPACE_BASE_URL')
  const serviceClientId = exigir('WORKSPACE_AGENT_CLIENT')
  const serviceSecret = exigir('WORKSPACE_AGENT_SECRET')
  const delegationToken = exigir('WORKSPACE_DELEGATION_TOKEN')
  const anthropicApiKey = exigir('ANTHROPIC_API_KEY')

  let portaEscolhida: number
  try {
    portaEscolhida = porta()
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause))
    process.exit(2)
  }

  const client = new WorkspaceClient({
    baseUrl: workspaceBaseUrl,
    serviceClientId,
    serviceSecret,
    delegationToken,
  })
  const registry = montarRegistry(client, new ArmazemDePrevias())
  const anthropic = new Anthropic({ apiKey: anthropicApiKey })
  const criarMotor = criarMotorPorTurno({ messages: anthropic.messages })

  const server = criarServidorHttp({ registry, criarMotor })

  // 127.0.0.1 explícito, não 0.0.0.0: é a primeira porta de rede desta casa e não há
  // autenticação de usuário humano ainda — nada de aceitar conexão de fora da máquina.
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
