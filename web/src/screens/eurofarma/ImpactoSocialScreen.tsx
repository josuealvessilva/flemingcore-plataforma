import { useEffect, useState } from 'react';
import { DADOS_FALSOS } from '../../config/env';
import { get } from '../../services/httpInterceptor';
import { formatarNumero, formatarReais } from '../../utils/formato';
import { cores } from '../../theme/colors';
import {
  Carregando, CartaoMetrica, EstadoVazio, TarjaModoTeste, TituloTela,
} from '../../components/Comuns';

interface PontoMensal {
  mes: string;
  valor: number;
}

interface ImpactoSocial {
  desperdicio_evitado: number;
  medicamentos_preservados: number;
  populacao_atendida: number;
  evolucao_mensal: PontoMensal[];
}

const FALSO: ImpactoSocial = {
  desperdicio_evitado: 86540,
  medicamentos_preservados: 3120,
  populacao_atendida: 4870,
  evolucao_mensal: [
    { mes: 'Mai', valor: 12400 },
    { mes: 'Jun', valor: 21800 },
    { mes: 'Jul', valor: 34200 },
    { mes: 'Ago', valor: 86540 },
  ],
};

export function ImpactoSocialScreen() {
  const [dados, setDados] = useState<ImpactoSocial | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    void (async () => {
      if (DADOS_FALSOS.impactoSocial) {
        setDados(FALSO);
        setCarregando(false);
        return;
      }
      try {
        setDados(await get<ImpactoSocial>('/calcular_impacto_social'));
      } catch {
        setDados(null);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  if (carregando) return <Carregando rotulo="Carregando impacto social" />;
  if (!dados) return <EstadoVazio>Erro ao carregar.</EstadoVazio>;

  const evolucao = dados.evolucao_mensal ?? [];
  // Proteção mantida do Flutter: com lista vazia (farmácia nova, sem
  // histórico), calcular o maior valor quebraria a tela inteira em vez de
  // mostrar um estado vazio.
  const maiorValor = evolucao.length
    ? Math.max(...evolucao.map((e) => e.valor))
    : 0;

  return (
    <>
      {DADOS_FALSOS.impactoSocial && (
        <TarjaModoTeste texto="Modo de teste — dados fictícios (Function ainda não implementada no backend)" />
      )}
      <TituloTela>Impacto Social</TituloTela>

      <section aria-label="Indicadores de impacto" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <CartaoMetrica
          titulo="Desperdício evitado"
          valor={formatarReais(dados.desperdicio_evitado)}
          cor={cores.ok}
          icone="circle-dollar-sign"
        />
        <CartaoMetrica
          titulo="Medicamentos preservados"
          valor={formatarNumero(dados.medicamentos_preservados)}
          cor={cores.primary}
          icone="package"
        />
        <CartaoMetrica
          titulo="População potencialmente atendida"
          valor={formatarNumero(dados.populacao_atendida)}
          cor="var(--grafico-1)"
          icone="user-round"
        />
      </section>

      <h2 style={{ fontSize: 18, marginTop: 32 }}>Evolução Mensal</h2>

      {evolucao.length === 0 ? (
        <EstadoVazio>
          Ainda não há histórico suficiente para exibir a evolução mensal.
        </EstadoVazio>
      ) : (
        <div
          role="img"
          aria-label={
            'Evolução mensal do desperdício evitado: ' +
            evolucao.map((e) => e.mes + ', ' + formatarReais(e.valor)).join('; ')
          }
          style={{
            display: 'flex', alignItems: 'flex-end', gap: 12,
            height: 180, marginTop: 16, maxWidth: 640,
          }}
        >
          {evolucao.map((e) => (
            <div key={e.mes} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 10, marginBottom: 4 }}>{formatarReais(e.valor)}</div>
              <div
                style={{
                  height: maiorValor ? (e.valor / maiorValor) * 120 : 0,
                  background: 'var(--grafico-3)',
                  borderRadius: '4px 4px 0 0',
                }}
              />
              <div style={{ fontSize: 12, marginTop: 4 }}>{e.mes}</div>
            </div>
          ))}
        </div>
      )}

      {/*
        Nota de transparência — Seção 4, nunca remover.
        Impede a leitura de "população atendida" como dado clínico validado.
        Fica sempre visível junto aos números, não atrás de um clique.
      */}
      <p style={{
        marginTop: 24, padding: 12, borderRadius: 8, maxWidth: 640,
        background: cores.neutroClaro, fontSize: 12, color: cores.neutro,
      }}>
        População potencialmente atendida é uma estimativa baseada em dose
        média de tratamento por categoria — não representa dado clínico
        validado.
      </p>
    </>
  );
}
