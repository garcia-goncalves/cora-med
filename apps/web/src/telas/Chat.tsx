import { useEffect, useReducer, useState } from 'react'

import { criarClienteDaApi, type ClienteDaApi, type SessaoDoUsuario } from '../api/cliente.js'
import { BannerSemInternet } from '../componentes/BannerSemInternet.js'
import { CampoDeEntrada } from '../componentes/CampoDeEntrada.js'
import { Ilustracao } from '../componentes/Ilustracao.js'
import { Mensagem } from '../componentes/Mensagem.js'
import { MenuDeConta } from '../componentes/MenuDeConta.js'
import { PromptDeInstalacao } from '../componentes/PromptDeInstalacao.js'
import { TelaDeErro } from '../componentes/TelaDeErro.js'
import { estadoInicialDaConversa, reduzirConversa, type EstadoDoResumo } from '../estado/conversa.js'
import { textos } from '../textos.js'
import './Chat.css'

/**
 * Tela 2 (chat) e tela 3 (erro/conexão) do `design.md`, na mesma tela porque a segunda
 * substitui parte ou toda a primeira, nunca navega para outro lugar. Consome a máquina
 * de estados da Etapa 13 (`conversa.ts`) e o cliente HTTP da Etapa 12 — nenhuma regra de
 * "mensagem que falha nunca some" é reimplementada aqui.
 */
export interface PropsDaTelaDeChat {
  /** Injetável para teste/composição; por padrão fala com o servidor de verdade. */
  cliente?: ClienteDaApi
  sessao: SessaoDoUsuario
  /** Chamado quando a pessoa confirma "Entrar de novo" na tela de sessão expirada — quem
   * decide o que fazer com isso é `App.tsx` (volta ao estado anônimo, Etapa 12). */
  aoSessaoExpirar: () => void
}

/**
 * Os dois estados de tela cheia da tela 3. `sessao_expirada` nunca carrega id de
 * mensagem — a conversa inteira deixou de valer. `servidor_indisponivel` guarda o id da
 * mensagem que falhou, para o botão "Tentar de novo" reenviar exatamente ela.
 */
type TelaCheia = { tipo: 'servidor_indisponivel'; idDaMensagem: string } | { tipo: 'sessao_expirada' }

export function Chat({ cliente, sessao, aoSessaoExpirar }: PropsDaTelaDeChat) {
  const clienteDaApi = cliente ?? clienteDaApiPadrao
  const [estado, despachar] = useReducer(reduzirConversa, estadoInicialDaConversa)
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [telaCheia, setTelaCheia] = useState<TelaCheia | null>(null)

  useEffect(() => {
    const aoFicarOnline = () => setOnline(true)
    const aoFicarOffline = () => setOnline(false)
    window.addEventListener('online', aoFicarOnline)
    window.addEventListener('offline', aoFicarOffline)
    return () => {
      window.removeEventListener('online', aoFicarOnline)
      window.removeEventListener('offline', aoFicarOffline)
    }
  }, [])

  const aguardandoResposta = estado.mensagens.some((mensagem) => mensagem.situacao === 'enviando')

  async function mandarAoServidor(id: string, texto: string, primeiraMensagem: boolean) {
    // `deviceId` nasce na Etapa 17 (PWA), com um identificador persistido no aparelho;
    // até lá a tela web manda `null`, que o servidor já trata como opcional.
    const resultado = await clienteDaApi.enviarTurno(texto, null)

    if (resultado.status === 'sessao_expirada') {
      setTelaCheia({ tipo: 'sessao_expirada' })
      return
    }

    if (resultado.status === 'servidor_indisponivel' && primeiraMensagem) {
      // Sem conversa anterior para preservar por baixo — é o caso "ao abrir o app ou
      // enviar mensagem" do `design.md`. Com histórico já visível, a mesma falha vira
      // `falhar` inline (abaixo), como o roteiro manual da Etapa 15 verifica.
      setTelaCheia({ tipo: 'servidor_indisponivel', idDaMensagem: id })
      return
    }

    if (resultado.status !== 'sucesso') {
      // `servidor_indisponivel` (fora do primeiro caso), `sem_internet` e os status de
      // login (que não deveriam ocorrer aqui) caem todos aqui: a mensagem falhou, mas
      // permanece na lista com "Tentar de novo" — nunca some.
      despachar({ tipo: 'falhar', id })
      return
    }

    const resposta = interpretarResultadoDoTurno(resultado.dados.outcome)
    if (resposta === null) {
      despachar({ tipo: 'falhar', id })
      return
    }

    despachar({
      tipo: 'confirmar',
      idDaMensagemEnviada: id,
      resposta: {
        id: crypto.randomUUID(),
        texto: resposta.texto,
        ...(resposta.estadoDoResumo === undefined ? {} : { estadoDoResumo: resposta.estadoDoResumo }),
      },
    })
  }

  async function enviarMensagem(texto: string) {
    const primeiraMensagem = estado.mensagens.length === 0
    const id = crypto.randomUUID()
    despachar({ tipo: 'enviar', id, texto })
    await mandarAoServidor(id, texto, primeiraMensagem)
  }

  async function tentarDeNovo(id: string) {
    const mensagem = estado.mensagens.find((mensagem) => mensagem.id === id)
    if (mensagem === undefined) return
    despachar({ tipo: 'reenviar', id })
    await mandarAoServidor(id, mensagem.texto, false)
  }

  async function tentarDeNovoTelaCheia() {
    if (telaCheia === null || telaCheia.tipo !== 'servidor_indisponivel') return
    const idDaMensagem = telaCheia.idDaMensagem
    const mensagem = estado.mensagens.find((mensagem) => mensagem.id === idDaMensagem)
    if (mensagem === undefined) return
    setTelaCheia(null)
    despachar({ tipo: 'reenviar', id: idDaMensagem })
    await mandarAoServidor(idDaMensagem, mensagem.texto, true)
  }

  if (telaCheia?.tipo === 'sessao_expirada') {
    return (
      <TelaDeErro
        linhas={[textos.erroDeConexao.sessaoExpiradaLinha1]}
        textoDoBotao={textos.erroDeConexao.botaoEntrarDeNovo}
        aoClicarBotao={aoSessaoExpirar}
      />
    )
  }

  return (
    <div className="chat-tela">
      {/* `position: relative` só existe aqui porque `MenuDeConta.css` (Etapa 16)
          posiciona o painel relativo ao cabeçalho, para ocupar a largura cheia dele
          sem esta tela precisar de uma classe nova em Chat.css. */}
      <header className="chat-cabecalho" style={{ position: 'relative' }}>
        <span className="chat-nome-produto">{textos.chat.nomeProduto}</span>
        <span className="chat-legenda">{textos.chat.legenda}</span>
        <MenuDeConta sessao={sessao} aoSair={aoSessaoExpirar} />
      </header>
      {online ? null : <BannerSemInternet />}
      <div className="chat-corpo">
        {telaCheia?.tipo === 'servidor_indisponivel' ? (
          <TelaDeErro
            ilustracao={<Ilustracao variante="erro-conexao" />}
            linhas={[textos.erroDeConexao.servidorForaDoArLinha1, textos.erroDeConexao.servidorForaDoArLinha2]}
            textoDoBotao={textos.chat.botaoTentarDeNovo}
            aoClicarBotao={() => void tentarDeNovoTelaCheia()}
          />
        ) : estado.mensagens.length === 0 ? (
          <div className="chat-vazio">
            <Ilustracao variante="vazio" />
            <p>{textos.chat.vazioLinha1}</p>
            <p>{textos.chat.vazioLinha2}</p>
          </div>
        ) : (
          <div className="chat-lista">
            {estado.mensagens.map((mensagem, indice) => {
              const anterior = indice === 0 ? undefined : estado.mensagens[indice - 1]
              const espacamento =
                anterior === undefined
                  ? undefined
                  : anterior.autor === mensagem.autor
                    ? 'chat-espaco-mesma-autoria'
                    : 'chat-espaco-troca-autoria'
              return (
                <div key={mensagem.id} className={espacamento}>
                  <Mensagem mensagem={mensagem} aoTentarDeNovo={(id) => void tentarDeNovo(id)} />
                </div>
              )
            })}
            {aguardandoResposta ? <div className="chat-digitando">{textos.chat.coraEstaDigitando}</div> : null}
          </div>
        )}
      </div>
      {telaCheia === null ? (
        <>
          <PromptDeInstalacao />
          <CampoDeEntrada
            valor={estado.rascunho}
            desabilitado={aguardandoResposta}
            aoDigitar={(texto) => despachar({ tipo: 'digitar_rascunho', texto })}
            aoEnviar={(texto) => void enviarMensagem(texto)}
          />
        </>
      ) : null}
    </div>
  )
}

/**
 * Traduz `RespostaDeTurno['outcome']` (tipado como `unknown` em `cliente.ts` de
 * propósito — quem interpreta o resultado da conversa é esta tela, não a camada HTTP)
 * para o que o reducer da Etapa 13 entende. Hoje o servidor só expõe
 * `{ kind: 'replied', reply }` como texto de conversa (`apps/server/src/run/turn.ts`);
 * os outros desfechos (`needs_approval`, `denied`, `limit_reached`, `cancelled`) ainda
 * não têm tela desenhada em `design.md` — tratados como falha de envio (com "Tentar de
 * novo"), nunca como sucesso silencioso.
 *
 * `estadoDoResumo` fica sempre indefinido por ora: o `outcome` de hoje não carrega o
 * estado do resumo operacional de forma estruturada, só o texto final da resposta. Não
 * se inventa o estado antes de o servidor expô-lo — quando esse campo existir no
 * contrato, é aqui que ele passa a ser lido.
 */
function interpretarResultadoDoTurno(
  outcome: unknown,
): { texto: string; estadoDoResumo?: EstadoDoResumo } | null {
  if (outcome === null || typeof outcome !== 'object' || !('kind' in outcome)) return null
  if ((outcome as { kind?: unknown }).kind !== 'replied') return null
  const reply = (outcome as { reply?: unknown }).reply
  if (typeof reply !== 'string') return null
  return { texto: reply }
}

const clienteDaApiPadrao = criarClienteDaApi()
