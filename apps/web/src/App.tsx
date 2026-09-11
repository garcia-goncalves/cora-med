import { useSessao } from './estado/sessao.js'
import { Login } from './telas/Login.js'

/**
 * Decide entre a tela de login (Etapa 14) e a conversa, conforme o estado de sessão
 * (`GET /auth/sessao`, Etapa 12). A tela de chat de verdade chega na Etapa 15; até lá,
 * a pessoa autenticada vê só um marcador.
 */
export function App() {
  const { estado, definirSessao } = useSessao()

  if (estado.status === 'verificando') {
    return null
  }

  if (estado.status === 'anonimo') {
    return <Login aoEntrar={definirSessao} />
  }

  // estado.status === 'autenticado' — marcador provisório até a Etapa 15.
  return <div>Cora — {estado.sessao.nome}</div>
}
