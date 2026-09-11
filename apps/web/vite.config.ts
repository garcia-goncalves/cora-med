import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Decisão D5 do plano da Fase 4: em desenvolvimento a mesma origem é preservada por
// proxy do Vite para o servidor real — não existe CORS em lugar nenhum desta fase.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/auth': 'http://127.0.0.1:4320',
      '/turno': 'http://127.0.0.1:4320',
    },
  },
})
