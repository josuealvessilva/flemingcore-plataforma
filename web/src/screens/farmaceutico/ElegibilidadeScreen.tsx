// Nível 2 — Elegibilidade para Redistribuição.
//
// Lista TODOS os lotes ativos, não só os aptos: quem opera precisa saber
// por que um lote não pode ser redistribuído, não só que não pode.
//
// Os quatro critérios vêm sempre na resposta, inclusive os que passam, e
// esta tela itera sobre o que o backend mandou — não sobre uma lista fixa
// daqui. Hoje `categoria_permitida` e `farmacia_verificada` sempre passam
// (lista de categorias restritas vazia, farmácia verificada), mas isso é
// estado do banco, não garantia: no dia em que a lista regulatória for
// preenchida, o terceiro critério passa a reprovar e a tela já mostra,
// sem nenhuma mudança aqui.

import { useEffect, useState } from 'react';
import { DADOS_FALSOS } from '../../config/env';
import { get } from '../../services/httpInterceptor';
import type { LoteAvaliado, RespostaElegibilidade } from '../../services/tipos';
import { cores } from '../../theme/colors';
import { Carregando, EstadoVazio, TarjaModoTeste, TituloTela } from '../../components/Comuns';
import { Icone } from '../../components/Icone';

/** Rótulos conhecidos. Chave sem rótulo cai no fallback, não some da tela. */
const ROTULOS: Record<string, string> = {
  quantidade_suficiente: 'Quantidade suficiente',
  validade_suficiente: 'Prazo de validade suficiente',
  categoria_permitida: 'Categoria permitida',
  farmacia_verificada: 'Farmácia verificada',
};

function rotuloCriterio(chave: string): string {
  return ROTULOS[chave] ?? chave.replace(/_/g, ' ');
}

// Um lote apto e quatro reprovando um critério cada — inclusive os dois
// que hoje nunca falham de verdade, para a tela ser exercitada nos quatro.
const FALSOS: LoteAvaliado[] = [
  {
    id_lote: 2, medicamento: 'Losartana 50mg', apto: true,
    criterios: {
      quantidade_suficiente: true, validade_suficiente: true,
      categoria_permitida: true, farmacia_verificada: true,
    },
  },
  {
    id_lote: 3, medicamento: 'Dipirona 500mg', apto: false,
    criterios: {
      quantidade_suficiente: false, validade_suficiente: true,
      categoria_permitida: true, farmacia_verificada: true,
    },
  },
  {
    id_lote: 4, medicamento: 'Amoxicilina 250mg', apto: false,
    criterios: {
      quantidade_suficiente: true, validade_suficiente: false,
      categoria_permitida: true, farmacia_verificada: true,
    },
  },
  {
    id_lote: 5, medicamento: 'Clonazepam 2mg', apto: false,
    criterios: {
      quantidade_suficiente: true, validade_suficiente: true,
      categoria_permitida: false, farmacia_verificada: true,
    },
  },
  {
    id_lote: 6, medicamento: 'Omeprazol 20mg', apto: false,
    criterios: {
      quantidade_suficiente: true, validade_suficiente: true,
      categoria_permitida: true, farmacia_verificada: false,
    },
  },
];

export function ElegibilidadeScreen() {
  const [lotes, setLotes] = useState<LoteAvaliado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (DADOS_FALSOS.elegibilidade) {
        setLotes(FALSOS);
        setCarregando(false);
        return;
      }
      try {
        const r = await get<RespostaElegibilidade>('/verificar_elegibilidade_redistribuicao');
        setLotes(r.lotes_avaliados ?? []);
      } catch {
        setErro('Não foi possível carregar a elegibilidade dos lotes.');
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  if (carregando) return <Carregando rotulo="Avaliando lotes" />;

  const aptos = lotes.filter((l) => l.apto).length;

  return (
    <>
      {DADOS_FALSOS.elegibilidade && <TarjaModoTeste />}
      <TituloTela sub="Quais lotes desta farmácia podem ser redistribuídos — e o que impede os demais.">
        Elegibilidade para Redistribuição
      </TituloTela>

      {erro ? (
        <EstadoVazio>{erro}</EstadoVazio>
      ) : lotes.length === 0 ? (
        <EstadoVazio>Nenhum lote ativo para avaliar no momento.</EstadoVazio>
      ) : (
        <>
          <p style={{ color: cores.neutro, fontSize: 14, margin: '0 0 16px' }}>
            <strong>{aptos}</strong> de <strong>{lotes.length}</strong>{' '}
            {lotes.length === 1 ? 'lote ativo está apto' : 'lotes ativos estão aptos'}{' '}
            à redistribuição.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760 }}>
            {lotes.map((l) => <CartaoLote key={l.id_lote} lote={l} />)}
          </div>
        </>
      )}
    </>
  );
}

function CartaoLote({ lote }: { lote: LoteAvaliado }) {
  const [expandido, setExpandido] = useState(false);

  // Itera sobre o que veio do backend, não sobre ROTULOS: um critério novo
  // aparece sozinho; um critério removido some sozinho.
  const criterios = Object.entries(lote.criterios) as [string, boolean][];
  const reprovados = criterios.filter(([, passou]) => !passou);

  const cor = lote.apto ? cores.ok : cores.atencao;
  const detalheId = `criterios-lote-${lote.id_lote}`;

  return (
    <article style={{
      border: '1px solid ' + cores.borda, borderRadius: 10, padding: 16,
      borderLeft: '4px solid ' + cor,
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15, flex: 1 }}>
          {lote.medicamento}
          <span style={{ color: cores.neutro, fontWeight: 400, fontSize: 13 }}>
            {' · '}lote #{lote.id_lote}
          </span>
        </h2>
        <span style={{
          padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
          background: `color-mix(in srgb, ${cor} 12%, transparent)`, color: cor,
        }}>
          {lote.apto ? 'Apto' : 'Não apto'}
        </span>
      </header>

      {/* Não apto: dizer QUAL critério falhou, com o mesmo peso visual do
          selo. "Não apto" sozinho não deixa ninguém agir. */}
      {!lote.apto && (
        <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
          {reprovados.map(([chave]) => (
            <li key={chave} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 6, marginBottom: 6,
              background: `color-mix(in srgb, ${cores.atencao} 8%, transparent)`, color: cores.atencao, fontSize: 13,
            }}>
              <Icone nome="x" tamanho={14} />
              <span>{rotuloCriterio(chave)}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        aria-expanded={expandido}
        aria-controls={detalheId}
        style={{
          marginTop: 10, padding: 0, border: 'none', background: 'none',
          color: cores.primaryDark, cursor: 'pointer', fontSize: 13,
        }}
      >
        {expandido ? 'Ocultar critérios' : 'Ver os critérios'}
      </button>

      {expandido && (
        <ul id={detalheId} style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
          {criterios.map(([chave, passou]) => (
            <li key={chave} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 0', fontSize: 13,
              color: passou ? cores.neutro : cores.atencao,
            }}>
              <Icone nome={passou ? 'check' : 'x'} tamanho={14} />
              <span>{rotuloCriterio(chave)}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12 }}>
                {passou ? 'atende' : 'não atende'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
