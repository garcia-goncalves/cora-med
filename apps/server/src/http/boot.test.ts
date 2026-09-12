import { describe, expect, it, vi } from 'vitest'
import { WorkspaceClient } from '@cora/workspace-client'
import type { ContaConfigurada } from '../auth/contas.js'
import { montarFerramentas } from '../engine/tool-schemas.js'
import { ArmazemDePrevias } from '../tools/workspace-create-task.js'
import {
  conferirCookieInseguro,
  enderecoDeEscuta,
  hostsPermitidos,
  montarRegistry,
  montarRegistryPorConta,
  porta,
} from './boot.js'

function clienteFalso(): WorkspaceClient {
  return new WorkspaceClient({
    baseUrl: 'http://workspace.invalido',
    serviceClientId: 'SYNTH-client',
    serviceSecret: 'SYNTH-secret',
    delegationToken: 'SYNTH-token',
    fetchImpl: async () => new Response('{}', { status: 200 }),
  })
}

function contaFalsa(indice: number): ContaConfigurada {
  return {
    id: `conta-${indice}`,
    nome: `SYNTH-Pessoa ${indice}`,
    email: `synth-pessoa-${indice}@teste.local`,
    hashDeSenha: 'SYNTH-hash',
    tokenDeDelegacao: `SYNTH-token-conta-${indice}`,
  }
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

describe('montarRegistryPorConta', () => {
  it('devolve um registry por conta, cada um com o token de delegação certo', () => {
    const contas = [contaFalsa(1), contaFalsa(2)]
    const tokensRecebidos: string[] = []

    const registryPorConta = montarRegistryPorConta(contas, (conta) => {
      tokensRecebidos.push(conta.tokenDeDelegacao)
      return clienteFalso()
    })

    expect(tokensRecebidos).toEqual(['SYNTH-token-conta-1', 'SYNTH-token-conta-2'])
    expect(registryPorConta.size).toBe(2)
    expect(registryPorConta.get('conta-1')?.availableToolNames()).toEqual([
      'workspace.inbox.resumo',
      'workspace.tasks.create',
      'workspace.tasks.list',
    ])
  })

  it('cada conta ganha um ToolRegistry distinto — a fila de entrada não é compartilhada', () => {
    const contas = [contaFalsa(1), contaFalsa(2)]
    const registryPorConta = montarRegistryPorConta(contas, () => clienteFalso())

    const registryDaConta1 = registryPorConta.get('conta-1')
    const registryDaConta2 = registryPorConta.get('conta-2')
    expect(registryDaConta1).toBeDefined()
    expect(registryDaConta2).toBeDefined()
    expect(registryDaConta1).not.toBe(registryDaConta2)
  })

  it('conta desconhecida não tem entrada no mapa', () => {
    const registryPorConta = montarRegistryPorConta([contaFalsa(1)], () => clienteFalso())
    expect(registryPorConta.get('conta-99')).toBeUndefined()
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

describe('hostsPermitidos', () => {
  it('usa só os padrões quando CORA_HOSTS_PERMITIDOS não está definida', () => {
    vi.stubEnv('CORA_HOSTS_PERMITIDOS', '')
    expect(hostsPermitidos()).toEqual(['127.0.0.1', 'localhost', '[::1]', '::1'])
    vi.unstubAllEnvs()
  })

  it('acrescenta aos padrões, sem substituí-los', () => {
    vi.stubEnv('CORA_HOSTS_PERMITIDOS', 'cora.medconsultoria.com.br')
    expect(hostsPermitidos()).toEqual([
      '127.0.0.1',
      'localhost',
      '[::1]',
      '::1',
      'cora.medconsultoria.com.br',
    ])
    vi.unstubAllEnvs()
  })

  it('aceita uma lista de vários hosts separados por vírgula, com espaço tolerado', () => {
    vi.stubEnv('CORA_HOSTS_PERMITIDOS', 'a.exemplo.com, b.exemplo.com')
    expect(hostsPermitidos()).toEqual([
      '127.0.0.1',
      'localhost',
      '[::1]',
      '::1',
      'a.exemplo.com',
      'b.exemplo.com',
    ])
    vi.unstubAllEnvs()
  })

  it('recusa host vazio (vírgula sobrando)', () => {
    vi.stubEnv('CORA_HOSTS_PERMITIDOS', 'a.exemplo.com,,b.exemplo.com')
    expect(() => hostsPermitidos()).toThrow()
    vi.unstubAllEnvs()
  })
})

describe('enderecoDeEscuta', () => {
  it('usa 127.0.0.1 como padrão quando CORA_BIND não está definida', () => {
    vi.stubEnv('CORA_BIND', '')
    expect(enderecoDeEscuta()).toBe('127.0.0.1')
    vi.unstubAllEnvs()
  })

  it('aceita um endereço configurado', () => {
    vi.stubEnv('CORA_BIND', '0.0.0.0')
    expect(enderecoDeEscuta()).toBe('0.0.0.0')
    vi.unstubAllEnvs()
  })

  it('recusa valor com espaço', () => {
    vi.stubEnv('CORA_BIND', '0.0.0.0 extra')
    expect(() => enderecoDeEscuta()).toThrow()
    vi.unstubAllEnvs()
  })
})

describe('conferirCookieInseguro (item 3 da revisão de segurança da Fase 4)', () => {
  it('cookieInseguro desligado nunca lança, mesmo com host de produção na lista', () => {
    expect(() =>
      conferirCookieInseguro(false, ['127.0.0.1', 'localhost', 'cora.medconsultoria.com.br']),
    ).not.toThrow()
  })

  it('cookieInseguro ligado com só os hosts padrão não lança — ainda parece dev', () => {
    expect(() => conferirCookieInseguro(true, ['127.0.0.1', 'localhost', '[::1]', '::1'])).not.toThrow()
  })

  it('cookieInseguro ligado COM host além dos padrões recusa subir, nomeando as duas variáveis', () => {
    expect(() =>
      conferirCookieInseguro(true, ['127.0.0.1', 'localhost', 'cora.medconsultoria.com.br']),
    ).toThrow(/CORA_COOKIE_INSEGURO.*CORA_HOSTS_PERMITIDOS/)
  })
})
