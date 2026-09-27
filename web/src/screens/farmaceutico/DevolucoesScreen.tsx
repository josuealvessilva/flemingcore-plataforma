import { useCallback, useEffect, useState } from 'react';
import { DADOS_FALSOS } from '../../config/env';
import { get, post } from '../../services/httpInterceptor';
import type { SolicitacaoDevolucao } from '../../services/tipos';
import { cores } from '../../theme/colors';
import {
  Carregando, EstadoVazio, Tabela, TarjaModoTeste, TituloTela,
} from '../../components/Comuns';

const FALSAS: SolicitacaoDevolucao[] = [
  {
    id_solicitacao: 1, medicamento: 'Dipirona 500mg', lote: 'L2024-001',
    quantidade: 45, validade: '20/07/2026', data_solicitacao: '10/07/2026',
    status: 'PENDENTE',
  },
  {
    id_solicitacao: 2, medicamento: 'Amoxicilina 250mg', lote: 'L2024-018',
    quantidade: 30, validade: '05/08/2026', data_solicitacao: '08/07/2026',
    status: 'ENVIADA',
  },
];

/**
 * Devoluções.
 *
 * As Functions buscar_solicitacoes_devolucao e marcar_solicitacao_enviada
 * ainda não existem no backend (verificado no main.py). O endpoint real já
 * está cabeado abaixo — basta virar DADOS_FALSOS.devolucoes para false
 * quando forem implementadas.
 */
export function DevolucoesScreen({ onSolicitacaoEnviada }: {
  onSolicitacaoEnviada: () => void;
}) {
  const [itens, setItens] = useState<SolicitacaoDevolucao[]>([]);
  const [filtro, setFiltro] = useState<'' | 'PENDENTE' | 'ENVIADA'>('');
  const [carregando, setCarregando] = useState(true);
  const [locais, setLocais] = useState<SolicitacaoDevolucao[]>(FALSAS);

  const carregar = useCallback(async () => {
    setCarregando(true);
    if (DADOS_FALSOS.devolucoes) {
      setItens(filtro ? locais.filter((s) => s.status === filtro) : locais);
      setCarregando(false);
      return;
    }
    try {
      let url = '/buscar_solicitacoes_devolucao';
      if (filtro) url += '?status=' + filtro;
      const r = await get<{ solicitacoes: SolicitacaoDevolucao[] }>(url);
      setItens(r.solicitacoes ?? []);
    } catch {
      setItens([]);
    } finally {
      setCarregando(false);
    }
  }, [filtro, locais]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function marcarEnviada(id: number) {
    if (DADOS_FALSOS.devolucoes) {
      setLocais((l) =>
        l.map((s) => (s.id_solicitacao === id ? { ...s, status: 'ENVIADA' as const } : s)),
      );
      onSolicitacaoEnviada();
      return;
    }
    try {
      await post('/marcar_solicitacao_enviada', { id_solicitacao: id });
      await carregar();
      onSolicitacaoEnviada();
    } catch {
      // Sem conexão — a lista continua no último estado conhecido.
    }
  }

  return (
    <>
      {DADOS_FALSOS.devolucoes && (
        <TarjaModoTeste texto="Modo de teste — dados fictícios (Functions ainda não implementadas no backend)" />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <TituloTela>Devoluções</TituloTela>
        <label htmlFor="filtro-status" style={{ marginLeft: 'auto', fontSize: 13 }}>Status</label>
        <select
          id="filtro-status"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as '' | 'PENDENTE' | 'ENVIADA')}
          style={{ padding: 8, borderRadius: 4, border: '1px solid ' + cores.borda }}
        >
          <option value="">Todos</option>
          <option value="PENDENTE">Pendente</option>
          <option value="ENVIADA">Enviada</option>
        </select>
      </div>

      {carregando ? (
        <Carregando rotulo="Carregando solicitações" />
      ) : itens.length === 0 ? (
        <EstadoVazio>Nenhuma solicitação encontrada.</EstadoVazio>
      ) : (
        <Tabela colunas={['Medicamento', 'Lote', 'Quantidade', 'Validade', 'Status', 'Ação']}>
          {itens.map((s) => (
            <tr key={s.id_solicitacao} style={{ borderBottom: '1px solid ' + cores.borda }}>
              <td style={{ padding: 12 }}>{s.medicamento}</td>
              <td style={{ padding: 12 }}>{s.lote}</td>
              <td style={{ padding: 12 }}>{s.quantidade}</td>
              <td style={{ padding: 12 }}>{s.validade}</td>
              <td style={{ padding: 12 }}>
                <span style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: 12,
                  background: s.status === 'PENDENTE' ? cores.aviso : cores.primaryLight,
                  color: s.status === 'PENDENTE' ? cores.atencao : cores.primaryDark,
                }}>
                  {s.status}
                </span>
              </td>
              <td style={{ padding: 12 }}>
                {s.status === 'PENDENTE' ? (
                  <button
                    type="button"
                    onClick={() => void marcarEnviada(s.id_solicitacao)}
                    aria-label={'Marcar solicitação de ' + s.medicamento + ' como enviada'}
                    style={{
                      padding: '8px 12px', border: 'none', borderRadius: 6,
                      cursor: 'pointer', background: cores.primary, color: cores.sobreAcento, fontSize: 13,
                    }}
                  >
                    Marcar Enviada
                  </button>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </Tabela>
      )}
    </>
  );
}
