import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * `tokens.css` precisa ser cópia literal do bloco `tokens` de
 * `docs/esteira/fase-4-acesso-windows-e-pwa-android/design.md`. Este teste é o que torna
 * "literal" verificável: se alguém editar um token sem passar pelo design, ele quebra.
 */

const design = fileURLToPath(
  new URL(
    '../../../../docs/esteira/fase-4-acesso-windows-e-pwa-android/design.md',
    import.meta.url,
  ),
)
const tokensCss = fileURLToPath(new URL('./tokens.css', import.meta.url))

const normalizar = (texto: string) =>
  texto
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((linha) => linha.replace(/[ \t]+$/, ''))
    .join('\n')
    .trim()

const extrairPrimeiroBlocoCss = (markdown: string): string => {
  const casamento = markdown.match(/```css\n([\s\S]*?)```/)
  if (!casamento || casamento[1] === undefined) {
    throw new Error('Nenhum bloco ```css encontrado em design.md')
  }
  return casamento[1]
}

describe('tokens.css é cópia literal do bloco `tokens` do design.md', () => {
  it('o conteúdo dos dois arquivos é idêntico, ignorando fim de linha e espaço à direita', () => {
    const blocoDoDesign = extrairPrimeiroBlocoCss(readFileSync(design, 'utf8'))
    const conteudoDoArquivo = readFileSync(tokensCss, 'utf8')

    expect(normalizar(conteudoDoArquivo)).toBe(normalizar(blocoDoDesign))
  })
})
