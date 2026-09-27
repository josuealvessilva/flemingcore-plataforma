import { useState } from 'react';
import { cores } from '../theme/colors';
import { RESOLVER_ALERTA_ACEITA_DISCREPANCIA } from '../config/env';

function Overlay({ titulo, children, onFechar }: {
  titulo: string; children: React.ReactNode; onFechar: () => void;
}) {
  return (
    <div
      role="dialog" aria-modal="true" aria-label={titulo}
      onClick={onFechar}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: cores.superficie, borderRadius: 10, padding: 24, width: 420, maxWidth: '90vw' }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

const ACOES = ['promocao', 'devolucao', 'monitoramento'] as const;
export type AcaoTomada = (typeof ACOES)[number];

const ROTULO_ACAO: Record<AcaoTomada, string> = {
  promocao: 'Colocar em promoção',
  devolucao: 'Devolver ao distribuidor',
  monitoramento: 'Apenas monitorar',
};

/** Fluxo padrão — as três ações que o CHECK constraint do banco aceita. */
export function ModalAcaoPadrao({ medicamento, onEscolher, onFechar }: {
  medicamento: string;
  onEscolher: (acao: AcaoTomada) => void;
  onFechar: () => void;
}) {
  return (
    <Overlay titulo="Resolver Alerta" onFechar={onFechar}>
      <p style={{ marginTop: 0 }}>Selecione a ação para <strong>{medicamento}</strong>:</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {ACOES.map((acao) => (
          <li key={acao}>
            <button
              type="button" onClick={() => onEscolher(acao)}
              style={{
                width: '100%', textAlign: 'left', padding: 12, marginBottom: 6,
                border: `1px solid ${cores.borda}`, borderRadius: 6,
                background: cores.superficie, cursor: 'pointer', fontSize: 14,
              }}
            >
              {ROTULO_ACAO[acao]}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onFechar} style={{
        marginTop: 8, background: 'none', border: 'none',
        color: cores.neutro, cursor: 'pointer',
      }}>Cancelar</button>
    </Overlay>
  );
}

/**
 * Fluxo de discrepância — Ideia 15.
 *
 * Regra que não pode ser quebrada: nenhuma opção pode conter "fraude",
 * "desvio" ou "roubo". A causa costuma ser banal (erro de digitação,
 * produto danificado) e presumir má-fé no texto da interface é problema
 * sério, não imprecisão. Estes cinco motivos são deliberadamente neutros.
 */
const MOTIVOS = [
  'Erro de cadastro',
  'Produto danificado',
  'Transferência não registrada',
  'Venda fora do sistema',
  'Outro',
] as const;

export function ModalMotivoDiscrepancia({ onEscolher, onFechar }: {
  onEscolher: (motivo: string) => void;
  onFechar: () => void;
}) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const bloqueado = !RESOLVER_ALERTA_ACEITA_DISCREPANCIA;

  return (
    <Overlay titulo="Registrar Motivo da Discrepância" onFechar={onFechar}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {MOTIVOS.map((motivo) => (
          <li key={motivo}>
            <button
              type="button"
              onClick={() => setSelecionado(motivo)}
              aria-pressed={selecionado === motivo}
              style={{
                width: '100%', textAlign: 'left', padding: 12, marginBottom: 6,
                borderRadius: 6, cursor: 'pointer', fontSize: 14,
                border: `1px solid ${selecionado === motivo ? cores.primary : cores.borda}`,
                background: selecionado === motivo ? cores.primaryLight : cores.superficie,
              }}
            >
              {motivo}
            </button>
          </li>
        ))}
      </ul>

      {bloqueado && (
        <p role="note" style={{
          fontSize: 12, color: cores.atencao, background: cores.aviso,
          padding: 10, borderRadius: 6, marginTop: 12,
        }}>
          O registro de discrepância está desabilitado nesta instalação
          (<code>RESOLVER_ALERTA_ACEITA_DISCREPANCIA</code>). O motivo
          selecionado não seria enviado — feche e resolva o alerta pelo
          fluxo padrão, ou peça a reativação da flag.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          type="button"
          disabled={!selecionado || bloqueado}
          onClick={() => selecionado && onEscolher(selecionado)}
          style={{
            flex: 1, padding: 10, border: 'none', borderRadius: 6, color: cores.sobreAcento,
            cursor: !selecionado || bloqueado ? 'not-allowed' : 'pointer',
            background: !selecionado || bloqueado ? cores.desabilitado : cores.primary,
          }}
        >
          Registrar motivo
        </button>
        <button type="button" onClick={onFechar} style={{
          padding: '10px 16px', border: `1px solid ${cores.borda}`,
          borderRadius: 6, background: cores.superficie, cursor: 'pointer',
        }}>Cancelar</button>
      </div>
    </Overlay>
  );
}
