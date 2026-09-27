// IVF (Índice de Vulnerabilidade Farmacêutica) por região.
//
// Lacuna confirmada no backend: nenhuma das 17 Functions devolve IVF por
// região. O buscar_dashboard_eurofarma só traz `ivf_medio`, um número
// único da rede inteira — insuficiente para o recorte regional desta tela.
//
// Correção de bug parcial (Seção 6): no Flutter esta tela nunca teve
// sequer chamada de rede, só a lista fixa no código. Aqui o padrão de
// busca está montado e o endpoint cabeado; falta o Samuel criá-lo. Trocar
// DADOS_FALSOS.vulnerabilidade para false quando existir.

import { useEffect, useState } from 'react';
import { DADOS_FALSOS } from '../../config/env';
import { get } from '../../services/httpInterceptor';
import { cores } from '../../theme/colors';
import {
  BarraFator, Carregando, EstadoVazio, TarjaModoTeste, TituloTela,
} from '../../components/Comuns';

interface RegiaoIvf {
  nome: string;
  ivf_medio: number;
  incidencia_regional: number;
  disponibilidade: number;
  risco_vencimento: number;
}

const FALSAS: RegiaoIvf[] = [
  { nome: 'Sudeste', ivf_medio: 0.62, incidencia_regional: 0.55, disponibilidade: 0.80, risco_vencimento: 0.40 },
  { nome: 'Nordeste', ivf_medio: 0.71, incidencia_regional: 0.68, disponibilidade: 0.60, risco_vencimento: 0.55 },
  { nome: 'Sul', ivf_medio: 0.48, incidencia_regional: 0.42, disponibilidade: 0.85, risco_vencimento: 0.30 },
];

function corPorIvf(v: number): string {
  if (v >= 0.66) return cores.risco;
  if (v >= 0.4) return cores.atencao;
  return cores.ok;
}

export function VulnerabilidadeScreen() {
  const [regioes, setRegioes] = useState<RegiaoIvf[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    void (async () => {
      if (DADOS_FALSOS.vulnerabilidade) {
        setRegioes(FALSAS);
        setCarregando(false);
        return;
      }
      try {
        const r = await get<{ regioes: RegiaoIvf[] }>('/buscar_ivf_regional');
        setRegioes(r.regioes ?? []);
      } catch {
        setRegioes([]);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  if (carregando) return <Carregando rotulo="Carregando índice de vulnerabilidade" />;

  return (
    <>
      {DADOS_FALSOS.vulnerabilidade && (
        <TarjaModoTeste texto="Modo de teste — dados fictícios. Nenhum endpoint do backend devolve IVF por região ainda." />
      )}
      <TituloTela>Vulnerabilidade Farmacêutica (IVF) por Região</TituloTela>

      {regioes.length === 0 ? (
        <EstadoVazio>Nenhuma região com dado de vulnerabilidade disponível.</EstadoVazio>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxWidth: 720 }}>
          {regioes.map((r) => (
            <li
              key={r.nome}
              style={{
                border: '1px solid ' + cores.borda, borderRadius: 12,
                padding: 16, marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <strong style={{ fontSize: 16 }}>{r.nome}</strong>
                <strong style={{ color: corPorIvf(r.ivf_medio) }}>
                  IVF médio: {r.ivf_medio.toFixed(2)}
                </strong>
              </div>
              <BarraFator label="Incidência regional" valor={r.incidencia_regional} />
              <BarraFator label="Disponibilidade" valor={r.disponibilidade} />
              <BarraFator label="Risco de vencimento" valor={r.risco_vencimento} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
