import { useEffect, useRef, useState } from 'react';
import { DADOS_FALSOS } from '../../config/env';
import { get, post } from '../../services/httpInterceptor';
import type { Alerta, RespostaAlertas } from '../../services/tipos';
import { calcularDiasRestantes, prioridadePorScore } from '../../utils/formato';
import { cores } from '../../theme/colors';
import { TarjaModoTeste } from '../../components/Comuns';
import { Icone } from '../../components/Icone';

interface Mensagem {
  texto: string;
  doUsuario: boolean;
}

/** Score a partir do qual o alerta entra no painel de contexto. */
const SCORE_CRITICO = 70;

const SAUDACAO: Mensagem = {
  texto:
    'Olá. Sou a Flora, assistente do FlemingCore. O que você deseja saber ' +
    'sobre os dados do estoque hoje?',
  doUsuario: false,
};

/**
 * Flora — chat + painel de contexto, layout 60/40 (Seção 9).
 *
 * Porte do flora_chat_screen.dart. O eva_screen.dart, versão antiga desta
 * tela, não foi portado por decisão explícita (Seção 6) — o nome de
 * endpoint continua eva_chat, que é interno e não aparece ao usuário.
 */
export function FloraScreen() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([SAUDACAO]);
  const [texto, setTexto] = useState('');
  const [aguardando, setAguardando] = useState(false);
  const [criticos, setCriticos] = useState<Alerta[]>([]);
  const fimDaLista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void carregarCriticos();
  }, []);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, aguardando]);

  async function carregarCriticos() {
    if (DADOS_FALSOS.flora) {
      setCriticos([]);
      return;
    }
    try {
      const r = await get<RespostaAlertas>('/buscar_alertas');
      setCriticos(
        r.alertas
          .filter((a) => a.score >= SCORE_CRITICO)
          .sort((a, b) => b.score - a.score),
      );
    } catch {
      // Falha silenciosa: o painel de contexto não é crítico para o chat
      // funcionar, e um erro aqui não deve atrapalhar a conversa.
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const pergunta = texto.trim();
    if (!pergunta || aguardando) return;

    setMensagens((m) => [...m, { texto: pergunta, doUsuario: true }]);
    setTexto('');
    setAguardando(true);

    if (DADOS_FALSOS.flora) {
      setTimeout(() => {
        setMensagens((m) => [...m, {
          texto:
            '(teste) Ainda não estou conectada aos dados reais da farmácia, ' +
            'mas em breve vou poder responder sobre estoque, validade e alertas.',
          doUsuario: false,
        }]);
        setAguardando(false);
      }, 600);
      return;
    }

    try {
      // 'pergunta' e 'resposta' são os nomes exatos do contrato (Seção 5).
      const r = await post<{ resposta?: string; erro?: string }>('/eva_chat', { pergunta });
      setMensagens((m) => [...m, {
        texto: r.resposta ?? 'Não consegui responder agora. Tente de novo em instantes.',
        doUsuario: false,
      }]);
      // A pergunta pode ter mudado o que é mais urgente ver.
      void carregarCriticos();
    } catch {
      setMensagens((m) => [...m, {
        texto: 'Sem conexão. Verifique a internet e tente novamente.',
        doUsuario: false,
      }]);
    } finally {
      setAguardando(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%', minHeight: 480 }}>
      {/* Coluna do chat — 60% */}
      <section aria-label="Conversa com a Flora" style={{ flex: 6, display: 'flex', flexDirection: 'column' }}>
        {DADOS_FALSOS.flora && (
          <TarjaModoTeste texto="Modo de teste — Flora ainda não conectada à Function real" />
        )}

        <div
          role="log"
          aria-live="polite"
          aria-label="Histórico da conversa"
          style={{ flex: 1, overflowY: 'auto', padding: 16 }}
        >
          {mensagens.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: m.doUsuario ? 'flex-end' : 'flex-start',
                marginBottom: 8,
              }}
            >
              <p
                aria-label={(m.doUsuario ? 'Você disse: ' : 'Flora respondeu: ') + m.texto}
                style={{
                  maxWidth: '72%', margin: 0, padding: '11px 14px', fontSize: 14,
                  lineHeight: 1.5, whiteSpace: 'pre-wrap',
                  // O balão de quem pergunta é o acento; o da Flora é
                  // superfície neutra com borda — assim os dois se leem
                  // igualmente bem no modo claro e no escuro.
                  borderRadius: m.doUsuario ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                  background: m.doUsuario ? cores.primary : cores.superficieAlt,
                  color: m.doUsuario ? cores.sobreAcento : cores.texto,
                  border: m.doUsuario ? '1px solid transparent' : `1px solid ${cores.borda}`,
                }}
              >
                {m.texto}
              </p>
            </div>
          ))}
          {aguardando && (
            <p
              style={{ display: 'flex', alignItems: 'center', gap: 9, color: cores.neutro, padding: 10, fontSize: 13 }}
              aria-label="Flora está respondendo"
            >
              <span className="fc-pulso" aria-hidden="true"><i /><i /><i /></span>
              Flora está respondendo…
            </p>
          )}
          <div ref={fimDaLista} />
        </div>

        <form onSubmit={enviar} style={{ display: 'flex', gap: 8, padding: 12 }}>
          <label htmlFor="pergunta-flora" style={{ position: 'absolute', left: -9999 }}>
            Digite sua pergunta para a Flora
          </label>
          <input
            id="pergunta-flora"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Pergunte algo sobre o estoque…"
            style={{
              flex: 1, padding: 12, borderRadius: 6,
              border: '1px solid ' + cores.borda,
            }}
          />
          <button
            type="submit"
            disabled={aguardando || !texto.trim()}
            aria-label="Enviar pergunta para a Flora"
            style={{
              padding: '12px 20px', border: 'none', borderRadius: 6, color: cores.sobreAcento,
              cursor: aguardando || !texto.trim() ? 'not-allowed' : 'pointer',
              background: aguardando || !texto.trim() ? cores.desabilitado : cores.primary,
            }}
          >
            Enviar
          </button>
        </form>
      </section>

      <div aria-hidden="true" style={{ width: 1, background: cores.borda }} />

      {/* Painel de contexto — 40%, sempre visível */}
      <aside aria-label="Alertas críticos" style={{ flex: 4, padding: 16, overflowY: 'auto' }}>
        <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Alertas Críticos</h2>
        {criticos.length === 0 ? (
          <p style={{ color: cores.neutro, fontSize: 14 }}>
            Nenhum alerta crítico no momento.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {criticos.map((a) => (
              <li
                key={a.id_alerta}
                style={{
                  border: '1px solid ' + cores.borda, borderRadius: 8,
                  padding: 12, marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Icone nome="triangle-alert" tamanho={16} />
                  <strong style={{ flex: 1, fontSize: 14 }}>{a.medicamento}</strong>
                </div>
                <div style={{ fontSize: 12, color: cores.neutro, marginTop: 4 }}>
                  {calcularDiasRestantes(a.validade)} dias restantes ·{' '}
                  {prioridadePorScore(a.score).rotulo}
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
