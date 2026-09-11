import { describe, expect, it } from 'vitest'

import { FreioDeTentativas } from './freio.js'

/** Relógio de mentira, controlado pelo teste — nunca `Date.now()` de verdade. */
function relogio(inicialMs: number) {
  let atualMs = inicialMs
  return {
    now: () => new Date(atualMs),
    avancar: (ms: number) => {
      atualMs += ms
    },
  }
}

describe('FreioDeTentativas', () => {
  it('uma falha a menos que o limite ainda deixa entrar', () => {
    const freio = new FreioDeTentativas({ limite: 5, now: () => new Date(0) })
    for (let i = 0; i < 4; i += 1) freio.registrarFalha('SYNTH-chave')
    expect(freio.estaBloqueado('SYNTH-chave')).toBe(false)
  })

  it('a falha que atinge o limite bloqueia', () => {
    const freio = new FreioDeTentativas({ limite: 5, now: () => new Date(0) })
    for (let i = 0; i < 5; i += 1) freio.registrarFalha('SYNTH-chave')
    expect(freio.estaBloqueado('SYNTH-chave')).toBe(true)
  })

  it('poda chaves expiradas ao registrar uma falha nova — o Map não cresce sem limite', () => {
    const r = relogio(0)
    const freio = new FreioDeTentativas({ limite: 5, now: r.now, janelaMs: 1000 })

    // Muitas chaves diferentes (simula IPs forjados/rotacionados) na mesma janela.
    for (let i = 0; i < 50; i += 1) freio.registrarFalha(`SYNTH-ip-${i}`)
    expect(freio.tamanho).toBe(50)

    r.avancar(1001) // passa da janela: as 50 chaves antigas expiraram

    // Uma falha nova qualquer dispara a poda — as 50 antigas somem, só a nova fica.
    freio.registrarFalha('SYNTH-ip-nova')
    expect(freio.tamanho).toBe(1)
  })

  it('passada a janela, desbloqueia', () => {
    const r = relogio(0)
    const freio = new FreioDeTentativas({ limite: 5, janelaMs: 1000, now: r.now })
    for (let i = 0; i < 5; i += 1) freio.registrarFalha('SYNTH-chave')
    expect(freio.estaBloqueado('SYNTH-chave')).toBe(true)

    r.avancar(1000)
    expect(freio.estaBloqueado('SYNTH-chave')).toBe(false)

    // A janela reabre: uma falha nova, sozinha, não bloqueia de novo.
    freio.registrarFalha('SYNTH-chave')
    expect(freio.estaBloqueado('SYNTH-chave')).toBe(false)
  })

  it('sucesso limpa o contador', () => {
    const freio = new FreioDeTentativas({ limite: 5, now: () => new Date(0) })
    for (let i = 0; i < 5; i += 1) freio.registrarFalha('SYNTH-chave')
    expect(freio.estaBloqueado('SYNTH-chave')).toBe(true)

    freio.limpar('SYNTH-chave')
    expect(freio.estaBloqueado('SYNTH-chave')).toBe(false)
  })

  it('tentarRegistrar devolve se a chave JÁ ESTAVA bloqueada antes desta tentativa, e só depois registra', () => {
    const freio = new FreioDeTentativas({ limite: 3, now: () => new Date(0) })

    expect(freio.tentarRegistrar('SYNTH-chave')).toBe(false) // 1ª falha, contador vira 1
    expect(freio.tentarRegistrar('SYNTH-chave')).toBe(false) // 2ª falha, contador vira 2
    expect(freio.tentarRegistrar('SYNTH-chave')).toBe(false) // 3ª falha, contador vira 3 -- "limite" falhas toleradas
    expect(freio.tentarRegistrar('SYNTH-chave')).toBe(true) // 4ª: já estava em 3/3 antes desta chamada
  })

  it('tentarRegistrar fecha a corrida entre checar e registrar (item 6): a checagem usa o estado ANTES desta chamada, e as duas operações são síncronas', () => {
    const freio = new FreioDeTentativas({ limite: 2, now: () => new Date(0) })

    // Simula duas requisições "paralelas" chegando com a mesma chave: com a checagem e o
    // registro separados por um `await` no meio (código antigo), as duas passariam pela
    // checagem antes de qualquer uma registrar. Aqui a checagem usa o estado já registrado
    // pela chamada anterior, e não há `await` entre checar e registrar dentro da própria
    // chamada -- fecha a corrida sem adiantar o bloqueio em uma tentativa.
    const primeira = freio.tentarRegistrar('SYNTH-chave') // contador 0 -> false, vira 1
    const segunda = freio.tentarRegistrar('SYNTH-chave') // contador 1 -> false, vira 2 (= limite)
    const terceira = freio.tentarRegistrar('SYNTH-chave') // contador 2 -> já bloqueada -> true

    expect(primeira).toBe(false)
    expect(segunda).toBe(false)
    expect(terceira).toBe(true)
  })

  it('login bem-sucedido desfaz o incremento de tentarRegistrar via limpar()', () => {
    const freio = new FreioDeTentativas({ limite: 3, now: () => new Date(0) })
    freio.tentarRegistrar('SYNTH-chave')
    freio.tentarRegistrar('SYNTH-chave')
    freio.limpar('SYNTH-chave')

    expect(freio.tentarRegistrar('SYNTH-chave')).toBe(false)
  })

  it('o bloqueio por IP puro acontece mesmo variando o e-mail', () => {
    // rotas.ts (Etapa 9) chama registrarFalha duas vezes por tentativa: uma com a chave
    // "ip+e-mail", outra só com "ip". Aqui simulamos só o segundo uso: mesmo IP, e-mails
    // diferentes a cada tentativa — o contador de IP puro soma todas mesmo assim.
    const freio = new FreioDeTentativas({ limite: 5, now: () => new Date(0) })
    const ip = 'SYNTH-203.0.113.10'
    const emails = [
      'SYNTH-a@teste.local',
      'SYNTH-b@teste.local',
      'SYNTH-c@teste.local',
      'SYNTH-d@teste.local',
      'SYNTH-e@teste.local',
    ]
    for (const email of emails) {
      freio.registrarFalha(`${ip}:${email}`)
      freio.registrarFalha(ip)
    }
    // Nenhuma chave de IP+e-mail se repetiu, então nenhuma delas bateu o limite sozinha.
    for (const email of emails) {
      expect(freio.estaBloqueado(`${ip}:${email}`)).toBe(false)
    }
    // Mas o IP puro acumulou as cinco falhas e bloqueia.
    expect(freio.estaBloqueado(ip)).toBe(true)
  })
})
