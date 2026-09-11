import { useEffect, useState, type CSSProperties } from 'react'

import { criarControleDeInstalacao, type EventoDeInstalacaoPwa } from '../pwa/instalacao.js'
import { textos } from '../textos.js'

/**
 * Tela 4 do `design.md`: cartão que só aparece depois que o navegador dispara
 * `beforeinstallprompt` — nunca por temporizador, nunca chutado. Nada de arquivo `.css`
 * novo aqui (fora do que a Etapa 17 do plano lista): estilo inline com as variáveis de
 * `tokens.css`, mesmo vocabulário visual do resto da tela.
 *
 * Fica montado logo antes de `CampoDeEntrada` na ordem do flex de `.chat-tela`
 * (`Chat.tsx`) — é o que garante os "8px acima do campo de entrada" e "nunca sobrepondo
 * o botão Enviar" do design: os dois nunca disputam o mesmo espaço, o campo de entrada
 * é sempre empurrado para baixo pela margem deste cartão, nunca coberto por ele.
 */
export function PromptDeInstalacao() {
  const [controle] = useState(() => criarControleDeInstalacao())
  const [versao, forcarNovaRenderizacao] = useState(0)

  useEffect(() => {
    function aoDispararEvento(evento: Event) {
      evento.preventDefault()
      controle.registrarEventoDisponivel(evento as unknown as EventoDeInstalacaoPwa)
      forcarNovaRenderizacao((atual) => atual + 1)
    }
    window.addEventListener('beforeinstallprompt', aoDispararEvento)
    return () => window.removeEventListener('beforeinstallprompt', aoDispararEvento)
  }, [controle])

  if (!controle.podeInstalar()) return null

  async function aoClicarInstalar() {
    await controle.instalar()
    forcarNovaRenderizacao((atual) => atual + 1)
  }

  function aoClicarAgoraNao() {
    controle.recusar()
    forcarNovaRenderizacao((atual) => atual + 1)
  }

  return (
    <div role="dialog" aria-label={textos.promptPwa.titulo} data-versao={versao} style={estiloDoCartao}>
      <p style={estiloDoTitulo}>{textos.promptPwa.titulo}</p>
      <p style={estiloDoCorpo}>{textos.promptPwa.corpo}</p>
      <div style={estiloDosBotoes}>
        <button type="button" style={estiloDoBotaoSecundario} onClick={aoClicarAgoraNao}>
          {textos.promptPwa.botaoAgoraNao}
        </button>
        <button type="button" style={estiloDoBotaoPrimario} onClick={() => void aoClicarInstalar()}>
          {textos.promptPwa.botaoInstalar}
        </button>
      </div>
    </div>
  )
}

const estiloDoCartao: CSSProperties = {
  boxSizing: 'border-box',
  marginInline: 'var(--space-4)',
  marginBottom: 'var(--space-2)',
  padding: 'var(--space-4)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-flutuante)',
  background: 'var(--color-background)',
  color: 'var(--color-foreground)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
}

const estiloDoTitulo: CSSProperties = {
  margin: 0,
  fontWeight: 'var(--font-weight-bold)',
  fontSize: 'var(--text-base)',
}

const estiloDoCorpo: CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-sm)',
  color: 'var(--color-muted-foreground)',
}

const estiloDosBotoes: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-3)',
}

const estiloDoBotaoBase: CSSProperties = {
  flex: '1 1 0',
  boxSizing: 'border-box',
  font: 'inherit',
  fontWeight: 'var(--font-weight-medium)',
  fontSize: 'var(--text-base)',
  minHeight: 'var(--target-tocavel-min)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
}

const estiloDoBotaoSecundario: CSSProperties = {
  ...estiloDoBotaoBase,
  border: '1px solid var(--color-border)',
  background: 'none',
  color: 'var(--color-foreground)',
}

const estiloDoBotaoPrimario: CSSProperties = {
  ...estiloDoBotaoBase,
  border: 'none',
  background: 'var(--color-primary)',
  color: 'var(--color-primary-foreground)',
}
