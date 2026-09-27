import { DADOS_FALSOS } from '../../config/env';
import {
  exibirOuInsuficiente, TEXTO_DADOS_INSUFICIENTES, useDashboardEurofarma,
} from '../../services/useDashboardEurofarma';
import { formatarNumero, formatarReais } from '../../utils/formato';
import { cores } from '../../theme/colors';
import {
  Carregando, CartaoMetrica, EstadoVazio, TarjaModoTeste, TituloTela,
} from '../../components/Comuns';

const ATALHOS = [
  { id: 'termometro', label: 'Termômetro de Giro', icone: 'thermometer' },
  { id: 'vulnerabilidade', label: 'Vulnerabilidade IVF', icone: 'triangle-alert' },
  { id: 'impacto_social', label: 'Impacto Social', icone: 'user-round' },
  { id: 'conformidade', label: 'Conformidade', icone: 'shield-check' },
] as const;

export function DashboardEurofarmaScreen({ onNavegar }: { onNavegar: (id: string) => void }) {
  const { dados, carregando, erro } = useDashboardEurofarma(DADOS_FALSOS.dashboardEurofarma);

  if (carregando) return <Carregando rotulo="Carregando dashboard" />;
  if (erro || !dados) return <EstadoVazio>{erro ?? 'Erro ao carregar.'}</EstadoVazio>;

  const insuficiente = !dados.dados_suficientes;

  return (
    <>
      {DADOS_FALSOS.dashboardEurofarma && <TarjaModoTeste />}
      <TituloTela>Dashboard Eurofarma</TituloTela>

      <nav aria-label="Acesso rápido" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {ATALHOS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onNavegar(a.id)}
            style={{
              flex: '1 1 180px', minWidth: 160, padding: 20, borderRadius: 12,
              border: '1px solid ' + cores.borda, background: cores.superficie,
              cursor: 'pointer', fontSize: 14,
            }}
          >
            <div aria-hidden="true" style={{ fontSize: 26 }}>{a.icone}</div>
            <div style={{ marginTop: 8 }}>{a.label}</div>
          </button>
        ))}
      </nav>

      {/*
        Item 29 — piso mínimo de agregação.
        Quando dados_suficientes é false, os numéricos vêm null e a tela
        precisa dizer isso explicitamente. Exibir "R$ 0,00" aqui seria
        indistinguível de uma rede que de fato não desperdiçou nada.
      */}
      {insuficiente && (
        <p role="note" style={{
          background: cores.aviso, color: cores.atencao, padding: 12,
          borderRadius: 8, fontSize: 13, marginBottom: 16,
        }}>
          Os agregados da rede não são exibidos porque o número de farmácias
          contribuindo está abaixo do piso mínimo de agregação. Isso protege a
          identificação de farmácia individual — não indica ausência de
          resultado.
        </p>
      )}

      <section aria-label="Indicadores da rede" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <CartaoMetrica
          titulo="Desperdício evitado (rede)"
          valor={exibirOuInsuficiente(dados.total_desperdicio_evitado, formatarReais)}
          cor={insuficiente ? cores.neutro : cores.ok}
          icone="circle-dollar-sign"
        />
        <CartaoMetrica
          titulo="Medicamentos preservados"
          valor={exibirOuInsuficiente(dados.total_medicamentos_preservados, formatarNumero)}
          cor={insuficiente ? cores.neutro : cores.primary}
          icone="package"
        />
        <CartaoMetrica
          titulo="IVF médio da rede"
          valor={exibirOuInsuficiente(dados.ivf_medio, (v) => v.toFixed(2))}
          cor={insuficiente ? cores.neutro : cores.atencao}
          icone="chart-column"
        />
        <CartaoMetrica
          titulo="Farmácias Anvisa-Ready"
          valor={
            dados.farmacias_anvisa_ready == null
              ? TEXTO_DADOS_INSUFICIENTES
              : dados.farmacias_anvisa_ready + ' de ' + dados.total_farmacias
          }
          cor={insuficiente ? cores.neutro : cores.eurofarmaAccent}
          icone="shield-check"
        />
      </section>

      <p style={{ fontSize: 12, color: cores.neutro, marginTop: 16 }}>
        Total de farmácias na rede: <strong>{dados.total_farmacias}</strong>. Dados
        sempre agregados — nenhuma farmácia individual é identificada.
      </p>
    </>
  );
}
