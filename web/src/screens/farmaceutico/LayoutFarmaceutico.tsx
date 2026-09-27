import { useCallback, useEffect, useState } from 'react';
import { Sidebar, type ItemNav } from '../../components/Sidebar';
import { cores } from '../../theme/colors';
import { DADOS_FALSOS } from '../../config/env';
import { get } from '../../services/httpInterceptor';
import { AlertasScreen } from './AlertasScreen';
import { CadastrarLoteScreen } from './CadastrarLoteScreen';
import { HistoricoScreen } from './HistoricoScreen';
import { DevolucoesScreen } from './DevolucoesScreen';
import { FloraScreen } from './FloraScreen';
import { WrappedScreen } from './WrappedScreen';
import { RastreabilidadeScreen } from './RastreabilidadeScreen';
import { RedeFlemingCoreScreen } from './RedeFlemingCoreScreen';
import { PrioridadeDispensaScreen } from './PrioridadeDispensaScreen';
import { ElegibilidadeScreen } from './ElegibilidadeScreen';
import { WatchlistScreen } from './WatchlistScreen';

const ITENS: ItemNav[] = [
  { id: 'alertas', label: 'Alertas', icone: 'bell' },
  { id: 'cadastrar_lote', label: 'Cadastrar Lote', icone: 'package' },
  { id: 'historico', label: 'Histórico', icone: 'history' },
  { id: 'devolucoes', label: 'Devoluções', icone: 'undo-2' },
  { id: 'flora', label: 'Flora', icone: 'message-circle' },
  { id: 'wrapped', label: 'Seu Ano', icone: 'sparkles' },
  { id: 'rastreabilidade', label: 'Rastreabilidade', icone: 'search' },
  { id: 'rede', label: 'Rede FlemingCore', icone: 'network' },

  // Nivel 2 — os tres ficam juntos no fim da lista, com icones da mesma
  // familia (calendario / reciclagem / alvo). A Sidebar e compartilhada
  // com o layout Eurofarma e nao tem conceito de secao, entao o
  // agrupamento e por vizinhanca e coerencia de icone, nao por cabecalho.
  { id: 'prioridade_dispensa', label: 'Prioridade de Dispensa', icone: 'calendar' },
  { id: 'elegibilidade', label: 'Elegibilidade', icone: 'refresh-cw' },
  { id: 'watchlist', label: 'Watchlist de Demanda', icone: 'target' },
];

export function LayoutFarmaceutico({ onSair }: { onSair: () => void }) {
  const [paginaAtiva, setPaginaAtiva] = useState('alertas');
  const [pendentes, setPendentes] = useState(0);

  // Ideia 06 — a contagem vive no layout porque a sidebar e a tela de
  // Devoluções são irmãs: nenhuma enxerga o estado da outra sem um ponto
  // em comum. Mesma razão que levou o estado a subir no Flutter.
  const atualizarContagem = useCallback(async () => {
    if (DADOS_FALSOS.devolucoes) {
      setPendentes(1); // mesmos registros fictícios da tela de Devoluções
      return;
    }
    try {
      const r = await get<{ solicitacoes: unknown[] }>(
        '/buscar_solicitacoes_devolucao?status=PENDENTE',
      );
      setPendentes(r.solicitacoes.length);
    } catch {
      // Falha silenciosa — badge fica no último valor conhecido.
    }
  }, []);

  useEffect(() => {
    void atualizarContagem();
  }, [atualizarContagem]);

  const itens = ITENS.map((i) =>
    i.id === 'devolucoes' ? { ...i, badge: pendentes } : i,
  );

  function renderizarPagina() {
    switch (paginaAtiva) {
      case 'alertas': return <AlertasScreen />;
      case 'cadastrar_lote': return <CadastrarLoteScreen />;
      case 'historico': return <HistoricoScreen />;
      case 'devolucoes':
        return <DevolucoesScreen onSolicitacaoEnviada={atualizarContagem} />;
      case 'flora': return <FloraScreen />;
      case 'wrapped': return <WrappedScreen />;
      case 'rastreabilidade': return <RastreabilidadeScreen />;
      case 'rede': return <RedeFlemingCoreScreen />;
      case 'prioridade_dispensa': return <PrioridadeDispensaScreen />;
      case 'elegibilidade': return <ElegibilidadeScreen />;
      case 'watchlist': return <WatchlistScreen />;
      default: return <AlertasScreen />;
    }
  }

  const rotuloAtivo = ITENS.find((i) => i.id === paginaAtiva)?.label ?? 'Alertas';

  return (
    <div
      style={{
        display: 'flex', height: '100vh', overflow: 'hidden',
        ['--acento-area' as string]: cores.primary,
      } as React.CSSProperties}
    >
      <Sidebar
        itens={itens}
        paginaAtiva={paginaAtiva}
        onNavegar={setPaginaAtiva}
        nomeUsuario="Farmacêutico"
        acento={cores.primary}
        onSair={onSair}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header className="fc-topo">
          <div className="fc-topo__contexto">
            <span className="fc-topo__area">Farmacêutico</span>
            <span aria-hidden="true">›</span>
            <span style={{ color: 'var(--texto)', fontWeight: 500 }}>{rotuloAtivo}</span>
          </div>
          <span style={{ fontSize: 12.5, color: 'var(--texto-fraco)' }}>
            {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
        </header>
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {/* key na página: a entrada suave roda de novo a cada troca de tela. */}
          <div className="fc-conteudo fc-entra" key={paginaAtiva}>
            {renderizarPagina()}
          </div>
        </main>
      </div>
    </div>
  );
}
