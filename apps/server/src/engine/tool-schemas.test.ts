import { TOOL_CATALOG } from '@cora/policy'
import { describe, expect, it } from 'vitest'

import { esquemaDe, montarFerramentas, nomesComEsquema } from './tool-schemas.js'

describe('esquemas de ferramenta oferecidos ao motor', () => {
  it('não tem esquema órfão — todo nome existe no catálogo da política', () => {
    // Sem este teste, tool-schemas.ts vira uma segunda lista de ferramentas capaz de
    // divergir da primeira em silêncio. É o mesmo defeito que uma flag `implemented`
    // paralela ao registro de executores.
    const doCatalogo = new Set(TOOL_CATALOG.map((t) => t.name))
    for (const nome of nomesComEsquema()) {
      expect(doCatalogo.has(nome), `"${nome}" tem esquema mas não está no catálogo`).toBe(true)
    }
  })

  it('usa como descrição a MESMA frase que a prévia mostra ao usuário', () => {
    const [ferramenta] = montarFerramentas(['workspace.tasks.list'])
    const spec = TOOL_CATALOG.find((t) => t.name === 'workspace.tasks.list')
    expect(ferramenta?.description).toBe(spec?.humanDescription)
  })

  it('recusa oferecer ferramenta que não está no catálogo', () => {
    expect(() => montarFerramentas(['workspace.tasks.inventada'])).toThrow(/não existe no catálogo/)
  })

  it('recusa oferecer ferramenta do catálogo que ainda não tem esquema', () => {
    // A trava não é sobre uma ferramenta específica: é sobre a regra. `workspace.email.send`
    // está no catálogo e não tem esquema — oferecê-la ao modelo assim faria ele preencher
    // os argumentos com convicção e nenhum contrato por trás.
    expect(esquemaDe('workspace.email.send')).toBeUndefined()
    expect(() => montarFerramentas(['workspace.email.send'])).toThrow(/não tem esquema/)
  })
})

describe('workspace.tasks.create — o que o modelo pode e o que ele não pode escolher', () => {
  const esquema = esquemaDe('workspace.tasks.create')

  it('existe e é oferecível', () => {
    expect(esquema).toBeDefined()
    const [ferramenta] = montarFerramentas(['workspace.tasks.create'])
    expect(ferramenta?.name).toBe('workspace.tasks.create')
  })

  it('só o título é obrigatório, e ele tem a mesma faixa do contrato', () => {
    expect(esquema?.required).toEqual(['titulo'])
    const titulo = esquema?.properties.titulo as Record<string, unknown>
    expect(titulo.minLength).toBe(3)
    expect(titulo.maxLength).toBe(180)
  })

  it('fecha a porta para campo inventado', () => {
    expect(esquema?.additionalProperties).toBe(false)
  })

  it('⚠️ NÃO oferece approvalToken nem Idempotency-Key ao modelo', () => {
    // Esta é a trava mais importante do arquivo. O token nasce do servidor, na prévia; a
    // chave nasce da Cora. Se qualquer um dos dois fosse argumento de ferramenta, o
    // modelo poderia PRODUZIR uma aprovação — e aprovação que o modelo produz não é
    // aprovação de ninguém.
    const proibidos = ['approvalToken', 'idempotencyKey', 'Idempotency-Key', 'token', 'chave']
    const oferecidos = Object.keys(esquema?.properties ?? {})
    for (const proibido of proibidos) {
      expect(oferecidos, `"${proibido}" não pode ser argumento de ferramenta`).not.toContain(
        proibido,
      )
    }
    // E nem escondido no JSON do esquema, sob outro nome.
    expect(JSON.stringify(esquema)).not.toMatch(/approvaltoken|idempotency/i)
  })

  it('exige exatamente um entre id e texto em cada referência', () => {
    for (const campo of ['cliente', 'projeto']) {
      const ref = esquema?.properties[campo] as { oneOf?: Array<{ required?: string[] }> }
      expect(ref.oneOf, campo).toHaveLength(2)
      expect(ref.oneOf?.map((v) => v.required?.[0]).sort()).toEqual(['id', 'texto'])
    }
  })

  it('a descrição do prazo proíbe explicitamente inventar "hoje"', () => {
    // Prazo preenchido por conta própria é o erro mais fácil de não perceber: a tarefa
    // fica certa e só a data fica errada. A proibição precisa estar no texto que o modelo
    // LÊ, não só na cabeça de quem escreveu o código.
    const prazo = esquema?.properties.prazo as { description?: string }
    expect(prazo.description).toMatch(/hoje/i)
    expect(prazo.description).toMatch(/nunca/i)
    expect(prazo.description).toMatch(/fuso/i)
  })

  it('o limite de 10 responsáveis é o mesmo do contrato', () => {
    const responsaveis = esquema?.properties.responsaveis as { maxItems?: number }
    expect(responsaveis.maxItems).toBe(10)
  })

  it('o esquema de listagem fecha a porta para campo inventado', () => {
    const esquema = esquemaDe('workspace.tasks.list')
    expect(esquema?.additionalProperties).toBe(false)
    expect(esquema?.required).toEqual([])
  })

  it('nome herdado do protótipo não é esquema', () => {
    for (const nome of ['constructor', 'toString', '__proto__']) {
      expect(esquemaDe(nome), nome).toBeUndefined()
    }
  })

  it('recusa oferecer ferramenta de categoria fora do escopo', () => {
    // `decide()` já negaria na execução. Mas nem OFERECER é melhor: hoje o que impede
    // `system.install` de aparecer para o modelo é ninguém ter escrito um esquema para
    // ela, o que é acidente e não trava.
    expect(() => montarFerramentas(['system.install'])).toThrow(/fora do escopo/)
  })
})
