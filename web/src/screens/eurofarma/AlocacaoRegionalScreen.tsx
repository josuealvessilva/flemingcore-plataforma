// Ideia 18 — Alocação Preditiva Regional (Eurofarma).
//
// Tela real conectada a uma Function real (sugerir_alocacao_regional), mas
// o dado é simulado — a base não tem volume histórico nem fonte de doença
// crônica por região. O selo vem do campo 'simulado' do backend, nunca de
// constante local.
//
// Lista com barra em vez de mapa do Brasil: mesma informação transmitida,
// sem dependência de pacote de mapas com API key e cotas — desnecessário
// para o que esta versão precisa demonstrar.

import { useEffect, useState } from 'react';
import { DADOS_FALSOS } from '../../config/env';
import { get } from '../../services/httpInterceptor';
import type { AlocacaoRegional } from '../../services/tipos';
import { formatarNumero } from '../../utils/formato';
import { cores } from '../../theme/colors';
import {
  BarraFator, Carregando, EstadoVazio, SeloSimulacao, TarjaModoTeste, TituloTela,
} from '../../components/Comuns';

const FALSA: AlocacaoRegional = {
  medicamento: 'Dipirona 500mg',
  quantidade_total: 50000,
  simulado: true,
  alocacao: [
    { regiao: 'Sudeste', percentual: 42 },
    { regiao: 'Nordeste', percentual: 26 },
    { regiao: 'Sul', percentual: 18 },
    { regiao: 'Centro-Oeste', percentual: 9 },
    { regiao: 'Norte', percentual: 5 },
  ],
};

export function AlocacaoRegionalScreen() {
  const [dados, setDados] = useState<AlocacaoRegional | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    void (async () => {
      if (DADOS_FALSOS.alocacaoRegional) {
        setDados(FALSA);
        setCarregando(false);
        return;
      }
      try {
        setDados(await get<AlocacaoRegional>('/sugerir_alocacao_regional'));
      } catch {
        setDados(null);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  if (carregando) return <Carregando rotulo="Carregando alocação" />;
  if (!dados) return <EstadoVazio>Nenhuma sugestão disponível no momento.</EstadoVazio>;

  return (
    <>
      {DADOS_FALSOS.alocacaoRegional && <TarjaModoTeste />}

      <TituloTela
        sub={dados.medicamento + ' — ' + formatarNumero(dados.quantidade_total) + ' unidades'}
      >
        Alocação Preditiva Regional
      </TituloTela>

      <SeloSimulacao simulado={dados.simulado} />

      <section aria-label="Distribuição por região" style={{ marginTop: 24, maxWidth: 640 }}>
        {dados.alocacao.map((item) => (
          <BarraFator
            key={item.regiao}
            label={item.regiao}
            valor={item.percentual / 100}
            cor={cores.primary}
          />
        ))}
      </section>

      {dados.alocacao.length === 0 && (
        <EstadoVazio>Nenhuma região com dado suficiente para sugerir alocação.</EstadoVazio>
      )}
    </>
  );
}
