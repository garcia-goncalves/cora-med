import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import './estilos/tokens.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'

const raiz = document.getElementById('root')
if (!raiz) {
  throw new Error('Elemento #root não encontrado em index.html')
}

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Registro do service worker (Etapa 17, PWA) só em produção — em `pnpm dev` ele
// atrapalharia o recarregamento a quente do Vite sem trazer benefício nenhum. Falha em
// silêncio se o navegador não suportar: o app continua funcionando como site comum, só
// sem o prompt de instalação (`design.md`, tela 4).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Intencional: nenhuma ação de recuperação existe para isso.
    })
  })
}
