/**
 * Sugestão de nomes parecidos — que nunca funde.
 *
 * Este módulo é **puro** e genérico: recebe pares de `{ id, nome }`, sem depender de
 * `@cora/contracts`, `@cora/workspace-client` nem da fila. Motivo honesto: o contrato
 * 0.2.1 de Tarefa traz `clientId` e `assigneeIds` — identificadores, não nomes. O rótulo
 * só existe na camada de prévia, que ainda não chama este módulo. Ele nasce pronto e sem
 * chamador em produção nesta entrega, e essa ausência de ligação é dita aqui em vez de
 * disfarçada com uma integração inventada.
 *
 * Decisão já tomada (`spec.md`, `fora_de_escopo`): igualdade normalizada e substring,
 * sem algoritmo fonético e sem distância de edição.
 *
 * **Não existe função de fusão neste módulo** — e essa ausência é intencional: apontar
 * uma suspeita é uma decisão pequena; fundir dois registros é uma decisão grande demais
 * para ser automática.
 */

const FAIXA_DE_DIACRITICOS = /[̀-ͯ]/g
const ESPACOS_REPETIDOS = /\s+/g

/**
 * Minúsculas, sem acento, sem espaço repetido, sem espaço nas pontas.
 */
export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(FAIXA_DE_DIACRITICOS, '')
    .toLowerCase()
    .replace(ESPACOS_REPETIDOS, ' ')
    .trim()
}

export type MotivoDaSugestao = 'igualdade_normalizada' | 'substring'

export interface Sugestao {
  idA: string
  idB: string
  motivo: MotivoDaSugestao
}

/**
 * Compara par a par as entradas recebidas. Ignora par com o mesmo `id` e não repete o
 * par invertido (A-B aparece, B-A não). A lista recebida volta intacta: este módulo não
 * altera, remove nem funde nada.
 */
export function sugerirParecidos(
  entradas: ReadonlyArray<{ id: string; nome: string }>,
): Sugestao[] {
  const sugestoes: Sugestao[] = []

  for (let i = 0; i < entradas.length; i++) {
    for (let j = i + 1; j < entradas.length; j++) {
      const a = entradas[i]
      const b = entradas[j]
      if (a === undefined || b === undefined || a.id === b.id) {
        continue
      }

      const nomeA = normalizarNome(a.nome)
      const nomeB = normalizarNome(b.nome)
      if (nomeA.length === 0 || nomeB.length === 0) {
        continue
      }

      if (nomeA === nomeB) {
        sugestoes.push({ idA: a.id, idB: b.id, motivo: 'igualdade_normalizada' })
      } else if (nomeA.includes(nomeB) || nomeB.includes(nomeA)) {
        sugestoes.push({ idA: a.id, idB: b.id, motivo: 'substring' })
      }
    }
  }

  return sugestoes
}
