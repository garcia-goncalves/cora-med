import { useRef, useState, type FormEvent } from 'react'

import { criarClienteDaApi, type ClienteDaApi, type SessaoDoUsuario } from '../api/cliente.js'
import { MarcaCora } from '../componentes/MarcaCora.js'
import { textos } from '../textos.js'
import './Login.css'

/**
 * Tela 1 do `design.md`: entrar com e-mail e senha. Todos os textos vêm de
 * `textos.ts` — nenhuma string de interface nova nasce aqui.
 *
 * Dois fracassos documentados (nota de implementação do `design.md`, vindos do
 * `LoginPage.tsx` do Workspace) que esta tela evita de propósito:
 * - o campo de senha é **limpo** depois de um erro de credenciais — nunca guarda
 *   pontos residuais da tentativa anterior;
 * - o e-mail preenchido por autofill do navegador fica visível e legível, com o
 *   rótulo à mostra, para a pessoa perceber a conta errada antes de clicar em Entrar.
 */

export interface PropsDaTelaDeLogin {
  /** Injetável para teste/composição; por padrão fala com o servidor de verdade. */
  cliente?: ClienteDaApi
  /** Chamado depois de um `entrar()` bem-sucedido. */
  aoEntrar: (sessao: SessaoDoUsuario) => void
}

interface ErrosDeCampo {
  email?: string
  senha?: string
}

export function Login({ cliente, aoEntrar }: PropsDaTelaDeLogin) {
  const clienteDaApi = cliente ?? clienteDaApiPadrao
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({})
  const [erroDoFormulario, setErroDoFormulario] = useState<string | null>(null)

  const campoEmailRef = useRef<HTMLInputElement>(null)
  const campoSenhaRef = useRef<HTMLInputElement>(null)

  async function aoSubmeter(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    // Validação local, antes de chamar o servidor: mensagem junto do campo, foco no
    // primeiro campo vazio (design.md, tela 1).
    if (email.trim() === '') {
      setErrosDeCampo({ email: textos.login.erroEmailVazio })
      setErroDoFormulario(null)
      campoEmailRef.current?.focus()
      return
    }
    if (senha === '') {
      setErrosDeCampo({ senha: textos.login.erroSenhaVazia })
      setErroDoFormulario(null)
      campoSenhaRef.current?.focus()
      return
    }

    setErrosDeCampo({})
    setErroDoFormulario(null)
    setEnviando(true)
    try {
      const resultado = await clienteDaApi.entrar(email, senha)
      switch (resultado.status) {
        case 'sucesso':
          aoEntrar(resultado.dados)
          return
        case 'credenciais_invalidas':
          setErroDoFormulario(textos.login.erroCredenciaisInvalidas)
          setSenha('')
          campoSenhaRef.current?.focus()
          break
        case 'bloqueado_por_tentativas':
          setErroDoFormulario(textos.login.erroBloqueadoPorTentativas)
          setSenha('')
          campoSenhaRef.current?.focus()
          break
        default:
          // servidor_indisponivel, sem_internet e sessao_expirada (esta última não
          // deve ocorrer aqui, pois ainda não há sessão) recebem a mesma frase: o
          // servidor não respondeu, tente de novo.
          setErroDoFormulario(textos.login.erroServidorForaDoAr)
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login-tela">
      <div className="login-marca">
        <MarcaCora />
      </div>
      <form onSubmit={(evento) => void aoSubmeter(evento)} noValidate>
        <div className="login-campo">
          <label htmlFor="login-email">{textos.login.rotuloEmail}</label>
          <input
            id="login-email"
            ref={campoEmailRef}
            type="email"
            autoComplete="username"
            value={email}
            readOnly={enviando}
            aria-invalid={errosDeCampo.email !== undefined}
            aria-describedby={errosDeCampo.email === undefined ? 'login-email-ajuda' : 'login-email-erro'}
            onChange={(evento) => setEmail(evento.currentTarget.value)}
          />
          {errosDeCampo.email === undefined ? (
            <span id="login-email-ajuda" className="login-ajuda">{textos.login.ajudaEmail}</span>
          ) : (
            <span id="login-email-erro" className="login-erro-campo">{errosDeCampo.email}</span>
          )}
        </div>
        <div className="login-campo">
          <label htmlFor="login-senha">{textos.login.rotuloSenha}</label>
          <input
            id="login-senha"
            ref={campoSenhaRef}
            type="password"
            autoComplete="current-password"
            value={senha}
            readOnly={enviando}
            aria-invalid={errosDeCampo.senha !== undefined}
            aria-describedby={errosDeCampo.senha !== undefined ? 'login-senha-erro' : undefined}
            onChange={(evento) => setSenha(evento.currentTarget.value)}
          />
          {errosDeCampo.senha !== undefined ? (
            <span id="login-senha-erro" className="login-erro-campo">{errosDeCampo.senha}</span>
          ) : null}
        </div>
        <button className="login-botao" type="submit" disabled={enviando}>
          {enviando ? textos.login.botaoEntrando : textos.login.botaoEntrar}
        </button>
        {erroDoFormulario !== null ? (
          <div className="login-erro-formulario" role="alert">
            <IconeDeErro />
            <span>{erroDoFormulario}</span>
          </div>
        ) : null}
      </form>
    </div>
  )
}

function IconeDeErro() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="var(--color-erro)" />
      <line x1="8" y1="4.5" x2="8" y2="8.5" stroke="var(--color-erro-foreground)" strokeWidth={1.4} strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.9" fill="var(--color-erro-foreground)" />
    </svg>
  )
}

const clienteDaApiPadrao = criarClienteDaApi()
