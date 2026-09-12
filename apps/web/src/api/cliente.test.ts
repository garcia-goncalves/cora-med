import { describe, expect, it, vi } from 'vitest'

import { criarClienteDaApi } from './cliente.js'

function fetchQueResponde(status: number, corpo: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(corpo), { status })) as unknown as typeof fetch
}

function fetchQueRejeita(): typeof fetch {
  return vi.fn(async () => {
    throw new TypeError('falha de rede')
  }) as unknown as typeof fetch
}

describe('criarClienteDaApi', () => {
  it('sucesso: entrar devolve a sessão desembrulhada do envelope do servidor', async () => {
    const sessao = { idDaConta: 'conta-1', nome: 'SYNTH-Thaís', email: 'thais@teste.local' }
    const cliente = criarClienteDaApi({ fetchImpl: fetchQueResponde(200, { sessao }) })

    const resultado = await cliente.entrar('thais@teste.local', 'SYNTH-senha')

    expect(resultado).toEqual({ status: 'sucesso', dados: sessao })
  })

  it('401 com categoria credenciais_invalidas vira credenciais_invalidas', async () => {
    const cliente = criarClienteDaApi({
      fetchImpl: fetchQueResponde(401, { erro: { categoria: 'credenciais_invalidas', mensagem: 'x' } }),
    })

    const resultado = await cliente.entrar('thais@teste.local', 'SYNTH-senha-errada')

    expect(resultado).toEqual({ status: 'credenciais_invalidas' })
  })

  it('429 com categoria bloqueado_por_tentativas vira bloqueado_por_tentativas', async () => {
    const cliente = criarClienteDaApi({
      fetchImpl: fetchQueResponde(429, { erro: { categoria: 'bloqueado_por_tentativas', mensagem: 'x' } }),
    })

    const resultado = await cliente.entrar('thais@teste.local', 'SYNTH-senha')

    expect(resultado).toEqual({ status: 'bloqueado_por_tentativas' })
  })

  it('401 de sessão ausente vira sessao_expirada', async () => {
    const cliente = criarClienteDaApi({
      fetchImpl: fetchQueResponde(401, { erro: { categoria: 'sessao_ausente', mensagem: 'x' } }),
    })

    const resultado = await cliente.obterSessao()

    expect(resultado).toEqual({ status: 'sessao_expirada' })
  })

  it('401 de sessão expirada vira sessao_expirada', async () => {
    const cliente = criarClienteDaApi({
      fetchImpl: fetchQueResponde(401, { erro: { categoria: 'sessao_expirada', mensagem: 'x' } }),
    })

    const resultado = await cliente.enviarTurno('SYNTH-oi', null)

    expect(resultado).toEqual({ status: 'sessao_expirada' })
  })

  it('erro HTTP não reconhecido vira servidor_indisponivel', async () => {
    const cliente = criarClienteDaApi({
      fetchImpl: fetchQueResponde(502, { erro: { categoria: 'falha_do_workspace', mensagem: 'x' } }),
    })

    const resultado = await cliente.obterSessao()

    expect(resultado).toEqual({ status: 'servidor_indisponivel' })
  })

  it('falha de rede com sinal de conectividade offline vira sem_internet', async () => {
    const cliente = criarClienteDaApi({
      fetchImpl: fetchQueRejeita(),
      sinalDeConectividade: () => false,
    })

    const resultado = await cliente.obterSessao()

    expect(resultado).toEqual({ status: 'sem_internet' })
  })

  it('falha de rede com sinal de conectividade online vira servidor_indisponivel', async () => {
    const cliente = criarClienteDaApi({
      fetchImpl: fetchQueRejeita(),
      sinalDeConectividade: () => true,
    })

    const resultado = await cliente.obterSessao()

    expect(resultado).toEqual({ status: 'servidor_indisponivel' })
  })

  it('usa caminhos relativos e envia credenciais (cookie)', async () => {
    const fetchEspiao = fetchQueResponde(200, { sessao: { idDaConta: 'conta-1', nome: 'x', email: 'x@x.local' } })
    const cliente = criarClienteDaApi({ fetchImpl: fetchEspiao })

    await cliente.obterSessao()

    expect(fetchEspiao).toHaveBeenCalledWith(
      '/auth/sessao',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
  })

  it('enviarTurno manda mensagem e deviceId no corpo, para caminho relativo /turno', async () => {
    const fetchEspiao = fetchQueResponde(200, { runId: 'r1', outcome: { kind: 'replied' } })
    const cliente = criarClienteDaApi({ fetchImpl: fetchEspiao })

    await cliente.enviarTurno('SYNTH-oi', 'SYNTH-device-1')

    expect(fetchEspiao).toHaveBeenCalledWith(
      '/turno',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ mensagem: 'SYNTH-oi', deviceId: 'SYNTH-device-1' }),
      }),
    )
  })
})
