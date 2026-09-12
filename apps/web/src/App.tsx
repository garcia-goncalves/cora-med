import { useSessao } from './estado/sessao.js'
import { Chat } from './telas/Chat.js'
import { Login } from './telas/Login.js'

/**
 * Decide entre a tela de login (Etapa 14) e a conversa (Etapa 15), conforme o estado de
 * sessão (`GET /auth/sessao`, Etapa 12).
 */
export function App() {
  const { estado, definirSessao, encerrarSessao } = useSessao()

  if (estado.status === 'verificando') {
    return null
  }

  if (estado.status === 'anonimo') {
    return <Login aoEntrar={definirSessao} />
  }

  return <Chat sessao={estado.sessao} aoSessaoExpirar={encerrarSessao} />
}
