import { describe, expect, it } from 'vitest'

import { conferirGastandoTempo, criarHashArgon2id, type PortaDeHashDeSenha } from './senha.js'

describe('hash de senha (Argon2id)', () => {
  it('hash gerado confere com a senha certa', async () => {
    const porta = criarHashArgon2id()
    const hash = await porta.gerar('SYNTH-senha-de-teste')
    await expect(porta.conferir(hash, 'SYNTH-senha-de-teste')).resolves.toBe(true)
  })

  it('recusa a senha errada', async () => {
    const porta = criarHashArgon2id()
    const hash = await porta.gerar('SYNTH-senha-certa')
    await expect(porta.conferir(hash, 'SYNTH-senha-errada')).resolves.toBe(false)
  })

  it('dois hashes da mesma senha são diferentes (sal aleatório)', async () => {
    const porta = criarHashArgon2id()
    const [primeiro, segundo] = await Promise.all([
      porta.gerar('SYNTH-mesma-senha'),
      porta.gerar('SYNTH-mesma-senha'),
    ])
    expect(primeiro).not.toBe(segundo)
  })

  it('hash malformado devolve falso em vez de explodir', async () => {
    const porta = criarHashArgon2id()
    await expect(porta.conferir('isso-nao-e-um-hash-argon2', 'SYNTH-qualquer')).resolves.toBe(
      false,
    )
    await expect(porta.conferir('', 'SYNTH-qualquer')).resolves.toBe(false)
  })

  it('o hash começa com o prefixo $argon2id$', async () => {
    const porta = criarHashArgon2id()
    const hash = await porta.gerar('SYNTH-senha-de-teste')
    expect(hash.startsWith('$argon2id$')).toBe(true)
  })
})

describe('defesa de tempo contra conta inexistente', () => {
  it('não lança mesmo quando a porta injetada falha ao gerar o hash-isca', async () => {
    const portaQueFalha: PortaDeHashDeSenha = {
      gerar: () => Promise.reject(new Error('binário indisponível')),
      conferir: () => Promise.resolve(false),
    }
    await expect(conferirGastandoTempo(portaQueFalha, 'SYNTH-qualquer')).resolves.toBeUndefined()
  })

  it('confere de verdade contra o hash-isca, sem nunca aceitar a senha', async () => {
    const porta = criarHashArgon2id()
    let conferencias = 0
    const portaInstrumentada: PortaDeHashDeSenha = {
      gerar: (senha) => porta.gerar(senha),
      conferir: (hashArmazenado, senha) => {
        conferencias += 1
        return porta.conferir(hashArmazenado, senha)
      },
    }
    await conferirGastandoTempo(portaInstrumentada, 'SYNTH-tentativa')
    expect(conferencias).toBe(1)
  })
})
