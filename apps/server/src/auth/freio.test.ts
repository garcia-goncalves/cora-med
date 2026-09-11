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
