import type { EstadoDoResumo } from '../estado/conversa.js'
import { textos } from '../textos.js'

/**
 * Chip acima do texto da bolha da Cora, quando o turno trouxe resumo operacional
 * (`resumo.ts`, `apps/server/src/inbox/resumo.ts`). Sempre ícone + rótulo — a cor é
 * reforço, nunca o único sinal (`design.md`, regra do painel: `com_pendencias` e a cor
 * primária são vizinhas de matiz de propósito).
 */
export interface PropsDoChipDeEstado {
  estado: EstadoDoResumo
}

export function ChipDeEstado({ estado }: PropsDoChipDeEstado) {
  return (
    <span className={`chat-chip chat-chip-${estado}`}>
      <IconeDoChip estado={estado} />
      {textos.chips[estado]}
    </span>
  )
}

function IconeDoChip({ estado }: { estado: EstadoDoResumo }) {
  switch (estado) {
    case 'erro_de_acesso':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2 L14.5 13.5 L1.5 13.5 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <line x1="8" y1="6.5" x2="8" y2="9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="11.5" r="0.8" fill="currentColor" />
        </svg>
      )
    case 'sincronizacao_incompleta':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 4.5 V8 L10.5 9.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'sem_registros':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.4" />
          <line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )
    case 'sem_pendencias':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.5 8.3 L6.6 11.4 L12.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'com_pendencias':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <line x1="4.5" y1="4.5" x2="12.5" y2="4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="4.5" y1="8" x2="12.5" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="4.5" y1="11.5" x2="9.5" y2="11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )
  }
}
