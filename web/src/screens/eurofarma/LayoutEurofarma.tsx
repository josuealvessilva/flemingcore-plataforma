import { useState } from 'react';
import { Sidebar, type ItemNav } from '../../components/Sidebar';
import { cores } from '../../theme/colors';
import { DashboardEurofarmaScreen } from './DashboardEurofarmaScreen';
import { TermometroScreen } from './TermometroScreen';
import { VulnerabilidadeScreen } from './VulnerabilidadeScreen';
import { ImpactoSocialScreen } from './ImpactoSocialScreen';
import { ConformidadeScreen } from './ConformidadeScreen';
import { AlocacaoRegionalScreen } from './AlocacaoRegionalScreen';

const ITENS: ItemNav[] = [
  { id: 'dashboard', label: 'Dashboard', icone: 'chart-column' },
  { id: 'termometro', label: 'Termômetro de Giro', icone: 'thermometer' },
  { id: 'vulnerabilidade', label: 'Vulnerabilidade Farmacêutica', icone: 'triangle-alert' },
  { id: 'impacto_social', label: 'Impacto Social', icone: 'user-round' },
  { id: 'conformidade', label: 'Conformidade', icone: 'shield-check' },
  { id: 'alocacao', label: 'Alocação Regional', icone: 'map' },
];

export function LayoutEurofarma({ onSair }: { onSair: () => void }) {
  const [paginaAtiva, setPaginaAtiva] = useState('dashboard');

  function renderizarPagina() {
    switch (paginaAtiva) {
      case 'dashboard':
        return <DashboardEurofarmaScreen onNavegar={setPaginaAtiva} />;
      case 'termometro': return <TermometroScreen />;
      case 'vulnerabilidade': return <VulnerabilidadeScreen />;
      case 'impacto_social': return <ImpactoSocialScreen />;
      case 'conformidade': return <ConformidadeScreen />;
      case 'alocacao': return <AlocacaoRegionalScreen />;
      default:
        return <DashboardEurofarmaScreen onNavegar={setPaginaAtiva} />;
    }
  }

  const rotuloAtivo = ITENS.find((i) => i.id === paginaAtiva)?.label ?? 'Dashboard';

  return (
    <div
      style={{
        display: 'flex', height: '100vh', overflow: 'hidden',
        ['--acento-area' as string]: cores.eurofarmaAccent,
      } as React.CSSProperties}
    >
      <Sidebar
        itens={ITENS}
        paginaAtiva={paginaAtiva}
        onNavegar={setPaginaAtiva}
        nomeUsuario="Eurofarma"
        acento={cores.eurofarmaAccent}
        onSair={onSair}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header className="fc-topo">
          <div className="fc-topo__contexto">
            <span className="fc-topo__area">Eurofarma</span>
            <span aria-hidden="true">›</span>
            <span style={{ color: 'var(--texto)', fontWeight: 500 }}>{rotuloAtivo}</span>
          </div>
          <span style={{ fontSize: 12.5, color: 'var(--texto-fraco)' }}>
            {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
        </header>
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <div className="fc-conteudo fc-entra" key={paginaAtiva}>
            {renderizarPagina()}
          </div>
        </main>
      </div>
    </div>
  );
}
