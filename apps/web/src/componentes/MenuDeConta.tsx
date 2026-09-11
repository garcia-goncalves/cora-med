import { useEffect, useRef, useState } from 'react'

import { criarClienteDaApi, type ClienteDaApi, type SessaoDoUsuario } from '../api/cliente.js'
import { textos } from '../textos.js'
import './MenuDeConta.css'

/**
 * Tela 6 do `design.md`: painel deslizante a partir do cabeçalho, não é rota nova. Vive
 * dentro do próprio cabeçalho da Etapa 15 (`Chat.tsx`) — o trigger e o painel são um
 * componente só, para o cabeçalho não precisar guardar o estado de aberto/fechado.
 */
export interface PropsDoMenuDeConta {
  /** Dado real da sessão (Etapa 12) — nunca dado de demonstração. */
  sessao: SessaoDoUsuario
  /** Injetável para teste; por padrão fala com o servidor de verdade. */
  cliente?: ClienteDaApi
  /** Chamado depois que `POST /auth/sair` volta. Reaproveita o mesmo callback que a tela
   * de sessão expirada usa (`Chat.tsx`, `aoSessaoExpirar`): as duas ações levam ao mesmo
   * lugar — de volta ao login, sem conversa em memória —, e `App.tsx` não faz parte do
   * escopo desta etapa. */
  aoSair: () => void
}

type Vista = 'lista' | 'confirmar_sair'

export function MenuDeConta({ sessao, cliente, aoSair }: PropsDoMenuDeConta) {
  const clienteDaApi = cliente ?? clienteDaApiPadrao
  const [aberto, setAberto] = useState(false)
  const [vista, setVista] = useState<Vista>('lista')
  const ancoraRef = useRef<HTMLDivElement>(null)
  const primeiroItemRef = useRef<HTMLButtonElement>(null)

  function fechar() {
    setAberto(false)
    setVista('lista')
  }

  useEffect(() => {
    if (!aberto) return
    // Ao abrir o painel o foco vai para o primeiro item (critério de pronto da etapa).
    primeiroItemRef.current?.focus()

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') fechar()
    }
    function aoClicarFora(evento: MouseEvent) {
      // O gatilho fica dentro de `ancoraRef` também — sem isso, clicar nele para
      // fechar o painel reabriria na sequência (o `mousedown` fecha, o `click` do
      // próprio botão alterna de novo).
      if (ancoraRef.current && !ancoraRef.current.contains(evento.target as Node)) fechar()
    }
    document.addEventListener('keydown', aoTeclar)
    document.addEventListener('mousedown', aoClicarFora)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.removeEventListener('mousedown', aoClicarFora)
    }
  }, [aberto])

  async function confirmarSair() {
    await clienteDaApi.sair()
    fechar()
    aoSair()
  }

  return (
    <div className="menu-de-conta-ancora" ref={ancoraRef}>
      <button
        type="button"
        className="menu-de-conta-gatilho"
        aria-label={`${sessao.nome} · ${sessao.email}`}
        aria-haspopup="true"
        aria-expanded={aberto}
        onClick={() => setAberto((atual) => !atual)}
      >
        <IconeDeConta />
      </button>
      {aberto ? (
        <div className="menu-de-conta-painel">
          {vista === 'lista' ? (
            <>
              <p className="menu-de-conta-identidade">
                {sessao.nome} · {sessao.email}
              </p>
              <button
                type="button"
                ref={primeiroItemRef}
                className="menu-de-conta-item"
                onClick={() => setVista('confirmar_sair')}
              >
                {textos.menuDeConta.itemSairDaConta}
              </button>
              {/* "Trocar de usuário" só aparece se houver mais de uma conta configurada
                  no aparelho (design.md, tela 6). A tela de hoje não tem como saber
                  disso — o servidor não expõe essa informação —, então o item não
                  aparece nunca nesta fase. Não inventamos o estado que falta. */}
            </>
          ) : (
            <>
              <p>{textos.menuDeConta.confirmarSairLinha1}</p>
              <p>{textos.menuDeConta.confirmarSairLinha2}</p>
              <div className="menu-de-conta-confirmacao-botoes">
                <button
                  type="button"
                  ref={primeiroItemRef}
                  className="menu-de-conta-botao-cancelar"
                  onClick={() => setVista('lista')}
                >
                  {textos.menuDeConta.botaoCancelar}
                </button>
                <button
                  type="button"
                  className="menu-de-conta-botao-sair"
                  onClick={() => void confirmarSair()}
                >
                  {textos.menuDeConta.botaoSair}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

function IconeDeConta() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5.6" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2.5 13.5 C2.5 10.5 5 8.8 8 8.8 C11 8.8 13.5 10.5 13.5 13.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

const clienteDaApiPadrao = criarClienteDaApi()
