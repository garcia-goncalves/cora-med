/**
 * Integração HTTP REAL com o Workspace — Fase 1.
 *
 * Este script NÃO usa mock. Ele fala com um Workspace local de verdade e imprime uma
 * evidência sanitizada, pronta para virar arquivo em `evidence/cora/`.
 *
 * Ele se RECUSA a rodar enquanto o contrato do WORKSPACE não estiver fixado nesta cópia
 * (`CONTRACT_SHA256`), justamente para que ninguém consiga confundir "rodou" com
 * "integração comprovada".
 *
 * Uso:
 *   pnpm run integracao:tarefas
 *
 * Variáveis necessárias: WORKSPACE_BASE_URL, WORKSPACE_SERVICE_TOKEN,
 * WORKSPACE_DELEGATION_TOKEN. Os valores nunca são impressos.
 */

import { execFileSync } from 'node:child_process'

import { CONTRACT_VERSION } from '@cora/contracts'
import {
  collectAllTasks,
  isContractPinned,
  WorkspaceApiError,
  WorkspaceClient,
} from '@cora/workspace-client'

function exigir(nome: string): string {
  const valor = process.env[nome]
  if (!valor) {
    console.error(`Falta a variável ${nome}. Veja a lista completa em docs/OPERATIONS.md.`)
    process.exit(2)
  }
  return valor
}

function sha(repo: string): string {
  try {
    return execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return '(indisponível)'
  }
}

async function main(): Promise<void> {
  if (!isContractPinned()) {
    console.error(
      [
        'BLOQUEADO: o contrato workspace-agent-v1 ainda não foi fixado nesta cópia.',
        '',
        'A Fase 1 depende de tickets/CORA-001/response.md em med-coordination:',
        'o arquivo OpenAPI 0.1.0, seu SHA-256 e o formato de autenticação.',
        'Sem isso não existe alvo real, e mock não conclui integração.',
      ].join('\n'),
    )
    process.exit(1)
  }

  const client = new WorkspaceClient({
    baseUrl: exigir('WORKSPACE_BASE_URL'),
    serviceToken: exigir('WORKSPACE_SERVICE_TOKEN'),
    delegationToken: exigir('WORKSPACE_DELEGATION_TOKEN'),
    timeoutMs: Number(process.env.WORKSPACE_TIMEOUT_MS ?? 10_000),
  })

  console.log('--- EVIDÊNCIA DE INTEGRAÇÃO (CORA) ---')
  console.log(`data: ${new Date().toISOString()}`)
  console.log(`contrato: workspace-agent-v1 ${CONTRACT_VERSION}`)
  console.log(`sha cora-med: ${sha('.')}`)
  console.log(`sha workspace: ${sha('../workspace-medconsultoria')}`)
  console.log(`alvo: ${process.env.WORKSPACE_BASE_URL}`)
  console.log('')

  try {
    const { tasks, pages } = await collectAllTasks(client, { limit: 10 })
    console.log('resultado: 200 OK')
    console.log(`páginas percorridas: ${pages}`)
    console.log(`tarefas recebidas: ${tasks.length}`)
    console.log(`ids distintos: ${new Set(tasks.map((t) => t.id)).size}`)
    console.log('')
    console.log('ids (sem título, para não vazar conteúdo):')
    for (const t of tasks) console.log(`  ${t.id} [${t.status}/${t.priority}]`)
    process.exitCode = 0
  } catch (cause) {
    if (cause instanceof WorkspaceApiError) {
      console.log('resultado: FALHA')
      console.log(`code: ${cause.code}`)
      console.log(`httpStatus: ${cause.httpStatus ?? '(sem resposta HTTP)'}`)
      console.log(`requestId: ${cause.requestId ?? '(nenhum)'}`)
      console.log(`mensagem: ${cause.message}`)
    } else {
      console.log('resultado: FALHA INESPERADA')
      console.log(String(cause))
    }
    process.exitCode = 1
  }
}

await main()
