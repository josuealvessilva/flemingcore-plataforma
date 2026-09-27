// Ideia 02 — Rastreabilidade até o Ponto de Venda.
//
// Pré-requisito real, não decorativo: esta tela só retorna dado de verdade
// depois da Ideia 11 (Mock PDV) estar gerando vendas com cliente_cpf /
// cliente_telefone preenchidos. A Function buscar_clientes_por_lote também
// ainda não existe no backend (verificado no main.py) — por isso o modo de
// teste continua ligado.

import { useState } from 'react';
import { DADOS_FALSOS } from '../../config/env';
import { get } from '../../services/httpInterceptor';
import type { ClienteRastreado } from '../../services/tipos';
import { mascararCpf, mascararTelefone } from '../../utils/mascara';
import { cores } from '../../theme/colors';
import { TarjaModoTeste, TituloTela } from '../../components/Comuns';

const FALSOS: ClienteRastreado[] = [
  {
    cliente_cpf: '***.456.789-**', cliente_telefone: '(11) 9****-5678',
    data_venda: new Date(Date.now() - 12 * 864e5).toISOString().split('T')[0] ?? null,
  },
  {
    cliente_cpf: '***.123.456-**', cliente_telefone: '(11) 9****-1234',
    data_venda: new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0] ?? null,
  },
];

export function RastreabilidadeScreen() {
  const [lote, setLote] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [clientes, setClientes] = useState<ClienteRastreado[] | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const numero = lote.trim();
    if (!numero) return;

    setBuscando(true);
    setMensagem(null);
    setClientes(null);

    if (DADOS_FALSOS.rastreabilidade) {
      setTimeout(() => {
        setClientes(FALSOS);
        setBuscando(false);
      }, 400);
      return;
    }

    try {
      const r = await get<{ clientes: ClienteRastreado[] }>(
        '/buscar_clientes_por_lote?numero_lote=' + encodeURIComponent(numero),
      );
      setClientes(r.clientes ?? []);
      if (!r.clientes?.length) {
        setMensagem('Nenhum cliente com CPF/telefone registrado para este lote.');
      }
    } catch {
      setMensagem('Erro ao buscar. Tente novamente.');
    } finally {
      setBuscando(false);
    }
  }

  return (
    <>
      {DADOS_FALSOS.rastreabilidade && (
        <TarjaModoTeste texto="Modo de teste — dados fictícios (Function ainda não implementada; depende da Ideia 11)" />
      )}

      <TituloTela sub="Em caso de recall, busque quais clientes compraram de um lote específico.">
        Rastreabilidade — Consulta por Recall
      </TituloTela>

      <form onSubmit={buscar} style={{ display: 'flex', gap: 12, maxWidth: 560, marginBottom: 24 }}>
        <label htmlFor="lote-recall" style={{ position: 'absolute', left: -9999 }}>
          Número do Lote
        </label>
        <input
          id="lote-recall"
          value={lote}
          onChange={(e) => setLote(e.target.value)}
          placeholder="Número do Lote"
          style={{
            flex: 1, padding: 10, borderRadius: 4,
            border: '1px solid ' + cores.borda,
          }}
        />
        <button
          type="submit"
          disabled={buscando || !lote.trim()}
          style={{
            padding: '10px 20px', border: 'none', borderRadius: 6, color: cores.sobreAcento,
            cursor: buscando || !lote.trim() ? 'not-allowed' : 'pointer',
            background: buscando || !lote.trim() ? cores.desabilitado : cores.primary,
          }}
        >
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {mensagem && <p role="status">{mensagem}</p>}

      {clientes && clientes.length > 0 && (
        <>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxWidth: 560 }}>
            {clientes.map((c, i) => (
              <li
                key={i}
                style={{ padding: 12, borderBottom: '1px solid ' + cores.borda }}
              >
                {/* LGPD: CPF e telefone passam SEMPRE pelas funções de máscara,
                    mesmo quando já vêm mascarados do backend. As funções são
                    idempotentes justamente para que, se um dia o backend
                    mandar o dado completo, a tela continue não exibindo. */}
                <div>CPF: {mascararCpf(c.cliente_cpf)}</div>
                <div style={{ fontSize: 13, color: cores.neutro }}>
                  Tel: {mascararTelefone(c.cliente_telefone)} · Venda: {c.data_venda ?? '—'}
                </div>
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 11, color: cores.neutro, marginTop: 16, maxWidth: 560 }}>
            CPF e telefone são exibidos sempre parcialmente mascarados — dado
            pessoal sensível, minimização aplicada na própria exibição.
          </p>
        </>
      )}
    </>
  );
}
