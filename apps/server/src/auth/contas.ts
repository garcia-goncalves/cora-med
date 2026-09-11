/**
 * As duas contas nomeadas da Cora, lidas do ambiente.
 *
 * Nenhuma função deste arquivo pode imprimir, registrar em log ou serializar o hash de
 * senha ou o token de delegação. Erro de configuração nomeia SEMPRE a variável que falta,
 * nunca o valor de nenhuma — mesma disciplina de `apps/server/src/http/main.ts:21-28`.
 */

export interface ContaConfigurada {
  readonly id: string
  readonly nome: string
  readonly email: string
  readonly hashDeSenha: string
  readonly tokenDeDelegacao: string
}

/** Índices conhecidos. Duas pessoas hoje — trocar quem usa o sistema não vira mudança de código. */
const INDICES_DE_CONTA = [1, 2] as const

function exigirVariavel(env: Record<string, string | undefined>, nome: string): string {
  const valor = env[nome]
  if (!valor) {
    throw new Error(`Falta a variável ${nome}. Veja a lista completa em docs/OPERATIONS.md.`)
  }
  return valor
}

/**
 * Carrega as duas contas configuradas via `CORA_CONTA_1_*` e `CORA_CONTA_2_*`
 * (`EMAIL`, `NOME`, `SENHA_HASH`, `DELEGACAO`). Recebe o ambiente por parâmetro — é o que
 * torna o teste possível sem mexer no `process.env` global.
 *
 * Conta incompleta é erro nomeando a variável que falta, nunca conta meio carregada.
 * Duas contas com o mesmo e-mail (comparado em minúsculas, sem espaço nas pontas) também
 * é erro.
 */
export function carregarContas(env: Record<string, string | undefined>): ContaConfigurada[] {
  const contas: ContaConfigurada[] = []
  const emailsVistos = new Set<string>()

  for (const indice of INDICES_DE_CONTA) {
    const prefixo = `CORA_CONTA_${indice}_`
    const email = exigirVariavel(env, `${prefixo}EMAIL`)
    const nome = exigirVariavel(env, `${prefixo}NOME`)
    const hashDeSenha = exigirVariavel(env, `${prefixo}SENHA_HASH`)
    const tokenDeDelegacao = exigirVariavel(env, `${prefixo}DELEGACAO`)

    const emailNormalizado = email.trim().toLowerCase()
    if (emailsVistos.has(emailNormalizado)) {
      throw new Error(`Duas contas usam o mesmo e-mail: "${emailNormalizado}".`)
    }
    emailsVistos.add(emailNormalizado)

    contas.push({
      id: `conta-${indice}`,
      nome,
      email: emailNormalizado,
      hashDeSenha,
      tokenDeDelegacao,
    })
  }

  return contas
}
