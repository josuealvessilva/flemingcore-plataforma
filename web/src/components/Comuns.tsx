import type { ReactNode } from 'react';
import { cores } from '../theme/colors';
import { Icone } from './Icone';

/** Tarja de modo de teste — equivalente ao Container amber do Flutter. */
export function TarjaModoTeste({ texto = 'Modo de teste — dados fictícios' }: { texto?: string }) {
  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: cores.aviso, color: cores.atencao,
      padding: '9px 13px', marginBottom: 16,
      fontSize: 12.5, fontWeight: 500, borderRadius: 8,
      border: `1px solid color-mix(in srgb, ${cores.atencao} 32%, transparent)`,
    }}>
      <Icone nome="settings" tamanho={15} />
      {texto}
    </div>
  );
}

/**
 * Selo de simulação — Seção 4.
 *
 * `simulado` vem do backend, nunca de constante local. Quando o backend
 * passar a calcular com dado real, o campo vira false e o selo some
 * sozinho, sem nenhuma mudança aqui.
 */
export function SeloSimulacao({ simulado }: { simulado: boolean | undefined }) {
  if (simulado !== true) return null;
  const texto = 'Simulação — resultado demonstrativo, não operacional';
  return (
    <div aria-label={texto} className="fc-etiqueta fc-etiqueta--atencao">
      <Icone nome="flask-conical" tamanho={14} />
      <span>{texto}</span>
    </div>
  );
}

/**
 * Ressalva permanente da Ideia 01 — Seção 4.
 *
 * Sempre visível junto ao aviso, nunca atrás de um "ok" que some. Por isso
 * é um bloco de texto fixo, não um toast nem um dialog dispensável.
 */
export function RessalvaInteracao() {
  return (
    <p style={{ fontSize: 11.5, color: cores.neutro, margin: '8px 0 0', lineHeight: 1.5 }}>
      Este sistema verifica apenas uma lista curada de poucas combinações
      conhecidas. A ausência de alerta NÃO significa ausência de interação —
      sempre consulte sua fonte de referência completa.
    </p>
  );
}

export function Carregando({ rotulo = 'Carregando' }: { rotulo?: string }) {
  return (
    <div role="status" aria-live="polite" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
      padding: 56, color: cores.neutro, fontSize: 14,
    }}>
      <span className="fc-pulso" aria-hidden="true"><i /><i /><i /></span>
      {rotulo}…
    </div>
  );
}

export function EstadoVazio({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 10, padding: 56, color: cores.neutro, textAlign: 'center',
      border: `1px dashed ${cores.borda}`, borderRadius: 12,
      background: cores.superficieAlt,
    }}>
      <Icone nome="boxes" tamanho={30} estilo={{ opacity: .5 }} />
      <div style={{ maxWidth: 420, fontSize: 14 }}>{children}</div>
    </div>
  );
}

export function TituloTela({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header style={{ marginBottom: 22 }}>
      <h1 style={{ fontSize: 27, fontWeight: 700, margin: 0, letterSpacing: '-.02em' }}>
        {children}
      </h1>
      {sub && (
        <p style={{ color: cores.textoSuave, margin: '6px 0 0', fontSize: 14.5, maxWidth: '62ch' }}>
          {sub}
        </p>
      )}
    </header>
  );
}

/** Cartão de métrica — base dos painéis de destaque da Seção 10. */
export function CartaoMetrica({
  titulo, valor, cor = cores.primary, icone, aviso,
}: {
  titulo: string; valor: string; cor?: string; icone?: string; aviso?: string;
}) {
  return (
    // A transparência vem de color-mix, não de hexadecimal concatenado:
    // `cor` agora pode ser uma variável CSS (var(--primaria)), e
    // `${cor}14` não é cor válida.
    <div className="fc-cartao fc-cartao--interativo" style={{
      flex: 1, minWidth: 190, padding: 20, borderRadius: 14,
      background: `color-mix(in srgb, ${cor} 9%, var(--superficie))`,
      borderColor: `color-mix(in srgb, ${cor} 28%, transparent)`,
    }}>
      {icone && (
        <div style={{ color: cor, marginBottom: 8 }}>
          <Icone nome={icone} tamanho={21} />
        </div>
      )}
      <div className="fc-num" style={{ fontSize: 30, fontWeight: 700, color: cor, lineHeight: 1.1 }}>
        {valor}
      </div>
      <div style={{ color: cores.textoSuave, fontSize: 13, marginTop: 6, fontWeight: 500 }}>
        {titulo}
      </div>
      {aviso && (
        <div style={{ fontSize: 11.5, color: cores.neutro, marginTop: 8, lineHeight: 1.45 }}>
          {aviso}
        </div>
      )}
    </div>
  );
}

/** Barra de progresso horizontal com rótulo e percentual. */
export function BarraFator({ label, valor, cor }: { label: string; valor: number; cor?: string }) {
  const pct = Math.round(valor * 100);
  const corBarra = cor ?? (valor >= 0.66 ? cores.risco : valor >= 0.4 ? cores.atencao : cores.ok);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <span style={{ width: 150, fontSize: 12.5, color: cores.textoSuave }}>{label}</span>
      <div
        role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
        aria-label={`${label}: ${pct}%`}
        style={{ flex: 1, height: 9, borderRadius: 999, background: cores.trilho, overflow: 'hidden' }}
      >
        <div style={{
          width: `${pct}%`, height: '100%', background: corBarra, borderRadius: 999,
          transition: 'width .4s ease',
        }} />
      </div>
      <span className="fc-num" style={{ fontSize: 12.5, width: 42, textAlign: 'right', fontWeight: 600 }}>
        {pct}%
      </span>
    </div>
  );
}

export function Tabela({ colunas, children }: { colunas: string[]; children: ReactNode }) {
  return (
    <div className="fc-cartao" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="fc-tabela">
          <thead>
            <tr>
              {colunas.map((c) => (
                <th key={c} scope="col">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
