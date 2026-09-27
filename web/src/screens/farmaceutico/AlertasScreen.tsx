import { useEffect, useMemo, useState } from 'react';
import { DADOS_FALSOS } from '../../config/env';
import { get, post } from '../../services/httpInterceptor';
import type { Alerta, RespostaAlertas } from '../../services/tipos';
import { calcularDiasRestantes, formatarReais, prioridadePorScore } from '../../utils/formato';
import { cores } from '../../theme/colors';
import {
  CartaoMetrica, Carregando, EstadoVazio, Tabela, TarjaModoTeste, TituloTela,
} from '../../components/Comuns';
import {
  ModalAcaoPadrao, ModalMotivoDiscrepancia, type AcaoTomada,
} from '../../components/ModaisAlerta';
import { Icone } from '../../components/Icone';

function emDias(dias: number): string {
  return new Date(Date.now() + dias * 864e5).toISOString().split('T')[0] as string;
}

const ALERTAS_FALSOS: Alerta[] = [
  {
    id_alerta: 1, medicamento: 'Dipirona 500mg', score: 85, tipo: 'vencimento',
    recomendacao: 'Considere devolução ao distribuidor', valor_financeiro_risco: 2040,
    sobra_projetada: 240, status: 'ABERTO', quantidade: 240, validade: emDias(12),
    sindrome_ajuste: 'Dengue',
  },
  {
    id_alerta: 2, medicamento: 'Amoxicilina 250mg', score: 52, tipo: 'discrepancia',
    recomendacao: 'Monitorar', valor_financeiro_risco: 450,
    sobra_projetada: 30, status: 'ABERTO', quantidade: 30, validade: emDias(45),
  },
  {
    id_alerta: 4, medicamento: 'Vitamina D 50.000 UI', score: 15, tipo: 'esquecido',
    recomendacao: 'Este produto ocupa espaço há 14 meses sem movimentação registrada.',
    valor_financeiro_risco: 0, sobra_projetada: 0, status: 'ABERTO', quantidade: 60,
    validade: emDias(200), meses_parado: 14,
  },
];

/** Corte entre recuperável e perda provável, em dias de prazo restante. */
const PRAZO_ACAO_DIAS = 7;

export function AlertasScreen() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [resolvendo, setResolvendo] = useState<Alerta | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    void carregar();
  }, []);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    if (DADOS_FALSOS.alertas) {
      setAlertas(ALERTAS_FALSOS);
      setCarregando(false);
      return;
    }
    try {
      const r = await get<RespostaAlertas>('/buscar_alertas');
      setAlertas([...r.alertas].sort((a, b) => b.score - a.score));
    } catch {
      setErro('Sem conexão. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  // --- Nível 1: painel de impacto financeiro -----------------------------
  // Composição de tela sobre dado que já existe (valor_financeiro_risco).
  // O corte entre recuperável e perda provável é por prazo restante e fica
  // declarado na própria tela — categoria financeira sem critério visível
  // seria o mesmo tipo de overclaim que o projeto evita em outros pontos.
  const financeiro = useMemo(() => {
    let emRisco = 0;
    let recuperavel = 0;
    let perdaProvavel = 0;
    let criticos = 0;
    for (const a of alertas) {
      const v = a.valor_financeiro_risco ?? 0;
      emRisco += v;
      if (calcularDiasRestantes(a.validade) > PRAZO_ACAO_DIAS) recuperavel += v;
      else perdaProvavel += v;
      if (a.score >= 70) criticos += 1;
    }
    return { emRisco, recuperavel, perdaProvavel, criticos };
  }, [alertas]);

  const maisUrgentes = useMemo(
    () => [...alertas].sort((a, b) => b.score - a.score).slice(0, 3),
    [alertas],
  );

  async function confirmarAcao(acao: AcaoTomada) {
    const alvo = resolvendo;
    setResolvendo(null);
    if (!alvo) return;
    if (DADOS_FALSOS.alertas) {
      setAlertas((l) => l.filter((a) => a.id_alerta !== alvo.id_alerta));
      setAviso('(teste) Alerta resolvido: ' + acao);
      return;
    }
    try {
      await post('/resolver_alerta', { id_alerta: alvo.id_alerta, acao_tomada: acao });
      setAlertas((l) => l.filter((a) => a.id_alerta !== alvo.id_alerta));
      setAviso('Alerta resolvido.');
    } catch {
      setAviso('Sem conexão. Tente novamente.');
    }
  }

  /**
   * Ideia 15 — irmão de confirmarAcao para o caminho de discrepância.
   *
   * Manda motivo_discrepancia SEM acao_tomada de propósito: registrar uma
   * ação que não foi tomada só para satisfazer o payload gravaria história
   * falsa no histórico do lote. A Function exige um dos dois campos, não
   * os dois, e dá precedência ao motivo quando ele vem.
   */
  async function confirmarDiscrepancia(motivo: string) {
    const alvo = resolvendo;
    setResolvendo(null);
    if (!alvo) return;
    if (DADOS_FALSOS.alertas) {
      setAlertas((l) => l.filter((a) => a.id_alerta !== alvo.id_alerta));
      setAviso('(teste) Discrepância registrada: ' + motivo);
      return;
    }
    try {
      await post('/resolver_alerta', {
        id_alerta: alvo.id_alerta,
        motivo_discrepancia: motivo,
      });
      setAlertas((l) => l.filter((a) => a.id_alerta !== alvo.id_alerta));
      setAviso('Discrepância registrada.');
    } catch {
      setAviso('Sem conexão. Tente novamente.');
    }
  }

  if (carregando) return <Carregando rotulo="Carregando alertas" />;

  return (
    <>
      {DADOS_FALSOS.alertas && <TarjaModoTeste />}
      <TituloTela>Alertas</TituloTela>

      {erro && (
        <p role="alert" className="fc-erro" style={{ marginBottom: 16 }}>
          <Icone nome="triangle-alert" tamanho={16} />
          <span>{erro}</span>
        </p>
      )}
      {aviso && (
        <p role="status" aria-live="polite" style={{ color: cores.neutro }}>{aviso}</p>
      )}

      {alertas.length === 0 ? (
        <EstadoVazio>Nenhum alerta no momento. Seu estoque está controlado.</EstadoVazio>
      ) : (
        <>
          <DailyBrief
            criticos={financeiro.criticos}
            total={alertas.length}
            emRisco={financeiro.emRisco}
            urgentes={maisUrgentes}
          />

          <section
            aria-label="Impacto financeiro"
            style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}
          >
            <CartaoMetrica
              titulo="Valor total em risco"
              valor={formatarReais(financeiro.emRisco)}
              cor={cores.risco}
              icone="triangle-alert"
            />
            <CartaoMetrica
              titulo="Ainda recuperável"
              valor={formatarReais(financeiro.recuperavel)}
              cor={cores.ok}
              icone="refresh-cw"
              aviso={'Mais de ' + PRAZO_ACAO_DIAS + ' dias de prazo'}
            />
            <CartaoMetrica
              titulo="Perda provável"
              valor={formatarReais(financeiro.perdaProvavel)}
              cor={cores.atencao}
              icone="clock"
              aviso={PRAZO_ACAO_DIAS + ' dias ou menos'}
            />
            <CartaoMetrica
              titulo="Itens críticos"
              valor={String(financeiro.criticos)}
              cor={cores.primary}
              icone="ponto"
            />
          </section>
          <p style={{ fontSize: 11, color: cores.neutro, margin: '0 0 24px' }}>
            Recuperável e perda provável são um corte por prazo restante sobre o
            valor em risco informado pelo sistema, não uma projeção contábil.
          </p>

          <Tabela
            colunas={['Medicamento', 'Prioridade', 'Prazo', 'Prejuízo projetado', 'Ação recomendada']}
          >
            {alertas.map((a) => (
              <LinhaAlerta key={a.id_alerta} alerta={a} onResolver={() => setResolvendo(a)} />
            ))}
          </Tabela>
        </>
      )}

      {resolvendo && resolvendo.tipo === 'discrepancia' && (
        <ModalMotivoDiscrepancia
          onFechar={() => setResolvendo(null)}
          onEscolher={(motivo) => void confirmarDiscrepancia(motivo)}
        />
      )}
      {resolvendo && resolvendo.tipo !== 'discrepancia' && (
        <ModalAcaoPadrao
          medicamento={resolvendo.medicamento}
          onFechar={() => setResolvendo(null)}
          onEscolher={(acao) => void confirmarAcao(acao)}
        />
      )}
    </>
  );
}

/**
 * Nível 1 — Briefing diário.
 *
 * Aparece antes de qualquer tabela: quantas ações prioritárias existem
 * hoje, o impacto financeiro total e as mais urgentes em destaque, em vez
 * de um painel genérico para o farmacêutico interpretar sozinho.
 */
function DailyBrief({ criticos, total, emRisco, urgentes }: {
  criticos: number;
  total: number;
  emRisco: number;
  urgentes: Alerta[];
}) {
  return (
    <section
      aria-label="Briefing do dia"
      style={{ background: cores.primaryLight, borderRadius: 12, padding: 20, marginBottom: 20 }}
    >
      <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Seu dia no FlemingCore</h2>
      <p style={{ margin: '0 0 12px', fontSize: 15 }}>
        {criticos > 0 ? (
          <>
            <strong>{criticos}</strong>{' '}
            {criticos === 1 ? 'ação prioritária' : 'ações prioritárias'} hoje
          </>
        ) : (
          <>Nenhuma ação crítica hoje</>
        )}
        {' · '}
        {total} {total === 1 ? 'alerta aberto' : 'alertas abertos'}
        {' · '}
        <strong>{formatarReais(emRisco)}</strong> em risco
      </p>
      <ol style={{ margin: 0, paddingLeft: 20 }}>
        {urgentes.map((a) => (
          <li key={a.id_alerta} style={{ marginBottom: 4, fontSize: 14 }}>
            <strong>{a.medicamento}</strong> — {prioridadePorScore(a.score).rotulo}.{' '}
            {a.recomendacao}
          </li>
        ))}
      </ol>
    </section>
  );
}

function LinhaAlerta({ alerta, onResolver }: { alerta: Alerta; onResolver: () => void }) {
  const dias = calcularDiasRestantes(alerta.validade);
  const { rotulo, nivel } = prioridadePorScore(alerta.score);
  const corPrioridade =
    nivel === 'critica' ? cores.risco : nivel === 'atencao' ? cores.atencao : cores.ok;

  const descricaoAcao =
    'Ação recomendada para ' + alerta.medicamento + ': ' + alerta.recomendacao +
    '. ' + rotulo + ', ' + dias + ' dias restantes.';

  return (
    <tr style={{ borderBottom: '1px solid ' + cores.borda }}>
      <td style={{ padding: 12 }}>
        {alerta.medicamento}
        {alerta.sindrome_ajuste && (
          <span
            title={'Score ajustado por sazonalidade regional: ' + alerta.sindrome_ajuste}
            aria-label={'Score ajustado por sazonalidade regional: ' + alerta.sindrome_ajuste}
            style={{ marginLeft: 6, fontSize: 12 }}
          >
            <Icone nome="trending-up" tamanho={14} />
          </span>
        )}
      </td>

      {/* Nível 1 — score comunicado como prioridade; o número continua
          disponível como detalhe secundário, não some. */}
      <td style={{ padding: 12 }}>
        <span style={{ color: corPrioridade, fontWeight: 600 }}>{rotulo}</span>
        <span style={{ color: cores.neutro, fontSize: 12, marginLeft: 6 }}>
          ({alerta.score.toFixed(0)})
        </span>
      </td>

      <td style={{ padding: 12 }}>
        {alerta.tipo === 'esquecido'
          ? (alerta.meses_parado ?? '?') + ' meses parado'
          : dias + ' dias'}
      </td>

      <td style={{ padding: 12, color: cores.risco, fontWeight: 600 }}>
        {alerta.score >= 40 ? formatarReais(alerta.valor_financeiro_risco) : '—'}
      </td>

      {/* Nível 1 — a recomendação vira o elemento principal da linha: um
          botão de ação, não mais uma coluna de texto secundário. */}
      <td style={{ padding: 12 }}>
        <button
          type="button"
          onClick={onResolver}
          aria-label={descricaoAcao}
          style={{
            padding: '10px 14px', border: 'none', borderRadius: 6, cursor: 'pointer',
            background: cores.primary, color: cores.sobreAcento, fontSize: 13,
            textAlign: 'left', maxWidth: 320,
          }}
        >
          <span style={{ display: 'block', fontSize: 10, opacity: 0.85 }}>
            Ação recomendada
          </span>
          {alerta.recomendacao}
        </button>
      </td>
    </tr>
  );
}
