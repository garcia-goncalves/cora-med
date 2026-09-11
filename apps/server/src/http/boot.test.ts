import { describe, expect, it, vi } from 'vitest'
import { WorkspaceClient } from '@cora/workspace-client'
import { montarFerramentas } from '../engine/tool-schemas.js'
import { ArmazemDePrevias } from '../tools/workspace-create-task.js'
import { montarRegistry, porta } from './boot.js'

function clienteFalso(): WorkspaceClient {
  return new WorkspaceClient({
    baseUrl: 'http://workspace.invalido',
    serviceClientId: 'SYNTH-client',
    serviceSecret: 'SYNTH-secret',
    delegationToken: 'SYNTH-token',
    fetchImpl: async () => new Response('{}', { status: 200 }),
  })
}

describe('montarRegistry', () => {
  it('registra exatamente as três ferramentas que têm handler hoje', () => {
    const registry = montarRegistry(clienteFalso(), new ArmazemDePrevias())
    expect(registry.availableToolNames()).toEqual([
      'workspace.inbox.resumo',
      'workspace.tasks.create',
      'workspace.tasks.list',
    ])
  })

  it('toda ferramenta registrada tem esquema — montarFerramentas não lança', () => {
    const registry = montarRegistry(clienteFalso(), new ArmazemDePrevias())
    expect(() => montarFerramentas(registry.availableToolNames())).not.toThrow()
  })
})

describe('porta', () => {
  it('usa 4320 como padrão quando CORA_PORT não está definida', () => {
    vi.stubEnv('CORA_PORT', '')
    expect(porta()).toBe(4320)
    vi.unstubAllEnvs()
  })

  it('aceita um valor numérico válido', () => {
    vi.stubEnv('CORA_PORT', '5000')
    expect(porta()).toBe(5000)
    vi.unstubAllEnvs()
  })

  it('recusa valor não numérico', () => {
    vi.stubEnv('CORA_PORT', 'abc')
    expect(() => porta()).toThrow()
    vi.unstubAllEnvs()
  })

  it('recusa 0', () => {
    vi.stubEnv('CORA_PORT', '0')
    expect(() => porta()).toThrow()
    vi.unstubAllEnvs()
  })

  it('recusa porta acima de 65535', () => {
    vi.stubEnv('CORA_PORT', '70000')
    expect(() => porta()).toThrow()
    vi.unstubAllEnvs()
  })
})
