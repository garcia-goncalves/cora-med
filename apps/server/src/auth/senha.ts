/**
 * Hash de senha atrás de uma porta injetável (decisão D6 da Fase 4).
 *
 * Implementação padrão: Argon2id via `@node-rs/argon2`, binário pré-compilado, o mesmo
 * algoritmo que o Workspace usa para senha de gente
 * (`workspace-medconsultoria/apps/api/src/lib/password.ts`). A porta existe por dois
 * motivos: a convenção de teste deste repositório exige injeção, e se o Node.js Selector
 * da TineHost recusar o binário nativo, trocar por uma implementação WASM vira mudança de
 * um arquivo — este —, não da fase inteira (risco 1 do plano da Fase 4).
 */

import { randomBytes } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'

/**
 * Parâmetros de custo do Argon2id, explícitos para não depender do padrão silencioso da
 * biblioteca mudar entre versões. São os mesmos valores-padrão que o Workspace usa
 * (`auth.service.ts:65`, "19 MiB e duas passadas"): memória e tempo calibrados para
 * poucas contas fazendo login raramente, não para alto volume.
 */
const CUSTO_ARGON2ID = {
  memoryCost: 19456, // 19 MiB por thread
  timeCost: 2, // duas passadas
  parallelism: 1,
}

export interface PortaDeHashDeSenha {
  gerar(senha: string): Promise<string>
  conferir(hashArmazenado: string, senha: string): Promise<boolean>
}

/** Implementação real, com Argon2id. */
export function criarHashArgon2id(): PortaDeHashDeSenha {
  return {
    async gerar(senha) {
      return hash(senha, CUSTO_ARGON2ID)
    },
    async conferir(hashArmazenado, senha) {
      try {
        return await verify(hashArmazenado, senha)
      } catch {
        // Hash malformado (formato PHC inválido, string vazia, lixo) não pode derrubar o
        // login — é recusa, não exceção.
        return false
      }
    },
  }
}

/**
 * O HASH CONTRA O QUAL SE QUEIMA TEMPO quando a conta não existe.
 *
 * É o hash de um valor aleatório sorteado na primeira chamada: ninguém sabe a senha dele
 * e ele não abre nada. Serve só para que conferir a senha de uma conta inexistente custe
 * o mesmo que conferir a de uma conta que existe — sem isso, o tempo de resposta denuncia
 * qual e-mail tem cadastro, mesmo com a mensagem de erro sendo idêntica (mesmo raciocínio
 * de `auth.service.ts:188-206` no Workspace).
 *
 * Um hash por porta injetada: o teste com porta falsa nunca reaproveita o cache de outro
 * teste.
 */
const hashesDeDescarte = new WeakMap<PortaDeHashDeSenha, Promise<string>>()

function hashParaQueimarTempo(porta: PortaDeHashDeSenha): Promise<string> {
  let promessa = hashesDeDescarte.get(porta)
  if (!promessa) {
    promessa = porta.gerar(randomBytes(32).toString('hex')).catch((erro: unknown) => {
      // Não guarda a promessa rejeitada: se a primeira tentativa falhar, a próxima chamada
      // tenta de novo, em vez de quebrar todo login com e-mail desconhecido para sempre.
      hashesDeDescarte.delete(porta)
      throw erro
    })
    hashesDeDescarte.set(porta, promessa)
  }
  return promessa
}

/**
 * Confere `senha` contra o hash-isca, gastando aproximadamente o mesmo tempo de uma
 * conferência real — sem nunca deixar essa defesa de tempo derrubar o fluxo de login.
 */
export async function conferirGastandoTempo(porta: PortaDeHashDeSenha, senha: string): Promise<void> {
  try {
    await porta.conferir(await hashParaQueimarTempo(porta), senha)
  } catch {
    /* defesa de tempo é best-effort: perder ela é bem menos grave que quebrar o login */
  }
}
