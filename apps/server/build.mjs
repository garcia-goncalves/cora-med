// Build de produção do @cora/server: gera um único arquivo JavaScript que o Node.js
// Selector do DirectAdmin consegue executar direto com `node`, sem `tsx` nem TypeScript
// em produção (Etapa 2 do plano da Fase 4).
//
// `@node-rs/argon2` fica de fora do bundle por ser binário nativo (não pode ser embutido).
// `@anthropic-ai/sdk` também fica de fora — permanece dependência de runtime normal.
// Os pacotes internos (`@cora/contracts`, `@cora/policy`, `@cora/workspace-client`) entram
// no bundle: são código-fonte deste monorepo, não pacotes publicados.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/http/main.ts'],
  outfile: 'dist/servidor.mjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: false,
  external: ['@node-rs/argon2', '@anthropic-ai/sdk'],
})
