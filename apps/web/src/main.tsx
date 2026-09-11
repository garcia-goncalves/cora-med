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
