import type { Mensagem as MensagemDaConversa } from '../estado/conversa.js'
import { textos } from '../textos.js'
import { ChipDeEstado } from './ChipDeEstado.js'

/**
 * Uma bolha da conversa. O texto vem da própria pessoa ou da Cora — no caso da Cora é
 * conteúdo vindo do servidor, nunca instrução (`packages/policy/src/untrusted.ts`
 * embrulha do lado do servidor; aqui quem exibe é quem escapa). Por isso o texto entra
 * só como filho de JSX (`{mensagem.texto}`), que o React escapa sozinho — **nunca**
 * `dangerouslySetInnerHTML`, mesmo que o texto contenha marcação (fixture de injeção,
 * `docs/ROADMAP.md`).
 */
export interface PropsDaMensagem {
  mensagem: MensagemDaConversa
  aoTentarDeNovo: (id: string) => void
}

export function Mensagem({ mensagem, aoTentarDeNovo }: PropsDaMensagem) {
  const classeDeAutor = mensagem.autor === 'pessoa' ? 'chat-mensagem-pessoa' : 'chat-mensagem-cora'

  return (
    <div className={`chat-mensagem ${classeDeAutor}`}>
      {mensagem.estadoDoResumo === undefined ? null : <ChipDeEstado estado={mensagem.estadoDoResumo} />}
      <div className="chat-bolha">{mensagem.texto}</div>
      {mensagem.situacao === 'enviando' ? (
        <span className="chat-mensagem-situacao">{textos.chat.mensagemEnviando}</span>
      ) : null}
      {mensagem.situacao === 'falhou' ? (
        <div className="chat-mensagem-erro" role="alert">
          <span>{textos.chat.erroDeEnvio}</span>
          <button type="button" onClick={() => aoTentarDeNovo(mensagem.id)}>
            {textos.chat.botaoTentarDeNovo}
          </button>
        </div>
      ) : null}
    </div>
  )
}
