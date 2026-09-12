import { useCallback, useEffect, useState } from 'react'

import { criarClienteDaApi, type ClienteDaApi, type SessaoDoUsuario } from '../api/cliente.js'

/**
 * Estado de sessão sobre `GET /auth/sessao`. Sem biblioteca de estado global — são
 * só duas telas (login e chat), e `useState`/`useEffect` do próprio React bastam.
 */
export type EstadoDaSessao =
  | { status: 'verificando' }
  | { status: 'autenticado'; sessao: SessaoDoUsuario }
  | { status: 'anonimo' }

export interface ControleDeSessao {
  estado: EstadoDaSessao
  /** Chamado depois de um `entrar()` bem-sucedido na tela de login. */
  definirSessao: (sessao: SessaoDoUsuario) => void
  /** Chamado depois de `sair()` ou ao receber `sessao_expirada` de qualquer chamada. A
   * própria chamada ao servidor é feita por quem consome este hook, via `ClienteDaApi`
   * — este arquivo só guarda o estado local. */
  encerrarSessao: () => void
}

/** Instância padrão, criada uma única vez no escopo do módulo — nunca recalculada a
 * cada render, senão o `useEffect` abaixo (que depende de `[cliente]`) entra em loop. */
const clienteDaApiPadrao = criarClienteDaApi()

/**
 * Ao montar, confere se já existe sessão válida no servidor (cookie httpOnly enviado
 * automaticamente pelo navegador) — é o que permite recarregar a página sem perder a
 * conversa. `cliente` é injetável para não acoplar o hook à instância padrão.
 */
export function useSessao(cliente?: ClienteDaApi): ControleDeSessao {
  const clienteEfetivo = cliente ?? clienteDaApiPadrao
  const [estado, setEstado] = useState<EstadoDaSessao>({ status: 'verificando' })

  useEffect(() => {
    let cancelado = false
    void clienteEfetivo.obterSessao().then((resultado) => {
      if (cancelado) return
      setEstado(
        resultado.status === 'sucesso'
          ? { status: 'autenticado', sessao: resultado.dados }
          : { status: 'anonimo' },
      )
    })
    return () => {
      cancelado = true
    }
  }, [clienteEfetivo])

  const definirSessao = useCallback((sessao: SessaoDoUsuario) => {
    setEstado({ status: 'autenticado', sessao })
  }, [])

  const encerrarSessao = useCallback(() => {
    setEstado({ status: 'anonimo' })
  }, [])

  return { estado, definirSessao, encerrarSessao }
}
