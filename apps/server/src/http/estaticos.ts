import { stat } from 'node:fs/promises'
import { isAbsolute, extname, join, relative, resolve, sep } from 'node:path'

/**
 * Resolve um `pathname` de URL para um arquivo dentro de `raiz`, sem nunca deixar o
 * resultado escapar dela. Puro no sentido de não escrever resposta HTTP nenhuma — quem
 * liga isto ao servidor (`server.ts`) decide o que fazer com cada estado.
 */
export type ResultadoEstatico =
  | { estado: 'resolvido'; caminhoAbsoluto: string; tipoDeConteudo: string; cacheControl: string }
  /** Tentou sair da raiz (`..`, barra invertida, byte nulo, caminho absoluto). */
  | { estado: 'recusado' }
  /** Caminho com extensão cujo arquivo não existe — 404 de verdade, nunca cai no SPA. */
  | { estado: 'nao_encontrado' }

const MIME_POR_EXTENSAO: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

const MIME_PADRAO = 'application/octet-stream'

const CACHE_CASCA = 'no-cache'
/** Assets sob `/assets/` saem do build com hash no nome (Vite): mudar o conteúdo muda o
 * nome do arquivo, então cache eterno é seguro — não é preciso invalidar nada. */
const CACHE_ASSET_VERSIONADO = 'public, max-age=31536000, immutable'

function tipoDeConteudoPara(caminho: string): string {
  return MIME_POR_EXTENSAO[extname(caminho).toLowerCase()] ?? MIME_PADRAO
}

function cacheControlPara(pathnameDaUrl: string, ehEstaticoDireto: boolean): string {
  return ehEstaticoDireto && pathnameDaUrl.startsWith('/assets/') ? CACHE_ASSET_VERSIONADO : CACHE_CASCA
}

async function existeComoArquivo(caminho: string): Promise<boolean> {
  try {
    const info = await stat(caminho)
    return info.isFile()
  } catch {
    return false
  }
}

export async function resolverArquivoEstatico(
  pathnameDaUrl: string,
  raiz: string,
): Promise<ResultadoEstatico> {
  let decodificado: string
  try {
    decodificado = decodeURIComponent(pathnameDaUrl)
  } catch {
    return { estado: 'recusado' }
  }

  // Byte nulo e barra invertida nunca são parte legítima de um caminho servido aqui —
  // barra invertida em especial porque `path.resolve` só a trata como separador no
  // Windows; recusar sempre, nas duas plataformas, evita que o comportamento do módulo
  // dependa de onde o processo roda.
  if (decodificado.includes('\0') || decodificado.includes('\\')) {
    return { estado: 'recusado' }
  }

  const relativo = decodificado.replace(/^\/+/, '')
  // `isAbsolute` sozinho não basta: ele usa a semântica do SO onde o processo roda, e um
  // caminho com letra de unidade (`C:/Windows/win.ini`) só é "absoluto" para o `path`
  // nativo no Windows — no Linux (onde a CI roda) ele passaria como nome de arquivo
  // relativo comum. O teste explícito de letra de unidade fecha essa brecha nas duas
  // plataformas.
  if (isAbsolute(relativo) || /^[a-zA-Z]:/.test(relativo)) {
    return { estado: 'recusado' }
  }

  const raizResolvida = resolve(raiz)
  const alvo = resolve(raizResolvida, relativo)
  const relativoDaRaiz = relative(raizResolvida, alvo)
  if (relativoDaRaiz === '..' || relativoDaRaiz.startsWith(`..${sep}`) || isAbsolute(relativoDaRaiz)) {
    return { estado: 'recusado' }
  }

  const temExtensao = extname(alvo) !== ''

  if (temExtensao) {
    if (!(await existeComoArquivo(alvo))) {
      return { estado: 'nao_encontrado' }
    }
    return {
      estado: 'resolvido',
      caminhoAbsoluto: alvo,
      tipoDeConteudo: tipoDeConteudoPara(alvo),
      cacheControl: cacheControlPara(pathnameDaUrl, true),
    }
  }

  // Sem extensão: se o caminho exato existir como arquivo, serve ele; senão cai no
  // `index.html` da raiz (comportamento de SPA). Só quando nem o `index.html` existir é
  // que isto vira "não encontrado".
  if (await existeComoArquivo(alvo)) {
    return {
      estado: 'resolvido',
      caminhoAbsoluto: alvo,
      tipoDeConteudo: tipoDeConteudoPara(alvo),
      cacheControl: cacheControlPara(pathnameDaUrl, false),
    }
  }

  const indice = join(raizResolvida, 'index.html')
  if (await existeComoArquivo(indice)) {
    return {
      estado: 'resolvido',
      caminhoAbsoluto: indice,
      tipoDeConteudo: tipoDeConteudoPara(indice),
      cacheControl: CACHE_CASCA,
    }
  }

  return { estado: 'nao_encontrado' }
}
