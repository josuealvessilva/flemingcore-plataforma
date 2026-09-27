import { useEffect, useState } from 'react';
import { get } from './httpInterceptor';
import type { DashboardEurofarma } from './tipos';

/**
 * Dado agregado da rede — buscar_dashboard_eurofarma.
 *
 * Três telas consomem este mesmo endpoint (Dashboard, Termômetro de Giro e
 * Conformidade). O hook centraliza a busca e o tratamento de erro para as
 * três não divergirem no comportamento nem baterem no backend três vezes
 * com lógicas diferentes.
 */

const FALSO: DashboardEurofarma = {
  total_farmacias: 18,
  dados_suficientes: true,
  total_desperdicio_evitado: 128450,
  total_medicamentos_preservados: 3240,
  ivf_medio: 0.82,
  farmacias_anvisa_ready: 14,
  termometro_fabricantes: [
    { fabricante: 'Eurofarma', score_medio: 78.4, total_lotes: 340 },
    { fabricante: 'EMS', score_medio: 71.2, total_lotes: 298 },
    { fabricante: 'Medley', score_medio: 65.9, total_lotes: 210 },
    { fabricante: 'Neo Química', score_medio: 58.3, total_lotes: 175 },
    { fabricante: 'Cimed', score_medio: 52.1, total_lotes: 132 },
  ],
};

export interface EstadoDashboard {
  dados: DashboardEurofarma | null;
  carregando: boolean;
  erro: string | null;
}

export function useDashboardEurofarma(usarFalso: boolean): EstadoDashboard {
  const [estado, setEstado] = useState<EstadoDashboard>({
    dados: null, carregando: true, erro: null,
  });

  useEffect(() => {
    let ativo = true;
    void (async () => {
      if (usarFalso) {
        if (ativo) setEstado({ dados: FALSO, carregando: false, erro: null });
        return;
      }
      try {
        const d = await get<DashboardEurofarma>('/buscar_dashboard_eurofarma');
        if (ativo) setEstado({ dados: d, carregando: false, erro: null });
      } catch {
        if (ativo) {
          setEstado({ dados: null, carregando: false, erro: 'Sem conexão. Tente novamente.' });
        }
      }
    })();
    return () => { ativo = false; };
  }, [usarFalso]);

  return estado;
}

/**
 * Piso mínimo de agregação (Item 29).
 *
 * Quando `dados_suficientes` é false, o backend manda os numéricos como
 * null de propósito — zero mentiria sobre o estado real do grupo. Esta
 * função é o único lugar que decide o texto substituto, para nenhuma tela
 * exibir "R$ null" nem "0" por engano.
 */
export const TEXTO_DADOS_INSUFICIENTES = 'Dados insuficientes para exibição';

export function exibirOuInsuficiente(
  valor: number | null | undefined,
  formatar: (v: number) => string,
): string {
  if (valor == null) return TEXTO_DADOS_INSUFICIENTES;
  return formatar(valor);
}
