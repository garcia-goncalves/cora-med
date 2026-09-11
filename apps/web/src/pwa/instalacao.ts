/**
 * Controle do prompt de instalação do PWA (design.md, tela 4). Lógica pura, sem React
 * e sem tocar `window` diretamente — quem escuta o evento `beforeinstallprompt` de
 * verdade é `PromptDeInstalacao.tsx`; este módulo só decide o que fazer com ele, e por
 * isso é testável com um evento falso, sem DOM real.
 *
 * A recusa ("Agora não") vale só nesta sessão: fica guardada em variável de closure,
 * que não sobrevive a um recarregamento de página — não há `localStorage` nem cookie
 * envolvido (`design.md`, tela 4, não pede lembrar entre sessões).
 */

/** O formato do evento `BeforeInstallPromptEvent` do Chrome/Android que interessa
 * aqui — não é tipo padrão do DOM, por isso é declarado à mão. */
export interface EventoDeInstalacaoPwa {
  preventDefault(): void
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface ControleDeInstalacao {
  /** `true` só quando o navegador já disparou o evento e a pessoa ainda não recusou
   * nesta sessão. É o único jeito certo de saber se dá para instalar — nunca por
   * temporizador, nunca chutado (`design.md`, tela 4). */
  podeInstalar(): boolean
  /** Chamado quando `window` recebe `beforeinstallprompt`. Cancela o prompt automático
   * do navegador (`preventDefault`) — quem decide quando mostrar o cartão é a Cora,
   * nunca o navegador sozinho. */
  registrarEventoDisponivel(evento: EventoDeInstalacaoPwa): void
  /** Dispara o prompt nativo do navegador e aguarda a escolha da pessoa. Sem evento
   * guardado (nada disparou, ou já foi consumido/recusado), não faz nada. */
  instalar(): Promise<void>
  /** "Agora não": esconde o cartão até a próxima sessão. */
  recusar(): void
}

export function criarControleDeInstalacao(): ControleDeInstalacao {
  let eventoGuardado: EventoDeInstalacaoPwa | null = null
  let recusadoNestaSessao = false

  return {
    podeInstalar: () => eventoGuardado !== null && !recusadoNestaSessao,

    registrarEventoDisponivel: (evento) => {
      evento.preventDefault()
      eventoGuardado = evento
    },

    instalar: async () => {
      if (eventoGuardado === null) return
      const evento = eventoGuardado
      eventoGuardado = null
      await evento.prompt()
      await evento.userChoice
    },

    recusar: () => {
      recusadoNestaSessao = true
      eventoGuardado = null
    },
  }
}
