import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolverArquivoEstatico } from './estaticos.js'

let raiz: string

beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'cora-estaticos-'))
  await writeFile(join(raiz, 'index.html'), '<!doctype html><title>Cora</title>')
  await writeFile(join(raiz, 'favicon.ico'), 'SYNTH-icone')
  await writeFile(join(raiz, 'robots.txt'), 'User-agent: *\nDisallow: /')
  await mkdir(join(raiz, 'assets'))
  await writeFile(join(raiz, 'assets', 'app.a1b2c3.js'), 'SYNTH-js')
  await writeFile(join(raiz, 'assets', 'app.a1b2c3.css'), 'SYNTH-css')
  await mkdir(join(raiz, 'img'))
  await writeFile(join(raiz, 'img', 'logo.svg'), '<svg></svg>')
  await writeFile(join(raiz, 'img', 'logo.png'), 'SYNTH-png')
  await writeFile(join(raiz, 'img', 'manifest.json'), '{}')
  await writeFile(join(raiz, 'img', 'fonte.woff2'), 'SYNTH-fonte')
})

afterEach(async () => {
  await rm(raiz, { recursive: true, force: true })
})

describe('resolverArquivoEstatico — tipos de conteúdo', () => {
  it.each([
    ['/index.html', 'text/html; charset=utf-8'],
    ['/assets/app.a1b2c3.js', 'text/javascript; charset=utf-8'],
    ['/assets/app.a1b2c3.css', 'text/css; charset=utf-8'],
    ['/img/logo.svg', 'image/svg+xml'],
    ['/img/logo.png', 'image/png'],
    ['/img/manifest.json', 'application/json; charset=utf-8'],
    ['/img/fonte.woff2', 'font/woff2'],
    ['/favicon.ico', 'image/x-icon'],
  ])('%s vira %s', async (pathname, tipoEsperado) => {
    const resultado = await resolverArquivoEstatico(pathname, raiz)
    expect(resultado.estado).toBe('resolvido')
    if (resultado.estado === 'resolvido') {
      expect(resultado.tipoDeConteudo).toBe(tipoEsperado)
    }
  })

  it('extensão desconhecida vira application/octet-stream', async () => {
    const resultado = await resolverArquivoEstatico('/robots.txt', raiz)
    expect(resultado.estado).toBe('resolvido')
    if (resultado.estado === 'resolvido') {
      expect(resultado.tipoDeConteudo).toBe('application/octet-stream')
    }
  })
})

describe('resolverArquivoEstatico — regra de SPA', () => {
  it('caminho sem extensão e sem arquivo correspondente cai no index.html', async () => {
    const resultado = await resolverArquivoEstatico('/conversa/alguma-coisa', raiz)
    expect(resultado.estado).toBe('resolvido')
    if (resultado.estado === 'resolvido') {
      expect(resultado.caminhoAbsoluto).toBe(join(raiz, 'index.html'))
      expect(resultado.tipoDeConteudo).toBe('text/html; charset=utf-8')
    }
  })

  it('caminho com extensão cujo arquivo não existe é 404 de verdade, nunca index.html', async () => {
    const resultado = await resolverArquivoEstatico('/assets/nao-existe.js', raiz)
    expect(resultado.estado).toBe('nao_encontrado')
  })
})

describe('resolverArquivoEstatico — defesa contra travessia de caminho', () => {
  it.each([
    ['segmento literal ..', '/../../../etc/passwd'],
    ['percent-encoded %2e%2e', '/%2e%2e/%2e%2e/etc/passwd'],
    ['barra invertida', '/..\\..\\windows\\win.ini'],
    ['byte nulo', '/arquivo\0.html'],
    ['caminho absoluto com letra de unidade', '/C:/Windows/win.ini'],
  ])('%s é recusado, nunca escapa da raiz', async (_descricao, pathname) => {
    const resultado = await resolverArquivoEstatico(pathname, raiz)
    expect(resultado.estado).toBe('recusado')
  })
})

describe('resolverArquivoEstatico — cabeçalhos de cache', () => {
  it('index.html sai com no-cache', async () => {
    const resultado = await resolverArquivoEstatico('/index.html', raiz)
    expect(resultado.estado).toBe('resolvido')
    if (resultado.estado === 'resolvido') {
      expect(resultado.cacheControl).toBe('no-cache')
    }
  })

  it('arquivo com hash sob /assets/ sai com cache imutável de um ano', async () => {
    const resultado = await resolverArquivoEstatico('/assets/app.a1b2c3.js', raiz)
    expect(resultado.estado).toBe('resolvido')
    if (resultado.estado === 'resolvido') {
      expect(resultado.cacheControl).toBe('public, max-age=31536000, immutable')
    }
  })

  it('arquivo fora de /assets/ não recebe cache agressivo', async () => {
    const resultado = await resolverArquivoEstatico('/favicon.ico', raiz)
    expect(resultado.estado).toBe('resolvido')
    if (resultado.estado === 'resolvido') {
      expect(resultado.cacheControl).toBe('no-cache')
    }
  })

  it('fallback de SPA sai com no-cache', async () => {
    const resultado = await resolverArquivoEstatico('/qualquer-rota', raiz)
    expect(resultado.estado).toBe('resolvido')
    if (resultado.estado === 'resolvido') {
      expect(resultado.cacheControl).toBe('no-cache')
    }
  })
})
