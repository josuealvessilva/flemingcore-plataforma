import { DADOS_FALSOS } from '../../config/env';
import { useDashboardEurofarma } from '../../services/useDashboardEurofarma';
import { cores } from '../../theme/colors';
import {
  Carregando, EstadoVazio, Tabela, TarjaModoTeste, TituloTela,
} from '../../components/Comuns';
import { Icone } from '../../components/Icone';

const NOME_EUROFARMA = 'Eurofarma';

export function TermometroScreen() {
  const { dados, carregando, erro } = useDashboardEurofarma(DADOS_FALSOS.termometro);

  if (carregando) return <Carregando rotulo="Carregando termômetro" />;
  if (erro || !dados) return <EstadoVazio>{erro ?? 'Erro ao carregar.'}</EstadoVazio>;

  const fabricantes = dados.termometro_fabricantes ?? [];

  // `score_medio` pode vir null (base insuficiente). A média geral só
  // considera quem tem valor — somar null daria NaN e a tela mostraria
  // "NaN" onde deveria mostrar nada.
  const comScore = fabricantes.filter((f) => f.score_medio !== null);
  const mediaGeral = comScore.length
    ? comScore.reduce((s, f) => s + (f.score_medio as number), 0) / comScore.length
    : null;

  return (
    <>
      {DADOS_FALSOS.termometro && <TarjaModoTeste />}
      <TituloTela
        sub={
          mediaGeral !== null
            ? 'Média geral da rede: ' + mediaGeral.toFixed(1)
            : undefined
        }
      >
        Termômetro de Giro
      </TituloTela>

      {fabricantes.length === 0 ? (
        <EstadoVazio>
          Nenhum fabricante atingiu o piso mínimo de farmácias contribuindo.
          O termômetro só exibe um fabricante quando há farmácias distintas
          suficientes para o agregado não identificar nenhuma delas.
        </EstadoVazio>
      ) : (
        <Tabela colunas={['Fabricante', 'Score Médio', 'Lotes']}>
          {fabricantes.map((f) => {
            const ehEurofarma = f.fabricante === NOME_EUROFARMA;
            return (
              <tr
                key={f.fabricante}
                style={{
                  borderBottom: '1px solid ' + cores.borda,
                  background: ehEurofarma ? cores.primaryLight : undefined,
                }}
              >
                <td style={{ padding: 12, fontWeight: ehEurofarma ? 700 : 400 }}>
                  {ehEurofarma && (
                    <span aria-label="Sua empresa" style={{ marginRight: 6, display: 'inline-flex' }}><Icone nome="star" tamanho={13} /></span>
                  )}
                  {f.fabricante}
                </td>
                <td style={{ padding: 12 }}>
                  {f.score_medio === null ? (
                    <span
                      style={{ color: cores.neutro }}
                      title="Base insuficiente para o agregado — menos farmácias com alerta aberto do que o piso mínimo"
                    >
                      —
                    </span>
                  ) : (
                    f.score_medio
                  )}
                </td>
                <td style={{ padding: 12 }}>{f.total_lotes}</td>
              </tr>
            );
          })}
        </Tabela>
      )}
    </>
  );
}
