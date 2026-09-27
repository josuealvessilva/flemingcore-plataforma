// Nível 2 — Watchlist de Demanda (Radar de Demanda).
//
// Duas abas: o que esta farmácia procura, e o que foi encontrado em
// outras farmácias.
//
// Sobre a aba de matches: lista vazia é resultado REAL de uma busca real,
// não simulação nem erro. Com uma farmácia só na base, "nenhum match" é a
// resposta honesta — por isso esta tela não usa SeloSimulacao, ao
// contrário da Rede FlemingCore, cujo dado é sintético.

import { useCallback, useEffect, useRef, useState } from 'react';
import { DADOS_FALSOS } from '../../config/env';
import { get, mensagemDoCorpo, postComStatusBruto } from '../../services/httpInterceptor';
import type {
  ItemWatchlist, MatchWatchlist, Medicamento,
  RespostaMatchesWatchlist, RespostaWatchlist,
} from '../../services/tipos';
import { parsearDataMatrix } from '../../utils/datamatrixParser';
import { formatarNumero } from '../../utils/formato';
import { cores } from '../../theme/colors';
import { Carregando, EstadoVazio, TarjaModoTeste, TituloTela } from '../../components/Comuns';
import { Icone } from '../../components/Icone';

type Aba = 'lista' | 'matches';

const ITENS_FALSOS: ItemWatchlist[] = [
  {
    id_watchlist: 7, id_medicamento: 3, nome: 'Amoxicilina 250mg',
    quantidade_desejada: 150, categoria: null, data_criacao: '2026-09-01 10:22:00',
  },
  {
    id_watchlist: 9, id_medicamento: 5, nome: 'Paracetamol 750mg',
    quantidade_desejada: null, categoria: null, data_criacao: '2026-09-02 14:05:00',
  },
];

const MATCHES_FALSOS: MatchWatchlist[] = [
  {
    id_medicamento: 3, nome: 'Amoxicilina 250mg', quantidade_desejada: 150,
    farmacia_com_excesso: {
      id_farmacia: 7, id_lote: 44, quantidade_disponivel: 200, dias_restantes: 60,
    },
  },
  {
    // Match parcial: 40 disponíveis para quem pediu 150. Aparece de
    // propósito — quem recebe julga olhando os dois números.
    id_medicamento: 3, nome: 'Amoxicilina 250mg', quantidade_desejada: 150,
    farmacia_com_excesso: {
      id_farmacia: 11, id_lote: 58, quantidade_disponivel: 40, dias_restantes: 95,
    },
  },
];

export function WatchlistScreen() {
  const [aba, setAba] = useState<Aba>('lista');

  return (
    <>
      {DADOS_FALSOS.watchlist && <TarjaModoTeste />}
      <TituloTela sub="Registre o que falta na sua farmácia e veja onde há excesso na rede.">
        Watchlist de Demanda
      </TituloTela>

      <div role="tablist" aria-label="Seções da watchlist"
        style={{ display: 'flex', gap: 4, borderBottom: '1px solid ' + cores.borda, marginBottom: 20 }}>
        <BotaoAba atual={aba} valor="lista" onClick={setAba}>Minha Lista</BotaoAba>
        <BotaoAba atual={aba} valor="matches" onClick={setAba}>Matches Encontrados</BotaoAba>
      </div>

      <div role="tabpanel" id="painel-lista" aria-labelledby="aba-lista" hidden={aba !== 'lista'}>
        {aba === 'lista' && <AbaMinhaLista />}
      </div>
      <div role="tabpanel" id="painel-matches" aria-labelledby="aba-matches" hidden={aba !== 'matches'}>
        {aba === 'matches' && <AbaMatches />}
      </div>
    </>
  );
}

function BotaoAba({ atual, valor, onClick, children }: {
  atual: Aba; valor: Aba; onClick: (a: Aba) => void; children: string;
}) {
  const ativo = atual === valor;
  return (
    <button
      type="button" role="tab" id={`aba-${valor}`}
      aria-selected={ativo} aria-controls={`painel-${valor}`}
      onClick={() => onClick(valor)}
      style={{
        padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 14,
        background: 'none', color: ativo ? cores.primaryDark : cores.neutro,
        fontWeight: ativo ? 600 : 400,
        borderBottom: `3px solid ${ativo ? cores.primary : 'transparent'}`,
        marginBottom: -1,
      }}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------------- */

function AbaMinhaLista() {
  const campoCodigo = useRef<HTMLInputElement>(null);

  const [itens, setItens] = useState<ItemWatchlist[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [codigo, setCodigo] = useState('');
  const [medicamento, setMedicamento] = useState<Medicamento | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);

  const carregar = useCallback(async () => {
    if (DADOS_FALSOS.watchlist) {
      setItens(ITENS_FALSOS);
      setCarregando(false);
      return;
    }
    try {
      const r = await get<RespostaWatchlist>('/buscar_minha_watchlist');
      setItens(r.itens ?? []);
    } catch {
      setMensagem({ texto: 'Não foi possível carregar sua watchlist.', erro: true });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  // Mesmo comportamento da tela de Cadastrar Lote: o leitor USB age como
  // teclado, então o campo precisa já estar focado quando a aba abre.
  useEffect(() => { campoCodigo.current?.focus(); }, []);

  async function buscarMedicamento(valor: string) {
    if (!valor.trim()) return;
    // Aceita DataMatrix GS1 além do GTIN simples, igual ao Cadastrar Lote —
    // aqui só o GTIN interessa; lote e validade do código são irrelevantes
    // para uma lista de intenção de compra.
    const dados = parsearDataMatrix(valor);
    const cod = dados?.gtin ?? valor;

    setBuscando(true);
    setMedicamento(null);
    setMensagem(null);
    try {
      const dado = await get<Medicamento>(
        '/buscar_medicamento?codigo_barras=' + encodeURIComponent(cod),
      );
      if (dado.encontrado) {
        setMedicamento(dado);
      } else {
        setMensagem({
          texto: 'Medicamento não cadastrado — só é possível observar itens já no catálogo.',
          erro: true,
        });
      }
    } catch {
      setMensagem({ texto: 'Sem conexão. Verifique a internet.', erro: true });
    } finally {
      setBuscando(false);
    }
  }

  function limparFormulario() {
    setCodigo('');
    setQuantidade('');
    setMedicamento(null);
    campoCodigo.current?.focus();
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    const id = medicamento?.id_medicamento;
    if (id == null) {
      setMensagem({ texto: 'Escaneie um medicamento antes de adicionar.', erro: true });
      return;
    }

    // Validação client-side COMPLEMENTAR, não substituta: o backend
    // continua validando e devolvendo 400. Esta existe só para não gastar
    // uma ida ao servidor com um valor que já se sabe inválido.
    let qtd: number | null = null;
    if (quantidade.trim()) {
      const n = Number(quantidade);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
        setMensagem({ texto: 'A quantidade desejada deve ser um número inteiro maior que zero.', erro: true });
        return;
      }
      qtd = n;
    }

    setSalvando(true);
    setMensagem(null);

    if (DADOS_FALSOS.watchlist) {
      const jaTem = itens.some((i) => i.id_medicamento === id);
      if (jaTem) {
        setMensagem({ texto: 'Este medicamento já está na sua watchlist.', erro: true });
      } else {
        setItens((v) => [...v, {
          id_watchlist: Math.max(0, ...v.map((i) => i.id_watchlist)) + 1,
          id_medicamento: id, nome: medicamento?.nome ?? '—',
          quantidade_desejada: qtd, categoria: null,
          data_criacao: new Date().toISOString(),
        }]);
        setMensagem({ texto: 'Adicionado à watchlist.', erro: false });
        limparFormulario();
      }
      setSalvando(false);
      return;
    }

    try {
      const { status, corpo } = await postComStatusBruto('/adicionar_watchlist', {
        id_medicamento: id,
        quantidade_desejada: qtd,
      });

      if (status === 201) {
        setMensagem({ texto: 'Adicionado à watchlist.', erro: false });
        limparFormulario();
        await carregar();
      } else if (status === 409) {
        // Duplicata tem mensagem própria: "erro ao adicionar" faria o
        // farmacêutico tentar de novo, e o resultado seria o mesmo 409.
        setMensagem({ texto: 'Este medicamento já está na sua watchlist.', erro: true });
      } else if (status === 404) {
        setMensagem({ texto: mensagemDoCorpo(corpo, 'Medicamento não encontrado.'), erro: true });
      } else if (status === 400) {
        setMensagem({ texto: mensagemDoCorpo(corpo, 'Dados inválidos.'), erro: true });
      } else {
        setMensagem({ texto: mensagemDoCorpo(corpo, 'Não foi possível adicionar.'), erro: true });
      }
    } catch {
      setMensagem({ texto: 'Sem conexão. Verifique a internet.', erro: true });
    } finally {
      setSalvando(false);
    }
  }

  async function remover(item: ItemWatchlist) {
    setMensagem(null);

    if (DADOS_FALSOS.watchlist) {
      setItens((v) => v.filter((i) => i.id_watchlist !== item.id_watchlist));
      setMensagem({ texto: `${item.nome} removido da watchlist.`, erro: false });
      return;
    }

    try {
      const { status, corpo } = await postComStatusBruto('/remover_watchlist', {
        id_watchlist: item.id_watchlist,
      });
      if (status === 200) {
        setMensagem({ texto: `${item.nome} removido da watchlist.`, erro: false });
        await carregar();
      } else if (status === 404) {
        // O backend usa a MESMA resposta para "não existe" e "é de outra
        // farmácia" — de propósito, para não confirmar itens alheios. A
        // tela não tenta adivinhar qual dos dois foi; recarrega, porque na
        // prática o motivo provável é a lista estar desatualizada.
        setMensagem({
          texto: mensagemDoCorpo(corpo, 'Item não encontrado na sua watchlist.'),
          erro: true,
        });
        await carregar();
      } else {
        setMensagem({ texto: mensagemDoCorpo(corpo, 'Não foi possível remover.'), erro: true });
      }
    } catch {
      setMensagem({ texto: 'Sem conexão. Verifique a internet.', erro: true });
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <form onSubmit={adicionar} style={{
        border: '1px solid ' + cores.borda, borderRadius: 10,
        padding: 16, marginBottom: 24,
      }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 15 }}>Adicionar medicamento</h2>

        <label htmlFor="codigo-watchlist" style={rotulo}>Código de Barras</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            id="codigo-watchlist"
            ref={campoCodigo}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void buscarMedicamento(codigo);
              }
            }}
            placeholder="Aponte o leitor USB para a caixa"
            aria-label="Campo de código de barras — aponte o leitor USB para escanear"
            style={{ ...entrada, flex: 1, marginBottom: 0 }}
          />
          {buscando && <span style={{ alignSelf: 'center', color: cores.neutro }}>buscando…</span>}
        </div>

        {medicamento?.nome && (
          <div style={{
            padding: 12, marginBottom: 12, borderRadius: 4,
            background: cores.neutroClaro, border: '1px solid ' + cores.borda,
          }}>
            <Icone nome="pill" tamanho={15} />{' '}
            {medicamento.nome}
            {medicamento.fabricante && (
              <span style={{ color: cores.neutro }}> · {medicamento.fabricante}</span>
            )}
          </div>
        )}

        <label htmlFor="qtd-watchlist" style={rotulo}>
          Quantidade desejada <span style={{ color: cores.neutro }}>(opcional)</span>
        </label>
        <input
          id="qtd-watchlist"
          type="number" min={1} step={1}
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          placeholder="Deixe vazio para só sinalizar interesse"
          style={entrada}
        />

        <button
          type="submit"
          disabled={salvando || medicamento?.id_medicamento == null}
          style={{
            padding: '10px 16px', borderRadius: 6, border: 'none', fontSize: 14,
            background: medicamento?.id_medicamento == null ? cores.borda : cores.primary,
            color: cores.sobreAcento,
            cursor: medicamento?.id_medicamento == null ? 'not-allowed' : 'pointer',
          }}
        >
          {salvando ? 'Adicionando…' : 'Adicionar à watchlist'}
        </button>
      </form>

      {mensagem && (
        <p role="status" style={{
          padding: '10px 12px', borderRadius: 6, fontSize: 13, marginTop: 0,
          background: mensagem.erro
            ? `color-mix(in srgb, ${cores.atencao} 10%, transparent)`
            : `color-mix(in srgb, ${cores.ok} 10%, transparent)`,
          color: mensagem.erro ? cores.atencao : cores.ok,
        }}>
          {mensagem.texto}
        </p>
      )}

      {carregando ? (
        <Carregando rotulo="Carregando sua watchlist" />
      ) : itens.length === 0 ? (
        <EstadoVazio>
          Sua watchlist está vazia. Escaneie um medicamento acima para começar.
        </EstadoVazio>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {itens.map((i) => (
            <li key={i.id_watchlist} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0', borderBottom: '1px solid ' + cores.borda,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14 }}>{i.nome}</div>
                <div style={{ fontSize: 12, color: cores.neutro }}>
                  {i.quantidade_desejada == null
                    ? 'Sem quantidade definida — apenas interesse'
                    : `Deseja ${formatarNumero(i.quantidade_desejada)} un`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void remover(i)}
                aria-label={`Remover ${i.nome} da watchlist`}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                  border: '1px solid ' + cores.borda, background: cores.superficie, color: cores.risco,
                }}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function AbaMatches() {
  const [matches, setMatches] = useState<MatchWatchlist[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (DADOS_FALSOS.watchlist) {
        setMatches(MATCHES_FALSOS);
        setCarregando(false);
        return;
      }
      try {
        const r = await get<RespostaMatchesWatchlist>('/buscar_matches_watchlist');
        setMatches(r.matches ?? []);
      } catch {
        setErro('Não foi possível buscar matches.');
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  if (carregando) return <Carregando rotulo="Procurando matches na rede" />;
  if (erro) return <EstadoVazio>{erro}</EstadoVazio>;

  if (matches.length === 0) {
    // Resultado real de uma busca real. NÃO é erro de carregamento nem
    // simulação: com uma farmácia só na base, vazio é a resposta correta.
    return (
      <EstadoVazio>
        <div>
          <p style={{ margin: 0 }}>Nenhum match encontrado no momento.</p>
          <p style={{ margin: '8px 0 0', fontSize: 13 }}>
            A busca rodou normalmente — nenhuma outra farmácia da rede tem
            excesso dos itens da sua watchlist agora.
          </p>
        </div>
      </EstadoVazio>
    );
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {matches.map((m) => (
        <CartaoMatch key={`${m.id_medicamento}-${m.farmacia_com_excesso.id_lote}`} match={m} />
      ))}

      {/* O backend entrega o número da farmácia e nada mais — sem nome e
          sem contato, porque o fluxo de conexão entre farmácias não
          existe. A tela diz isso em vez de oferecer um botão de
          "iniciar transferência" que não transferiria nada. */}
      <p style={{
        marginTop: 20, padding: '12px 14px', borderRadius: 6, fontSize: 13,
        background: cores.neutroClaro, color: cores.neutro,
      }}>
        A transferência entre farmácias ainda não é feita pelo FlemingCore.
        Para prosseguir com qualquer um destes itens, entre em contato
        através do seu distribuidor, informando o número do lote.
      </p>
    </div>
  );
}

function CartaoMatch({ match }: { match: MatchWatchlist }) {
  const f = match.farmacia_com_excesso;
  const parcial = match.quantidade_desejada != null
    && f.quantidade_disponivel < match.quantidade_desejada;

  return (
    <article style={{
      border: '1px solid ' + cores.borda, borderRadius: 10,
      padding: 16, marginBottom: 12,
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 15, flex: 1 }}>{match.nome}</h2>
        <span style={{ fontSize: 12, color: cores.neutro }}>
          vence em {f.dias_restantes} dias
        </span>
      </header>

      {/* Os dois números lado a lado: sem comparar, não dá para julgar se
          um match parcial serve. */}
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <Numero rotulo="Você procura" valor={
          match.quantidade_desejada == null
            ? '—'
            : `${formatarNumero(match.quantidade_desejada)} un`
        } />
        <Numero
          rotulo="Disponível na rede"
          valor={`${formatarNumero(f.quantidade_disponivel)} un`}
          cor={parcial ? cores.atencao : cores.ok}
        />
      </div>

      {parcial && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: cores.atencao }}>
          Cobertura parcial — atende{' '}
          {Math.round((f.quantidade_disponivel / (match.quantidade_desejada ?? 1)) * 100)}%
          {' '}do que você procura.
        </p>
      )}

      <p style={{ margin: '12px 0 0', fontSize: 12, color: cores.neutro }}>
        Farmácia #{f.id_farmacia} · lote #{f.id_lote}
      </p>
    </article>
  );
}

function Numero({ rotulo: r, valor, cor = cores.neutro }: {
  rotulo: string; valor: string; cor?: string;
}) {
  return (
    <div style={{
      flex: 1, padding: 12, borderRadius: 8,
      background: `color-mix(in srgb, ${cor} 9%, transparent)`,
      border: `1px solid color-mix(in srgb, ${cor} 27%, transparent)`,
    }}>
      <div style={{ fontSize: 11, color: cores.neutro, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {r}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: cor, marginTop: 4 }}>{valor}</div>
    </div>
  );
}

const rotulo: React.CSSProperties = { display: 'block', fontSize: 13, marginBottom: 4 };
const entrada: React.CSSProperties = {
  width: '100%', padding: 10, marginBottom: 12,
  border: '1px solid ' + cores.borda, borderRadius: 4,
};
