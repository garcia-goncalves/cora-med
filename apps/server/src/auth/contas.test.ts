import { describe, expect, it } from 'vitest'
import { carregarContas } from './contas.js'

function ambienteCompleto(): Record<string, string | undefined> {
  return {
    CORA_CONTA_1_EMAIL: 'thais@medconsultoria.example',
    CORA_CONTA_1_NOME: 'Thaís',
    CORA_CONTA_1_SENHA_HASH: 'SYNTH-hash-thais',
    CORA_CONTA_1_DELEGACAO: 'SYNTH-delegacao-thais',
    CORA_CONTA_2_EMAIL: 'andre@medconsultoria.example',
    CORA_CONTA_2_NOME: 'André',
    CORA_CONTA_2_SENHA_HASH: 'SYNTH-hash-andre',
    CORA_CONTA_2_DELEGACAO: 'SYNTH-delegacao-andre',
  }
}

describe('carregarContas', () => {
  it('carrega as duas contas com id derivado do índice', () => {
    const contas = carregarContas(ambienteCompleto())
    expect(contas).toEqual([
      {
        id: 'conta-1',
        nome: 'Thaís',
        email: 'thais@medconsultoria.example',
        hashDeSenha: 'SYNTH-hash-thais',
        tokenDeDelegacao: 'SYNTH-delegacao-thais',
      },
      {
        id: 'conta-2',
        nome: 'André',
        email: 'andre@medconsultoria.example',
        hashDeSenha: 'SYNTH-hash-andre',
        tokenDeDelegacao: 'SYNTH-delegacao-andre',
      },
    ])
  })

  it('normaliza o e-mail para minúsculas e sem espaço nas pontas', () => {
    const env = ambienteCompleto()
    env.CORA_CONTA_1_EMAIL = '  Thais@MedConsultoria.example  '
    const contas = carregarContas(env)
    expect(contas[0]?.email).toBe('thais@medconsultoria.example')
  })

  it('conta incompleta é erro nomeando a variável que falta', () => {
    const env = ambienteCompleto()
    delete env.CORA_CONTA_2_SENHA_HASH
    expect(() => carregarContas(env)).toThrow('CORA_CONTA_2_SENHA_HASH')
  })

  it('mensagem de configuração incompleta nomeia a variável, nunca o valor', () => {
    const env = ambienteCompleto()
    delete env.CORA_CONTA_1_DELEGACAO
    try {
      carregarContas(env)
      expect.unreachable('deveria ter lançado')
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro)
      expect(mensagem).toContain('CORA_CONTA_1_DELEGACAO')
      // nenhum valor de nenhuma variável do ambiente aparece na mensagem
      for (const valor of Object.values(env)) {
        if (valor === undefined) continue
        expect(mensagem).not.toContain(valor)
      }
    }
  })

  it('duas contas com o mesmo e-mail é erro', () => {
    const env = ambienteCompleto()
    env.CORA_CONTA_2_EMAIL = env.CORA_CONTA_1_EMAIL
    expect(() => carregarContas(env)).toThrow('mesmo e-mail')
  })
})
