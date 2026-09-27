import { useCallback, useEffect, useState } from 'react';
import { DADOS_FALSOS } from '../../config/env';
import { get } from '../../services/httpInterceptor';
import type { ItemHistorico } from '../../services/tipos';
import { cores } from '../../theme/colors';
import {
  Carregando, EstadoVazio, Tabela, TarjaModoTeste, TituloTela,
} from '../../components/Comuns';
import { Icone } from '../../components/Icone';

const HISTORICO_FALSO: ItemHistorico[] = [
  {
    farmaceutico: 'Ana Souza', tipo_acao: 'cadastro_lote',
    descricao: 'Cadastrou lote de Dipirona 500mg',
    data_hora: '07/07/2026 14:32', sistema_origem: 'PharmaSys (demo)',
  },
  {
    farmaceutico: 'Carlos Lima', tipo_acao: 'alerta_resolvido',
    descricao: 'Resolveu alerta de Amoxicilina 250mg — promoção',
    data_hora: '06/07/2026 09:15',
  },
  {
    farmaceutico: 'Ana Souza', tipo_acao: 'pergunta_eva',
    descricao: 'Perguntou sobre estoque de vacinas',
    data_hora: '05/07/2026 17:48',
  },
];

/**
 * Rótulo visível do tipo de ação.
 *
 * 'pergunta_eva' é o valor gravado no banco e continua como está — é
 * identificador interno. O que o usuário lê vira "Flora" (Seção 6).
 */
function traduzirTipo(tipo: string): string {
  switch (tipo) {
    case 'cadastro_lote': return 'Cadastrou Lote';
    case 'alerta_resolvido': return 'Resolveu Alerta';
    case 'pergunta_eva': return 'Perguntou à Flora';
    default: return tipo;
  }
}

const PERIODOS = [7, 30, 90] as const;

export function HistoricoScreen() {
  const [dias, setDias] = useState<number>(30);
  const [tipoAcao, setTipoAcao] = useState<string>('');
  const [itens, setItens] = useState<ItemHistorico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    if (DADOS_FALSOS.historico) {
      setItens(tipoAcao ? HISTORICO_FALSO.filter((h) => h.tipo_acao === tipoAcao) : HISTORICO_FALSO);
      setCarregando(false);
      return;
    }
    try {
      let url = '/buscar_historico?dias=' + dias;
      if (tipoAcao) url += '&tipo_acao=' + tipoAcao;
      const r = await get<{ historico: ItemHistorico[] }>(url);
      setItens(r.historico ?? []);
    } catch {
      setItens([]);
      setErro('Sem conexão. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [dias, tipoAcao]);

  useEffect(() => { void carregar(); }, [carregar]);

  /**
   * Exportação do relatório ANVISA.
   *
   * O Flutter montava o PDF com os pacotes pdf/printing. Aqui usamos a
   * impressão do próprio sistema com folha de estilo de impressão: o
   * "Salvar como PDF" do Windows gera um PDF real, sem trazer uma
   * biblioteca de geração de PDF só para isso. Funciona igual no Electron
   * e no navegador.
   */
  function exportarRelatorio() {
    window.print();
  }

  return (
    <>
      {(DADOS_FALSOS.historico || DADOS_FALSOS.relatorioAuditoria) && (
        <TarjaModoTeste texto="Modo de teste — histórico e/ou relatório com dados fictícios (Functions ainda não deployadas)" />
      )}
      <TituloTela>Histórico</TituloTela>

      <div className="sem-impressao" style={{
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16,
      }}>
        {PERIODOS.map((p) => (
          <button
            key={p} type="button" onClick={() => setDias(p)}
            aria-pressed={dias === p}
            style={{
              padding: '8px 14px', border: 'none', borderRadius: 6, cursor: 'pointer',
              color: cores.sobreAcento, background: dias === p ? cores.primary : cores.desabilitado,
            }}
          >
            {p} dias
          </button>
        ))}

        <label htmlFor="tipo-acao" style={{ marginLeft: 8, fontSize: 13 }}>Tipo</label>
        <select
          id="tipo-acao" value={tipoAcao} onChange={(e) => setTipoAcao(e.target.value)}
          style={{ padding: 8, borderRadius: 4, border: '1px solid ' + cores.borda }}
        >
          <option value="">Todos</option>
          <option value="cadastro_lote">Cadastrou Lote</option>
          <option value="alerta_resolvido">Resolveu Alerta</option>
          <option value="pergunta_eva">Perguntou à Flora</option>
        </select>

        <button
          type="button" onClick={exportarRelatorio}
          style={{
            marginLeft: 'auto', padding: '10px 16px', borderRadius: 6, cursor: 'pointer',
            border: '1px solid ' + cores.primary, background: cores.superficie, color: cores.primaryDark,
          }}
        >
          Exportar Relatório ANVISA
        </button>
      </div>

      {erro && (
        <p role="alert" className="fc-erro" style={{ marginBottom: 16 }}>
          <Icone nome="triangle-alert" tamanho={16} />
          <span>{erro}</span>
        </p>
      )}

      {carregando ? (
        <Carregando rotulo="Carregando histórico" />
      ) : itens.length === 0 ? (
        <EstadoVazio>Nenhuma atividade encontrada para os filtros selecionados.</EstadoVazio>
      ) : (
        <Tabela colunas={['Farmacêutico', 'Tipo de Ação', 'Descrição', 'Data e Hora', 'Origem']}>
          {itens.map((h, i) => (
            <tr key={i} style={{ borderBottom: '1px solid ' + cores.borda }}>
              <td style={{ padding: 12 }}>{h.farmaceutico || '—'}</td>
              <td style={{ padding: 12 }}>{traduzirTipo(h.tipo_acao)}</td>
              <td style={{ padding: 12 }}>{h.descricao}</td>
              <td style={{ padding: 12 }}>{h.data_hora}</td>
              <td style={{ padding: 12 }}><ChipOrigem item={h} /></td>
            </tr>
          ))}
        </Tabela>
      )}
    </>
  );
}

/** Ideia 24 — origem só faz sentido em linhas de cadastro de lote. */
function ChipOrigem({ item }: { item: ItemHistorico }) {
  if (item.tipo_acao !== 'cadastro_lote') return <span>—</span>;
  const origem = item.sistema_origem;
  const veioDeIntegracao = Boolean(origem) && origem !== 'Manual';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 12, fontSize: 11,
      background: veioDeIntegracao ? cores.primaryLight : cores.neutroClaro,
      color: veioDeIntegracao ? cores.primaryDark : cores.neutro,
    }}>
      <Icone nome={veioDeIntegracao ? 'refresh-cw' : 'pencil'} tamanho={12} />{' '}
      {veioDeIntegracao ? origem : 'Manual'}
    </span>
  );
}
