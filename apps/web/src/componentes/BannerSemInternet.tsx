import { textos } from '../textos.js'

/**
 * Banner fixo no topo (abaixo do cabeçalho) quando o navegador reporta offline
 * (`design.md`, tela 3). É o único dos seis estados de erro/conexão que **não** ocupa a
 * tela inteira — a conversa continua visível e utilizável por baixo, por ser reversível
 * e temporário.
 */
export function BannerSemInternet() {
  return (
    <div className="chat-banner-sem-internet" role="status">
      {textos.erroDeConexao.semInternet}
    </div>
  )
}
