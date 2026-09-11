import type { ReactNode } from 'react'

/**
 * Tela cheia genérica dos dois estados de erro que substituem a conversa por inteiro
 * (`design.md`, tela 3): servidor fora do ar e sessão expirada. Nunca a mesma instância
 * do estado "sem internet" (esse é o `BannerSemInternet`, reversível e não tela cheia).
 */
export interface PropsDaTelaDeErro {
  ilustracao?: ReactNode
  linhas: readonly string[]
  textoDoBotao: string
  aoClicarBotao: () => void
}

export function TelaDeErro({ ilustracao, linhas, textoDoBotao, aoClicarBotao }: PropsDaTelaDeErro) {
  return (
    <div className="chat-tela-de-erro">
      {ilustracao ?? null}
      {linhas.map((linha) => (
        <p key={linha}>{linha}</p>
      ))}
      <button type="button" className="chat-tela-de-erro-botao" onClick={aoClicarBotao}>
        {textoDoBotao}
      </button>
    </div>
  )
}
