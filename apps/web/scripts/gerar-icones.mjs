/**
 * Rasteriza `icon-any.svg` e `icon-maskable.svg`
 * (`docs/esteira/fase-4-acesso-windows-e-pwa-android/design/assets/`) nos quatro PNGs
 * que `manifest.json` exige. Os PNGs gerados **são commitados** — o build de CI não
 * pode depender de rasterizador (Etapa 17 do plano da Fase 4).
 *
 * `librsvg` (o rasterizador que o `sharp` usa para SVG) não entende a função de cor
 * `oklch()` do CSS — testado nesta sessão: sem tratamento, o desenho sai preto sólido.
 * Por isso o script troca cada `oklch(L C H)` do SVG de origem pelo hex sRGB
 * equivalente antes de rasterizar (mesma conversão OKLab → sRGB usada para o
 * `background_color` do `manifest.json`). Os arquivos de origem em
 * `docs/esteira/.../design/assets/` continuam em `oklch()` de propósito — são para
 * inserção inline no HTML/CSS, onde o navegador entende a função nativamente; só esta
 * cópia rasterizada precisa do hex.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const aqui = dirname(fileURLToPath(import.meta.url))
const pastaDosAssets = resolve(
  aqui,
  '../../../docs/esteira/fase-4-acesso-windows-e-pwa-android/design/assets',
)
const pastaDeSaida = resolve(aqui, '../public/icons')

function oklchParaSrgbHex(l, c, hGraus) {
  const h = (hGraus * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  const ll = l_ ** 3
  const mm = m_ ** 3
  const ss = s_ ** 3

  const r = 4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss
  const g = -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss
  const bl = -0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss

  const paraCanalSrgb = (canal) => {
    const linear = Math.max(0, Math.min(1, canal))
    const c8 = linear <= 0.0031308 ? 12.92 * linear : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055
    return Math.round(Math.max(0, Math.min(1, c8)) * 255)
  }
  const hex = (n) => n.toString(16).padStart(2, '0')
  return `#${hex(paraCanalSrgb(r))}${hex(paraCanalSrgb(g))}${hex(paraCanalSrgb(bl))}`
}

function substituirOklchPorHex(svgTexto) {
  return svgTexto.replace(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g, (_match, l, c, h) =>
    oklchParaSrgbHex(Number(l), Number(c), Number(h)),
  )
}

const alvos = [
  { origem: 'icon-any.svg', destino: 'icon-192.png', lado: 192 },
  { origem: 'icon-any.svg', destino: 'icon-512.png', lado: 512 },
  { origem: 'icon-maskable.svg', destino: 'icon-maskable-192.png', lado: 192 },
  { origem: 'icon-maskable.svg', destino: 'icon-maskable-512.png', lado: 512 },
]

await mkdir(pastaDeSaida, { recursive: true })

for (const alvo of alvos) {
  const svgOriginal = await readFile(resolve(pastaDosAssets, alvo.origem), 'utf8')
  const svgComHex = substituirOklchPorHex(svgOriginal)
  const png = await sharp(Buffer.from(svgComHex)).resize(alvo.lado, alvo.lado).png().toBuffer()
  await writeFile(resolve(pastaDeSaida, alvo.destino), png)
  console.log(`gerado: icons/${alvo.destino} (${alvo.lado}x${alvo.lado}, a partir de ${alvo.origem})`)
}
