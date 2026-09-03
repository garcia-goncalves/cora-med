import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { CONTRACT_SHA256, CONTRACT_VERSION } from './tasks.js'

/**
 * O contrato é do WORKSPACE; esta cópia é nossa. Estes testes existem para que a cópia
 * não possa deslizar em silêncio.
 *
 * Produção NUNCA lê de `med-coordination` — lê deste arquivo vendorizado.
 */

const arquivo = fileURLToPath(new URL('./contrato/workspace-agent-v1.openapi.yaml', import.meta.url))
const yaml = readFileSync(arquivo, 'utf8')

describe('contrato workspace-agent v1 fixado', () => {
  it('o hash do arquivo vendorizado bate com a constante fixada', () => {
    // Se alguém trocar o YAML sem passar por um ticket, este teste quebra — que é
    // exatamente o ponto de fixar hash em vez de só fixar versão.
    const calculado = createHash('sha256').update(readFileSync(arquivo)).digest('hex')
    expect(calculado).toBe(CONTRACT_SHA256)
  })

  it('o hash fixado é o que o WORKSPACE publicou em CORA-003', () => {
    // O WORKSPACE garantiu por escrito que NÃO reescreve uma versão publicada: se a
    // forma do contrato mudar, a versão sobe e vem hash novo. Por isso vale gravar o
    // número aqui à mão — ele é o segundo par de olhos sobre a constante.
    expect(CONTRACT_SHA256).toBe(
      'd5dbff4167727e041326d5e9caf38aa2b3388529272dc673095cdc4a617ec13a',
    )
  })

  it('a versão fixada é a 0.2.0, e não a 0.1.0 da Fase 1', () => {
    expect(CONTRACT_VERSION).toBe('0.2.0')
  })

  it('a versão declarada no YAML é a mesma que o cliente exige', () => {
    expect(yaml).toContain(`version: ${CONTRACT_VERSION}`)
  })

  it('o arquivo está em LF, sem CRLF — o hash depende disso', () => {
    expect(yaml).not.toContain('\r\n')
  })

  it('o contrato ainda declara os dois cabeçalhos de serviço e o Bearer', () => {
    // Se a autenticação mudar de forma, o cliente precisa mudar junto; este teste é o
    // alarme para o caso de a cópia ser atualizada sem alguém reler authHeaders().
    expect(yaml).toContain('X-Agent-Client')
    expect(yaml).toContain('X-Agent-Secret')
    expect(yaml).toContain('scheme: bearer')
  })

  it('o contrato NÃO expõe descricao, e não tem parâmetro de userId', () => {
    expect(yaml).not.toMatch(/^\s+descricao:/m)
    expect(yaml).not.toMatch(/name: userId/)
  })
})
