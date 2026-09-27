import { DADOS_FALSOS } from '../../config/env';
import { useDashboardEurofarma } from '../../services/useDashboardEurofarma';
import { cores } from '../../theme/colors';
import {
  Carregando, EstadoVazio, TarjaModoTeste, TituloTela,
} from '../../components/Comuns';

/** Meta de conformidade da rede. */
const META = 0.8;

/**
 * Conformidade.
 *
 * Correção de bug (Seção 6): no Flutter esta tela nunca foi conectada ao
 * backend — tinha 14 e 18 escritos direto no código. Aqui os dois números
 * vêm de buscar_dashboard_eurofarma (farmacias_anvisa_ready e
 * total_farmacias), que já os retorna.
 */
export function ConformidadeScreen() {
  const { dados, carregando, erro } = useDashboardEurofarma(DADOS_FALSOS.conformidade);

  if (carregando) return <Carregando rotulo="Carregando conformidade" />;
  if (erro || !dados) return <EstadoVazio>{erro ?? 'Erro ao carregar.'}</EstadoVazio>;

  const prontas = dados.farmacias_anvisa_ready;
  const total = dados.total_farmacias;

  // Item 29 — sem piso mínimo atingido, o backend manda null. Exibir 0%
  // aqui sugeriria que nenhuma farmácia está em conformidade, o que é
  // afirmação diferente de "não há dado suficiente para calcular".
  if (prontas == null || total === 0) {
    return (
      <>
        {DADOS_FALSOS.conformidade && <TarjaModoTeste />}
        <TituloTela>Conformidade</TituloTela>
        <EstadoVazio>
          Dados insuficientes para exibição — o número de farmácias
          contribuindo está abaixo do piso mínimo de agregação.
        </EstadoVazio>
      </>
    );
  }

  const percentual = prontas / total;
  const pct = Math.round(percentual * 100);
  const acimaDaMeta = percentual >= META;
  const cor = acimaDaMeta ? cores.ok : cores.atencao;

  // Donut em SVG: circunferência = 2πr, e o traço preenchido é a fração.
  const raio = 90;
  const circunferencia = 2 * Math.PI * raio;

  return (
    <>
      {DADOS_FALSOS.conformidade && <TarjaModoTeste />}
      <TituloTela>Conformidade</TituloTela>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 32 }}>
        <svg
          width="220" height="220" viewBox="0 0 220 220"
          role="img"
          aria-label={pct + ' por cento das farmácias em conformidade Anvisa-Ready. ' +
            (acimaDaMeta ? 'Acima da meta de 80 por cento.' : 'Abaixo da meta de 80 por cento.')}
        >
          <circle cx="110" cy="110" r={raio} fill="none" stroke="var(--trilho)" strokeWidth="16" />
          <circle
            cx="110" cy="110" r={raio} fill="none" stroke={cor} strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={circunferencia}
            strokeDashoffset={circunferencia * (1 - percentual)}
            transform="rotate(-90 110 110)"
          />
          <text x="110" y="105" textAnchor="middle" fontSize="36" fontWeight="700" fill="var(--texto)">
            {pct}%
          </text>
          <text x="110" y="132" textAnchor="middle" fontSize="14" fill={cores.neutro}>
            Anvisa-Ready
          </text>
        </svg>

        <p style={{ fontSize: 16, marginTop: 24 }}>
          {prontas} de {total} farmácias em conformidade
        </p>
        <p style={{ color: cor, fontWeight: 700, marginTop: 4 }}>
          {acimaDaMeta ? 'Acima da meta de 80%' : 'Abaixo da meta de 80% — atenção necessária'}
        </p>
      </div>
    </>
  );
}
