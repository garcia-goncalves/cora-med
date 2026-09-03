import { randomUUID } from 'node:crypto'

/**
 * Chave de idempotência da criação de tarefa.
 *
 * **A chave é nossa e NÃO é derivada do conteúdo.** Derivar do payload é um defeito com
 * cara de elegância: duas tarefas legitimamente iguais no mesmo dia — *"ligar para a
 * clínica"* — colidiriam, e a segunda sumiria sem ninguém saber. O rascunho anterior do
 * plano dizia "vinculada ao turno", ambíguo o bastante para alguém implementar assim; a
 * correção veio da sessão WORKSPACE e está no plano da Fase 2, seção 3.
 *
 * O escopo da chave, do lado do servidor, é `(usuário delegado, ferramenta, chave)` —
 * **nunca a delegação**. Se a chave morresse junto com o token, renovar credencial
 * perderia a idempotência logo depois de uma falha, que é exatamente quando a repetição é
 * mais provável.
 *
 * ⚠️ O comportamento do servidor (201 / 200 / 409, e a validade de 24 h) depende do
 * CORA-003, que segue `proposed`. Este módulo cobre só a metade que é nossa: gerar a
 * chave e não mentir sobre o que aconteceu quando o resultado é desconhecido.
 */

/** Uma chave nova. Aleatória por construção: dois pedidos idênticos geram chaves distintas. */
export function novaChaveDeIdempotencia(): string {
  return randomUUID()
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function pareceChaveValida(chave: string): boolean {
  return UUID_V4.test(chave)
}

/**
 * O que a Cora sabe depois de tentar criar.
 *
 * Falha de rede DEPOIS de enviar não é "não criou". Repetir cegamente aqui é como se
 * criam duas tarefas iguais. O caminho é reconsultar com a MESMA chave e só então falar.
 */
export type ResultadoDeCriacao =
  | { estado: 'criada'; taskId: string }
  | { estado: 'ja_existia'; taskId: string }
  | { estado: 'conflito'; detalhe: string }
  /** Enviado, resposta desconhecida. NUNCA vira "falhou" nem "criou". */
  | { estado: 'desconhecido'; idempotencyKey: string; motivo: string }

/**
 * Frase para a Thaís a partir do resultado. As quatro são diferentes de propósito:
 * "criei", "já estava criada", "não deu" e "não sei" são quatro fatos distintos, e
 * juntar dois deles é como a confiança nela se perde.
 */
export function descreverResultado(resultado: ResultadoDeCriacao): string {
  switch (resultado.estado) {
    case 'criada':
      return `Criei a tarefa (id ${resultado.taskId}).`
    case 'ja_existia':
      return `Essa tarefa já tinha sido criada (id ${resultado.taskId}). Não criei uma segunda.`
    case 'conflito':
      return (
        'Já usei essa mesma autorização para gravar outra coisa, com dados diferentes ' +
        `(${resultado.detalhe}). Não vou gravar por cima — refaço a prévia.`
      )
    case 'desconhecido':
      return (
        'Enviei o pedido e não recebi resposta, então não sei se a tarefa foi criada ' +
        `(${resultado.motivo}). NÃO vou repetir às cegas: vou reconsultar com a mesma ` +
        'chave e te dizer o que encontrei.'
      )
  }
}
