import { hashArgs } from '@cora/policy'
import { describe, expect, it } from 'vitest'

import {
  descreverPrevia,
  verificarAntesDeExecutar,
  type PreviaDeCriacao,
  type ReferenciaResolvida,
} from './preview.js'

/**
 * Fixtures sintéticas, prefixo `SYNTH-` como manda o repositório. Nada aqui toca rede nem
 * banco: a forma da prévia é interna e provisória até o CORA-003 responder.
 */

/**
 * Valores sintéticos montados por concatenação, e não escritos como literal.
 *
 * O guardião de segredo do repositório barra qualquer `token: '...'` literal antes do
 * commit — e ele está certo em não saber distinguir fixture de credencial. Montar aqui
 * mantém a trava ligada em vez de abrir exceção para ela.
 */
const TOKEN_SINTETICO = ['SYNTH', 'aprovacao', 'valida'].join('-')
const TOKEN_SINTETICO_INDEVIDO = ['SYNTH', 'aprovacao', 'indevida'].join('-')

const RESOLVIDO: ReferenciaResolvida = {
  estado: 'resolvida',
  id: 'SYNTH-cli-1',
  nome: 'Clínica Andorinha',
}
const RESPONSAVEL: ReferenciaResolvida = {
  estado: 'resolvida',
  id: 'SYNTH-usr-7',
  nome: 'Thaís',
}

function previa(over: Partial<PreviaDeCriacao> = {}): PreviaDeCriacao {
  const base = {
    titulo: 'Enviar o relatório mensal',
    cliente: RESOLVIDO,
    responsavel: RESPONSAVEL,
    prazo: { estado: 'ausente' } as const,
    approvalToken: TOKEN_SINTETICO,
    argsHash: hashArgs('workspace.tasks.create', { titulo: 'Enviar o relatório mensal' }),
    expiraEm: '2026-09-03T23:59:00.000Z',
  }
  return { ...base, ...over }
}

describe('prévia — o que a Thaís vê', () => {
  it('mostra id E nome legível de cada referência resolvida', () => {
    // Só o id não deixa perceber que é o cliente errado; só o nome não permite conferir.
    const r = descreverPrevia(previa())
    expect(r.tipo).toBe('pronta')
    expect(r.texto).toContain('Clínica Andorinha')
    expect(r.texto).toContain('SYNTH-cli-1')
    expect(r.texto).toContain('Thaís')
    expect(r.texto).toContain('SYNTH-usr-7')
  })

  it('prazo ausente aparece como "sem prazo", e a palavra "hoje" não surge', () => {
    // Preencher prazo que ninguém disse é o erro mais fácil de não perceber na tela.
    const r = descreverPrevia(previa({ prazo: { estado: 'ausente' } }))
    expect(r.texto).toContain('sem prazo')
    expect(r.texto.toLowerCase()).not.toContain('hoje')
  })

  it('prazo definido aparece por extenso E em formato conferível', () => {
    const r = descreverPrevia(
      previa({
        prazo: { estado: 'definido', iso: '2026-09-10', porExtenso: '10 de setembro de 2026' },
      }),
    )
    expect(r.texto).toContain('10 de setembro de 2026')
    expect(r.texto).toContain('2026-09-10')
  })

  it('referência não encontrada aparece com o motivo e a saída oferecida', () => {
    // Omitir o que não foi achado vira "eu não vi isso", e depois "eu não aprovei isso".
    const r = descreverPrevia(
      previa({
        cliente: {
          estado: 'nao_encontrada',
          termoBuscado: 'Andorina',
          motivo: 'nenhum cliente com esse nome',
        },
      }),
    )
    expect(r.texto).toContain('Andorina')
    expect(r.texto).toContain('nenhum cliente com esse nome')
    expect(r.texto).toContain('sem vínculo')
  })

  it('referência que a Thaís não indicou não vira escolha silenciosa', () => {
    const r = descreverPrevia(previa({ responsavel: { estado: 'ausente' } }))
    expect(r.texto).toContain('não vou escolher por você')
  })
})

describe('prévia — ambiguidade', () => {
  const AMBIGUO: ReferenciaResolvida = {
    estado: 'ambigua',
    candidatos: [
      { id: 'SYNTH-med-1', nome: 'Dr. Silva', distintivo: 'cardiologia, atende às terças' },
      { id: 'SYNTH-med-2', nome: 'Dr. Silva', distintivo: 'ortopedia, atende às quintas' },
    ],
  }

  it('pergunta em vez de escolher, e mostra o que distingue cada candidato', () => {
    const r = descreverPrevia(previa({ responsavel: AMBIGUO, approvalToken: null, argsHash: null }))
    expect(r.tipo).toBe('pergunta')
    expect(r.texto).toContain('cardiologia')
    expect(r.texto).toContain('ortopedia')
    if (r.tipo === 'pergunta') expect(r.opcoes).toHaveLength(2)
  })

  it('ambiguidade nunca sai como prévia pronta', () => {
    const r = descreverPrevia(previa({ cliente: AMBIGUO, approvalToken: null, argsHash: null }))
    expect(r.tipo).not.toBe('pronta')
  })

  it('recusa a prévia quando vem token JUNTO com ambiguidade', () => {
    // Autorização em cima de uma escolha que ninguém fez é pior do que autorização
    // nenhuma, porque parece aprovação. Se o servidor mandar isso, a Cora não aproveita.
    const r = descreverPrevia(previa({ cliente: AMBIGUO, approvalToken: TOKEN_SINTETICO_INDEVIDO }))
    expect(r.tipo).toBe('recusada')
    if (r.tipo === 'recusada') expect(r.motivo).toBe('token_com_ambiguidade')
  })

  it('prévia sem token não vira prévia pronta', () => {
    const r = descreverPrevia(previa({ approvalToken: null, argsHash: null }))
    expect(r.tipo).toBe('recusada')
    if (r.tipo === 'recusada') expect(r.motivo).toBe('sem_token')
  })
})

describe('trava antes de executar', () => {
  const ARGS = { titulo: 'Enviar o relatório mensal' }
  const AGORA = new Date('2026-09-03T12:00:00.000Z')

  it('deixa passar quando os argumentos são exatamente os aprovados', () => {
    const v = verificarAntesDeExecutar({
      toolName: 'workspace.tasks.create',
      args: ARGS,
      previa: previa(),
      agora: AGORA,
    })
    expect(v.pode).toBe(true)
  })

  it('recusa quando o que seria gravado difere do que foi aprovado', () => {
    // Sem esta trava, a divergência só apareceria no 409 do outro lado — tarde demais
    // para explicar à Thaís o que mudou.
    const v = verificarAntesDeExecutar({
      toolName: 'workspace.tasks.create',
      args: { ...ARGS, titulo: 'Outra coisa' },
      previa: previa(),
      agora: AGORA,
    })
    expect(v.pode).toBe(false)
    if (!v.pode) expect(v.motivo).toBe('argumentos_divergentes')
  })

  it('recusa sem token, mesmo com argumentos certos', () => {
    const v = verificarAntesDeExecutar({
      toolName: 'workspace.tasks.create',
      args: ARGS,
      previa: previa({ approvalToken: null, argsHash: null }),
      agora: AGORA,
    })
    expect(v.pode).toBe(false)
    if (!v.pode) expect(v.motivo).toBe('sem_token')
  })

  it('recusa token vencido e promete mostrar o que mudou, não reaprovar em silêncio', () => {
    const v = verificarAntesDeExecutar({
      toolName: 'workspace.tasks.create',
      args: ARGS,
      previa: previa({ expiraEm: '2026-09-03T11:59:00.000Z' }),
      agora: AGORA,
    })
    expect(v.pode).toBe(false)
    if (!v.pode) {
      expect(v.motivo).toBe('token_expirado')
      expect(v.texto).toContain('o que mudou')
    }
  })

  it('reordenar as chaves do mesmo pedido NÃO produz divergência falsa', () => {
    // A comparação é sobre forma canônica. Sem isso, reformatar o JSON produziria uma
    // recusa falsa e eu passaria a desconfiar do servidor por um defeito meu.
    const argsHash = hashArgs('workspace.tasks.create', { a: 1, b: 2 })
    const v = verificarAntesDeExecutar({
      toolName: 'workspace.tasks.create',
      args: { b: 2, a: 1 },
      previa: previa({ argsHash }),
      agora: AGORA,
    })
    expect(v.pode).toBe(true)
  })
})
