// Nível 2 — Prioridade de Dispensa (FEFO: First Expired, First Out).
//
// Responde a uma pergunta só: quando o mesmo medicamento tem mais de um
// lote em estoque, qual vender primeiro. Medicamento com um lote só não
// aparece — a Function o descarta, porque não há decisão a tomar.

import { useEffect, useState } from 'react';
import { DADOS_FALSOS } from '../../config/env';
import { get } from '../../services/httpInterceptor';
import type { LoteFEFO, MedicamentoFEFO, RespostaPrioridadeDispensa } from '../../services/tipos';
import { formatarNumero } from '../../utils/formato';
import { cores } from '../../theme/colors';
import { Carregando, EstadoVazio, TarjaModoTeste, TituloTela } from '../../components/Comuns';
import { Icone } from '../../components/Icone';

function emDias(dias: number): string {
  return new Date(Date.now() + dias * 864e5).toISOString().split('T')[0]!;
}

const FALSOS: MedicamentoFEFO[] = [
  {
    id_medicamento: 12,
    nome: 'Dipirona 500mg',
    lote_prioritario: {
      id_lote: 45, numero_lote: 'L2024-001',
      validade: emDias(15), dias_restantes: 15, quantidade: 25,
    },
    outros_lotes: [
      { id_lote: 52, numero_lote: 'L2024-018', validade: emDias(120), dias_restantes: 120, quantidade: 100 },
    ],
    previsao_venda_ate_vencimento: 12,
    excesso_provavel: 13,
  },
  {
    // Giro adequado: o lote prioritário vende inteiro antes de vencer.
    // Sem excesso, sem destaque — a tela não inventa urgência.
    id_medicamento: 8,
    nome: 'Amoxicilina 250mg',
    lote_prioritario: {
      id_lote: 61, numero_lote: 'L2025-007',
      validade: emDias(60), dias_restantes: 60, quantidade: 40,
    },
    outros_lotes: [
      { id_lote: 63, numero_lote: 'L2025-011', validade: emDias(200), dias_restantes: 200, quantidade: 80 },
      { id_lote: 64, numero_lote: 'L2025-014', validade: emDias(240), dias_restantes: 240, quantidade: 30 },
    ],
    previsao_venda_ate_vencimento: 55,
    excesso_provavel: 0,
  },
];

export function PrioridadeDispensaScreen() {
  const [medicamentos, setMedicamentos] = useState<MedicamentoFEFO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (DADOS_FALSOS.prioridadeDispensa) {
        setMedicamentos(FALSOS);
        setCarregando(false);
        return;
      }
      try {
        const r = await get<RespostaPrioridadeDispensa>('/buscar_prioridade_dispensa');
        setMedicamentos(r.medicamentos ?? []);
      } catch {
        setErro('Não foi possível carregar a prioridade de dispensa.');
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  if (carregando) return <Carregando rotulo="Calculando prioridade" />;

  return (
    <>
      {DADOS_FALSOS.prioridadeDispensa && <TarjaModoTeste />}
      <TituloTela sub="Quando o mesmo medicamento tem mais de um lote, qual vender primeiro.">
        Prioridade de Dispensa
      </TituloTela>

      {erro ? (
        <EstadoVazio>{erro}</EstadoVazio>
      ) : medicamentos.length === 0 ? (
        // Lista vazia é estado NORMAL, não falha: significa que nenhum
        // medicamento tem dois lotes ativos agora. Por isso não usa o
        // texto de erro — confundir os dois faria o farmacêutico procurar
        // um problema que não existe.
        <EstadoVazio>
          Nenhum medicamento com mais de um lote ativo no momento — não há
          decisão de prioridade a tomar.
        </EstadoVazio>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
          {medicamentos.map((m) => <CartaoMedicamento key={m.id_medicamento} med={m} />)}
        </div>
      )}
    </>
  );
}

function CartaoMedicamento({ med }: { med: MedicamentoFEFO }) {
  const p = med.lote_prioritario;

  return (
    <article style={{
      border: '1px solid ' + cores.borda, borderRadius: 12, padding: 20,
    }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 17 }}>{med.nome}</h2>

      {/* Lote prioritário em destaque. O rótulo diz o que fazer, não só
          qual é: "vender primeiro" é a instrução, o número do lote é o
          detalhe. */}
      <div style={{
        borderRadius: 8, padding: 14,
        background: cores.primaryLight,
        border: `1px solid color-mix(in srgb, ${cores.primary} 33%, transparent)`,
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
          color: cores.primaryDark, textTransform: 'uppercase',
        }}>
          <Icone nome="chevron-right" tamanho={14} />
          Vender primeiro
        </div>
        <div style={{ marginTop: 6, fontSize: 15 }}>
          Lote <strong>{p.numero_lote}</strong>
          <span style={{ color: cores.neutro }}>
            {' · '}{formatarNumero(p.quantidade)} un
            {' · '}vence em {p.dias_restantes} dias ({p.validade})
          </span>
        </div>
      </div>

      {/* Recomendação em destaque — Nível 1 reaproveitado só no ESTILO.
          Diferente dos alertas, o backend não manda texto pronto: só o
          número excesso_provavel. A frase abaixo é montada aqui.

          E é um bloco, não um botão: não existe fluxo de transferência,
          promoção ou devolução ligado a isto. Um botão prometeria uma
          ação que o sistema não executa. */}
      {med.excesso_provavel > 0 && (
        <p
          role="note"
          style={{
            margin: '14px 0 0', padding: '12px 14px', borderRadius: 6,
            background: cores.primary, color: cores.sobreAcento, fontSize: 13,
            maxWidth: 420, lineHeight: 1.5,
          }}
        >
          <strong>{formatarNumero(med.excesso_provavel)} unidades</strong>{' '}
          provavelmente não vendem a tempo — considere transferir, promover
          ou devolver.
        </p>
      )}

      <p style={{ margin: '12px 0 0', fontSize: 13, color: cores.neutro }}>
        Previsão de venda até o vencimento:{' '}
        <strong>{formatarNumero(med.previsao_venda_ate_vencimento)} un</strong>
        {med.excesso_provavel === 0 && ' — giro adequado, sem ação necessária.'}
      </p>

      {med.outros_lotes.length > 0 && (
        <section style={{ marginTop: 16 }}>
          <h3 style={{
            margin: '0 0 6px', fontSize: 12, fontWeight: 600,
            color: cores.neutro, textTransform: 'uppercase', letterSpacing: 0.4,
          }}>
            Demais lotes ({med.outros_lotes.length})
          </h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {med.outros_lotes.map((l) => <LinhaOutroLote key={l.id_lote} lote={l} />)}
          </ul>
        </section>
      )}
    </article>
  );
}

function LinhaOutroLote({ lote }: { lote: LoteFEFO }) {
  return (
    <li style={{
      display: 'flex', gap: 8, padding: '6px 0', fontSize: 13,
      color: cores.neutro, borderTop: '1px solid ' + cores.borda,
    }}>
      <span style={{ flex: 1 }}>{lote.numero_lote}</span>
      <span>{formatarNumero(lote.quantidade)} un</span>
      <span style={{ width: 130, textAlign: 'right' }}>
        {lote.dias_restantes} dias ({lote.validade})
      </span>
    </li>
  );
}
