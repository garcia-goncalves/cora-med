import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@cora/contracts': r('./packages/contracts/src/index.ts'),
      '@cora/workspace-client': r('./packages/workspace-client/src/index.ts'),
      '@cora/policy': r('./packages/policy/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    environment: 'node',
    // Nenhum teste desta suite faz rede. Integracao HTTP real vive em scripts/ e e
    // executada a mao contra um Workspace local, com evidencia registrada.
    passWithNoTests: false,
  },
})
