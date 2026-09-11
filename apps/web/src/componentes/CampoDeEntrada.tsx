import type { ChangeEvent, FormEvent } from 'react'

import { textos } from '../textos.js'

/**
 * Campo de entrada + botão `Enviar` fixos no rodapé, sempre na mesma linha (`design.md`,
 * tela 2, 360px). `desabilitado` cobre "aguardando resposta anterior" — a máquina de
 * estados da Etapa 13 decide quando isso é verdade, este componente só reflete.
 */
export interface PropsDoCampoDeEntrada {
  valor: string
  desabilitado: boolean
  aoDigitar: (texto: string) => void
  aoEnviar: (texto: string) => void
}

export function CampoDeEntrada({ valor, desabilitado, aoDigitar, aoEnviar }: PropsDoCampoDeEntrada) {
  function aoSubmeter(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const texto = valor.trim()
    if (texto === '' || desabilitado) return
    aoEnviar(texto)
  }

  return (
    <form className="chat-campo-de-entrada" onSubmit={aoSubmeter}>
      <input
        type="text"
        value={valor}
        placeholder={textos.chat.placeholderCampoDeEntrada}
        aria-label={textos.chat.placeholderCampoDeEntrada}
        disabled={desabilitado}
        onChange={(evento: ChangeEvent<HTMLInputElement>) => aoDigitar(evento.currentTarget.value)}
      />
      <button type="submit" disabled={desabilitado || valor.trim() === ''}>
        {textos.chat.botaoEnviar}
      </button>
      {desabilitado ? <span className="chat-campo-ajuda">{textos.chat.ajudaCampoDesabilitado}</span> : null}
    </form>
  )
}
