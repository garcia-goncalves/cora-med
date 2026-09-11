import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { textos } from './textos.js'

/**
 * `textos.ts` precisa ser cópia literal da seção `textos` de
 * `docs/esteira/fase-4-acesso-windows-e-pwa-android/design.md`. Este teste é o que torna
 * "literal" verificável: cada string folha do objeto de textos tem de aparecer no
 * documento. Falhou significa que alguém inventou, encurtou ou reescreveu uma frase sem
 * passar pelo design.
 */

const design = fileURLToPath(
  new URL('../../../docs/esteira/fase-4-acesso-windows-e-pwa-android/design.md', import.meta.url),
)

function stringsFolha(valor: unknown): string[] {
  if (typeof valor === 'string') return [valor]
  if (valor !== null && typeof valor === 'object') {
    return Object.values(valor).flatMap(stringsFolha)
  }
  return []
}

describe('textos.ts é cópia literal da seção `textos` do design.md', () => {
  const conteudoDoDesign = readFileSync(design, 'utf8')
  const folhas = stringsFolha(textos)

  it('existe pelo menos uma frase por seção', () => {
    expect(folhas.length).toBeGreaterThan(20)
  })

  for (const frase of folhas) {
    it(`a frase "${frase}" aparece em design.md`, () => {
      expect(conteudoDoDesign.includes(frase)).toBe(true)
    })
  }
})

describe('os cinco chips de estado do resumo operacional têm rótulos distintos', () => {
  it('nenhum rótulo se repete', () => {
    const rotulos = Object.values(textos.chips)
    expect(new Set(rotulos).size).toBe(rotulos.length)
  })
})
