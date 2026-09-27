// Ideia 23 — Rede FlemingCore (Farmacêutico).
//
// Tela real conectada a uma Function real (sugerir_match_rede), mas o dado
// que a Function devolve é simulado — a base tem só uma farmácia de teste.
// O selo de aviso é controlado pelo campo 'simulado' vindo do backend,
// nunca por constante local: quando a Function passar a calcular com dado
// real, o campo vira false e o selo some sozinho, sem mudança aqui.

import { useEffect, useState } from 'react';
import { DADOS_FALSOS } from '../../config/env';
import { get } from '../../services/httpInterceptor';
import type { MatchRede } from '../../services/tipos';
import { cores } from '../../theme/colors';
import {
  Carregando, EstadoVazio, SeloSimulacao, TarjaModoTeste, TituloTela,
} from '../../components/Comuns';
import { Icone } from '../../components/Icone';

const FALSA: MatchRede = {
  farmacia_parceira: 'Farmácia Vida Nova',
  distancia_km: 2.3,
  medicamento_complementar: 'Losartana 50mg',
  motivo:
    'Sua farmácia tem excesso deste medicamento com risco de vencimento; ' +
    'a Farmácia Vida Nova reportou falta recorrente do mesmo item nos ' +
    'últimos 30 dias.',
  simulado: true,
};

export function RedeFlemingCoreScreen() {
  const [sugestao, setSugestao] = useState<MatchRede | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [mostrarFluxo, setMostrarFluxo] = useState(false);

  useEffect(() => {
    void (async () => {
      if (DADOS_FALSOS.redeFlemingCore) {
        setSugestao(FALSA);
        setCarregando(false);
        return;
      }
      try {
        setSugestao(await get<MatchRede>('/sugerir_match_rede'));
      } catch {
        setSugestao(null);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  if (carregando) return <Carregando rotulo="Carregando sugestão" />;
  if (!sugestao) return <EstadoVazio>Nenhuma sugestão disponível no momento.</EstadoVazio>;

  return (
    <>
      {DADOS_FALSOS.redeFlemingCore && <TarjaModoTeste />}
      <TituloTela>Rede FlemingCore</TituloTela>

      <SeloSimulacao simulado={sugestao.simulado} />

      <article style={{
        marginTop: 20, maxWidth: 640, padding: 20, borderRadius: 12,
        border: '1px solid ' + cores.borda,
      }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icone nome="store" tamanho={16} />
          <h2 style={{ margin: 0, fontSize: 16 }}>{sugestao.farmacia_parceira}</h2>
          <span style={{ marginLeft: 'auto', color: cores.neutro, fontSize: 14 }}>
            {sugestao.distancia_km} km
          </span>
        </header>

        <p style={{ marginTop: 12, marginBottom: 8 }}>
          Medicamento: <strong>{sugestao.medicamento_complementar}</strong>
        </p>
        <p style={{ color: cores.neutro, marginTop: 0 }}>{sugestao.motivo}</p>

        <button
          type="button"
          onClick={() => setMostrarFluxo(true)}
          style={{
            marginTop: 8, padding: '10px 16px', borderRadius: 6, cursor: 'pointer',
            border: '1px solid ' + cores.primary, background: cores.superficie, color: cores.primaryDark,
          }}
        >
          <Icone nome="chevron-right" tamanho={14} />
          Simular Fluxo de Devolução Casada
        </button>
      </article>

      {mostrarFluxo && (
        <div
          role="dialog" aria-modal="true" aria-label="Simulação — Devolução Casada"
          onClick={() => setMostrarFluxo(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: cores.superficie, borderRadius: 10, padding: 24, width: 460, maxWidth: '90vw' }}
          >
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Simulação — Devolução Casada</h2>
            <p style={{ fontWeight: 600, fontSize: 13 }}>
              Esta é uma demonstração de como o fluxo funcionaria — nenhuma ação
              real é executada.
            </p>
            <ol style={{ paddingLeft: 20, lineHeight: 1.8 }}>
              <li>
                Sua farmácia registraria a devolução de{' '}
                {sugestao.medicamento_complementar}
              </li>
              <li>
                {sugestao.farmacia_parceira} receberia a solicitação de transferência
              </li>
              <li>Distribuidor faz a ponte logística entre as duas</li>
            </ol>
            <button
              type="button" onClick={() => setMostrarFluxo(false)}
              style={{
                marginTop: 8, padding: '10px 16px', borderRadius: 6, cursor: 'pointer',
                border: '1px solid ' + cores.borda, background: cores.superficie,
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
