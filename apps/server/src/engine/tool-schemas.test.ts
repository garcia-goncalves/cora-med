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
    // `workspace.tasks.create` está no catálogo, mas o endpoint de escrita não existe no
    // contrato 0.1.0. Oferecê-la ao modelo agora seria inventar o contrato antes do
    // CORA-003 responder — e o modelo preencheria os argumentos com convicção.
    expect(esquemaDe('workspace.tasks.create')).toBeUndefined()
    expect(() => montarFerramentas(['workspace.tasks.create'])).toThrow(/não tem esquema/)
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
