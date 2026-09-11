/**
 * Gera o hash Argon2id de uma senha, para colocar em `CORA_CONTA_N_SENHA_HASH`.
 *
 * Roda DENTRO DO SERVIDOR — nunca na máquina do dono e nunca na do Thiago (regra 0.8 do
 * `CLAUDE.md` global: senha real não passa por chat, repositório, memória nem commit).
 *
 * A senha vem de **stdin**, nunca de argumento de linha de comando: argumento fica salvo
 * no histórico do shell (`~/.bash_history`, `Get-History`), stdin não fica em lugar
 * nenhum. Nada é ecoado — a única linha impressa é o hash.
 *
 * Uso:
 *   printf 'a-senha-real' | pnpm exec tsx scripts/hash-senha.ts
 *
 * (Sem quebra de linha no `printf`, de propósito — um `\n` do `echo` viraria parte da
 * senha hasheada e a conferência no login nunca bateria.)
 */

import { criarHashArgon2id } from '../apps/server/src/auth/senha.js'

async function lerStdin(): Promise<string> {
  const pedacos: Buffer[] = []
  for await (const pedaco of process.stdin) {
    pedacos.push(pedaco as Buffer)
  }
  return Buffer.concat(pedacos).toString('utf8')
}

async function main(): Promise<void> {
  const senha = await lerStdin()
  if (!senha) {
    console.error('Nenhuma senha recebida em stdin. Veja o cabeçalho deste arquivo para o uso.')
    process.exit(2)
  }

  const porta = criarHashArgon2id()
  const hash = await porta.gerar(senha)
  console.log(hash)
}

main()
