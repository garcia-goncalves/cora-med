// Service worker mínimo da Cora (Etapa 17 do plano da Fase 4). Ele existe só porque,
// sem um service worker registrado, o Chrome no Android não dispara o evento
// `beforeinstallprompt` — mesmo com um `manifest.json` válido (web.dev, "Learn PWA:
// Installation", citado em `spec.md`). NÃO é "app que funciona sem internet de
// verdade" — isso está fora de escopo (`spec.md`, `fora_de_escopo`).
//
// Cacheia SÓ a casca da SPA: `index.html` (rede primeiro, cache só como reserva
// quando a rede falha) e os arquivos versionados sob `/assets/` (cache primeiro — o
// hash no nome do arquivo já garante que uma build nova nunca reusa um nome velho).
// NUNCA intercepta `/turno` nem `/auth/*`: dado do resumo operacional é sempre atual,
// e cachear essas respostas aqui seria mentira com autoridade — a mesma regra que
// `docs/ROADMAP.md`/`server.ts` já aplicam do lado do servidor.

const CACHE = 'cora-shell-v1'
const CASCA = '/index.html'

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(CASCA))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((chave) => chave !== CACHE).map((chave) => caches.delete(chave))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url)

  // Chamadas de API nunca passam por aqui — sempre rede, sempre dado atual.
  if (url.pathname === '/turno' || url.pathname.startsWith('/auth/')) return

  const ehNavegacaoDaCasca = evento.request.mode === 'navigate' || url.pathname === '/' || url.pathname === CASCA
  if (ehNavegacaoDaCasca) {
    evento.respondWith(
      fetch(evento.request)
        .then((resposta) => {
          const copia = resposta.clone()
          caches.open(CACHE).then((cache) => cache.put(CASCA, copia))
          return resposta
        })
        .catch(() => caches.match(CASCA).then((emCache) => emCache ?? Response.error())),
    )
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    evento.respondWith(
      caches.match(evento.request).then((emCache) => {
        if (emCache) return emCache
        return fetch(evento.request).then((resposta) => {
          const copia = resposta.clone()
          caches.open(CACHE).then((cache) => cache.put(evento.request, copia))
          return resposta
        })
      }),
    )
  }
})
