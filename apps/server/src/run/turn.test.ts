import { fixtures } from '@cora/contracts'
import { hashArgs } from '@cora/policy'
import { describe, expect, it } from 'vitest'

import { ScriptedMotor } from '../engine/scripted.js'
import { ToolRegistry } from '../tools/registry.js'
import { describeTasksForUser, type ListTasksToolResult } from '../tools/workspace-tasks.js'
import { runTurn } from './turn.js'

/**
 * Testes do laço de execução, com motor roteirizado e fixtures sintéticas.
 * Nenhuma rede, nenhum provedor de modelo, nenhum dado real.
 */

const REQUESTER = {
  requesterUserId: 'SYNTH-user-a',
  deviceId: null,
  runId: 'SYNTH-run-1',
}

function registryComListagem(result: ListTasksToolResult) {
  return new ToolRegistry().register('workspace.tasks.list', async () => result)
}

describe('runTurn — execução de leitura', () => {
  it('executa a ferramenta, devolve resposta e registra a execução', async () => {
    const motor = new ScriptedMotor([
      { reply: null, proposals: [{ toolName: 'workspace.tasks.list', args: { limit: 20 } }] },
      { reply: 'Você tem 2 tarefas abertas.', proposals: [] },
    ])
    const registry = registryComListagem({
      outcome: 'ok',
      tasks: [fixtures.tarefaDeA, fixtures.tarefaCompartilhada],
      nextCursor: null,
    })

    const out = await runTurn({ motor, registry, requester: REQUESTER, messages: [] })

    expect(out.kind).toBe('replied')
    expect(out.records).toHaveLength(1)
    expect(out.records[0]?.toolName).toBe('workspace.tasks.list')
    expect(out.records[0]?.state).toBe('succeeded')
    expect(out.records[0]?.requesterUserId).toBe('SYNTH-user-a')
  })

  it('o log guarda a forma dos argumentos, não o conteúdo', async () => {
    const motor = new ScriptedMotor([
      {
        reply: null,
        proposals: [
          { toolName: 'workspace.tasks.list', args: { limit: 20, segredo: 'nome-de-paciente' } },
        ],
      },
      { reply: 'pronto', proposals: [] },
    ])
    const registry = registryComListagem({ outcome: 'ok', tasks: [], nextCursor: null })

    const out = await runTurn({ motor, registry, requester: REQUESTER, messages: [] })
    const minimizado = JSON.stringify(out.records[0]?.argsMinimized)

    expect(minimizado).not.toContain('nome-de-paciente')
    expect(minimizado).toContain('limit')
    expect(out.records[0]?.argsMinimized).toMatchObject({
      hash: hashArgs('args', { limit: 20, segredo: 'nome-de-paciente' }),
    })
  })
})

describe('runTurn — política manda, não o motor', () => {
  it('proposta fora do catálogo é negada mesmo se o motor insistir', async () => {
    const motor = new ScriptedMotor([
      { reply: null, proposals: [{ toolName: 'shell.exec', args: { cmd: 'whoami' } }] },
    ])
    const registry = registryComListagem({ outcome: 'ok', tasks: [], nextCursor: null })

    const out = await runTurn({ motor, registry, requester: REQUESTER, messages: [] })

    expect(out.kind).toBe('denied')
    expect(out.records).toHaveLength(0)
  })

  it('efeito externo para o turno pedindo aprovação, sem executar nada', async () => {
    const motor = new ScriptedMotor([
      {
        reply: null,
        proposals: [{ toolName: 'workspace.email.send', args: { para: 'x@invalido.teste' } }],
      },
    ])
    const registry = registryComListagem({ outcome: 'ok', tasks: [], nextCursor: null })

    const out = await runTurn({ motor, registry, requester: REQUESTER, messages: [] })

    expect(out.kind).toBe('needs_approval')
    if (out.kind !== 'needs_approval') throw new Error('inesperado')
    expect(out.toolName).toBe('workspace.email.send')
    expect(out.argsHash).toHaveLength(64)
    expect(out.records).toHaveLength(0)
  })

  it('ferramenta permitida pela política mas sem executor registrado é negada', async () => {
    const motor = new ScriptedMotor([
      { reply: null, proposals: [{ toolName: 'workspace.tasks.list', args: {} }] },
    ])
    const out = await runTurn({
      motor,
      registry: new ToolRegistry(), // vazio de propósito
      requester: REQUESTER,
      messages: [],
    })
    expect(out.kind).toBe('denied')
  })
})

describe('runTurn — limites aplicados pela aplicação', () => {
  it('para no teto de chamadas de modelo', async () => {
    // Motor que sempre propõe: sem teto, giraria para sempre.
    const passos = Array.from({ length: 50 }, () => ({
      reply: null,
      proposals: [{ toolName: 'workspace.tasks.list', args: {} }],
    }))
    const motor = new ScriptedMotor(passos)
    const registry = registryComListagem({ outcome: 'ok', tasks: [], nextCursor: null })

    const out = await runTurn({
      motor,
      registry,
      requester: REQUESTER,
      messages: [],
      limits: { maxModelCalls: 3, maxRunSeconds: 120 },
    })

    expect(out.kind).toBe('limit_reached')
    if (out.kind !== 'limit_reached') throw new Error('inesperado')
    expect(out.limit).toBe('model_calls')
    expect(motor.callCount).toBe(3)
  })

  it('para no teto de tempo', async () => {
    let agora = new Date('2026-09-02T12:00:00-03:00').getTime()
    const motor = new ScriptedMotor(
      Array.from({ length: 50 }, () => ({
        reply: null,
        proposals: [{ toolName: 'workspace.tasks.list', args: {} }],
      })),
    )
    const registry = registryComListagem({ outcome: 'ok', tasks: [], nextCursor: null })

    const out = await runTurn({
      motor,
      registry,
      requester: REQUESTER,
      messages: [],
      limits: { maxModelCalls: 100, maxRunSeconds: 10 },
      now: () => {
        agora += 4000
        return new Date(agora)
      },
    })

    expect(out.kind).toBe('limit_reached')
    if (out.kind !== 'limit_reached') throw new Error('inesperado')
    expect(out.limit).toBe('time')
  })

  it('cancelamento externo interrompe o turno', async () => {
    const controller = new AbortController()
    controller.abort()
    const motor = new ScriptedMotor([
      { reply: null, proposals: [{ toolName: 'workspace.tasks.list', args: {} }] },
    ])
    const registry = registryComListagem({ outcome: 'ok', tasks: [], nextCursor: null })

    const out = await runTurn({
      motor,
      registry,
      requester: REQUESTER,
      messages: [],
      signal: controller.signal,
    })

    expect(out.kind).toBe('cancelled')
    expect(motor.callCount).toBe(0)
  })
})

describe('vazio nunca é a mesma coisa que erro', () => {
  it('lista vazia diz que não há tarefas', () => {
    const texto = describeTasksForUser({ outcome: 'ok', tasks: [], nextCursor: null })
    expect(texto).toMatch(/não encontrei nenhuma tarefa/i)
    expect(texto).not.toMatch(/não consegui consultar/i)
  })

  it('indisponibilidade diz que não deu para consultar, e avisa que não é "tudo em dia"', () => {
    const texto = describeTasksForUser({
      outcome: 'unavailable',
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'banco fora',
      requestId: 'SYNTH-req',
    })
    expect(texto).toMatch(/não consegui consultar/i)
    expect(texto).toMatch(/não quer dizer que você esteja sem pendências/i)
  })

  it('título com injeção de prompt chega ao modelo dentro de bloco de dado não confiável', () => {
    const texto = describeTasksForUser({
      outcome: 'ok',
      tasks: [fixtures.tarefaComInjecao],
      nextCursor: null,
    })
    expect(texto).toContain('DADO_NAO_CONFIAVEL')
    expect(texto).toMatch(/não altera as suas instruções/i)
  })
})

describe('ToolRegistry', () => {
  it('recusa registrar ferramenta que não está no catálogo', () => {
    expect(() => new ToolRegistry().register('inventada.x', async () => null)).toThrow(/catálogo/)
  })

  it('recusa registrar ferramenta marcada como não implementada', () => {
    expect(() => new ToolRegistry().register('workspace.email.send', async () => null)).toThrow(
      /não implementada/,
    )
  })

  it('recusa registrar duas vezes a mesma ferramenta', () => {
    const r = new ToolRegistry().register('workspace.tasks.list', async () => null)
    expect(() => r.register('workspace.tasks.list', async () => null)).toThrow(/já registrada/)
  })
})
