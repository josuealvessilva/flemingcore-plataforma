// Ideia 16 — Wrapped Anual da Farmácia.
//
// Retrospectiva visual, propositalmente diferente do resto do app (cores
// vibrantes, cards grandes). A Function gerar_wrapped_anual ainda não
// existe no backend (verificado no main.py) — endpoint já cabeado.

import { useEffect, useState } from 'react';
import { DADOS_FALSOS } from '../../config/env';
import { get } from '../../services/httpInterceptor';
import { cores } from '../../theme/colors';
import {
  Carregando, EstadoVazio, TarjaModoTeste, TituloTela,
} from '../../components/Comuns';

interface Wrapped {
  medicamento_mais_vendido: string;
  categoria_maior_desperdicio: string;
  total_alertas_ano: number;
  alertas_resolvidos_a_tempo: number;
  valor_economizado: string;
  farmaceutico_mais_ativo: string;
  mes_mais_critico: string;
}

const FALSO: Wrapped = {
  medicamento_mais_vendido: 'Dipirona 500mg',
  categoria_maior_desperdicio: 'Anti-hipertensivo',
  total_alertas_ano: 87,
  alertas_resolvidos_a_tempo: 74,
  valor_economizado: '18.420,00',
  farmaceutico_mais_ativo: 'Ana Souza',
  mes_mais_critico: 'Julho',
};

export function WrappedScreen() {
  const [dados, setDados] = useState<Wrapped | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    void (async () => {
      if (DADOS_FALSOS.wrapped) {
        setDados(FALSO);
        setCarregando(false);
        return;
      }
      try {
        setDados(await get<Wrapped>('/gerar_wrapped_anual'));
      } catch {
        setDados(null);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  if (carregando) return <Carregando rotulo="Montando sua retrospectiva" />;
  if (!dados) return <EstadoVazio>Não foi possível carregar sua retrospectiva.</EstadoVazio>;

  return (
    <>
      {DADOS_FALSOS.wrapped && (
        <TarjaModoTeste texto="Modo de teste — dados fictícios (Function ainda não implementada no backend)" />
      )}
      <TituloTela>Seu ano no FlemingCore</TituloTela>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <CartaoWrapped
          titulo="Economizado no ano"
          valor={'R$ ' + dados.valor_economizado}
          icone="circle-dollar-sign"
          cor="var(--grafico-1)"
        />
        <CartaoWrapped
          titulo="Alertas resolvidos a tempo"
          valor={dados.alertas_resolvidos_a_tempo + ' de ' + dados.total_alertas_ano}
          icone="check"
          cor="var(--grafico-2)"
        />
        <CartaoWrapped
          titulo="Mais vendido"
          valor={dados.medicamento_mais_vendido}
          icone="pill"
          cor="var(--grafico-3)"
        />
        <CartaoWrapped
          titulo="Farmacêutico destaque"
          valor={dados.farmaceutico_mais_ativo}
          icone="star"
          cor="var(--grafico-4)"
        />
        <CartaoWrapped
          titulo="Mês mais crítico"
          valor={dados.mes_mais_critico}
          icone="calendar"
          cor="var(--grafico-5)"
        />
        <CartaoWrapped
          titulo="Categoria com maior desperdício"
          valor={dados.categoria_maior_desperdicio}
          icone="trending-down"
          cor="var(--grafico-6)"
        />
      </div>

      <p style={{ fontSize: 11, color: cores.neutro, marginTop: 24 }}>
        Retrospectiva do período completo registrado no sistema.
      </p>
    </>
  );
}

function CartaoWrapped({ titulo, valor, icone, cor }: {
  titulo: string; valor: string; icone: string; cor: string;
}) {
  return (
    <div style={{
      flex: '1 1 260px', minWidth: 240, padding: 24, borderRadius: 16,
      // color-mix, nao hexadecimal concatenado: `cor` e uma variavel CSS
      // (var(--grafico-1)), e `var(--x)99` nao e cor valida — o gradiente
      // inteiro caia fora e o cartao ficava branco no branco.
      background: `linear-gradient(135deg, ${cor}, color-mix(in srgb, ${cor} 60%, transparent))`,
      color: cores.sobreAcento,
    }}>
      <div aria-hidden="true" style={{ fontSize: 28 }}>{icone}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 12 }}>{valor}</div>
      <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{titulo}</div>
    </div>
  );
}
