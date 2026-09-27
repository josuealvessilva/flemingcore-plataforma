import { useEffect, useRef, useState } from 'react';
import { CAMPOS_PENDENTES, DADOS_FALSOS } from '../../config/env';
import { get, post } from '../../services/httpInterceptor';
import type { Medicamento } from '../../services/tipos';
import { parsearDataMatrix } from '../../utils/datamatrixParser';
import { dataParaIso } from '../../utils/formato';
import { cores } from '../../theme/colors';
import { RessalvaInteracao, TituloTela } from '../../components/Comuns';
import { Icone } from '../../components/Icone';

export function CadastrarLoteScreen() {
  const campoCodigo = useRef<HTMLInputElement>(null);

  const [codigo, setCodigo] = useState('');
  const [numeroLote, setNumeroLote] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [preco, setPreco] = useState('');
  const [validade, setValidade] = useState('');

  const [medicamento, setMedicamento] = useState<Medicamento | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [lidoViaDataMatrix, setLidoViaDataMatrix] = useState(false);

  // Foco automático ao abrir a tela: o leitor USB se comporta como teclado
  // (keyboard-wedge), digita o código e manda Enter. Sem o foco, o
  // farmacêutico teria que clicar no campo antes de cada leitura.
  useEffect(() => {
    campoCodigo.current?.focus();
  }, []);

  const camposVazios = !numeroLote || !quantidade || !validade;

  /**
   * Ideia 25 — decide se o código é um GTIN simples (comportamento atual)
   * ou um DataMatrix GS1 (extrai lote/validade antes de buscar).
   */
  function processarCodigo(valor: string) {
    setLidoViaDataMatrix(false);
    const dados = parsearDataMatrix(valor);

    if (!dados) {
      void buscarMedicamento(valor); // GTIN simples
      return;
    }

    if (dados.lote) setNumeroLote(dados.lote);
    if (dados.validade) setValidade(dados.validade);
    setLidoViaDataMatrix(true);
    void buscarMedicamento(dados.gtin ?? valor);
  }

  async function buscarMedicamento(cod: string) {
    if (!cod.trim()) return;
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
        setMensagem('Medicamento não cadastrado — será criado ao salvar.');
      }
    } catch {
      setMensagem('Sem conexão. Verifique a internet.');
    } finally {
      setBuscando(false);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (camposVazios || salvando) return;
    setSalvando(true);
    setMensagem(null);
    try {
      await post('/cadastrar_lote', {
        numero_lote: numeroLote,
        validade,
        quantidade: Number(quantidade),
        preco_unitario: preco ? Number(preco) : null,
        id_medicamento: medicamento?.id_medicamento ?? null,
      });
      setCodigo('');
      setNumeroLote('');
      setQuantidade('');
      setPreco('');
      setValidade('');
      setMedicamento(null);
      setLidoViaDataMatrix(false);
      setMensagem('Lote cadastrado com sucesso.');
      campoCodigo.current?.focus();
    } catch {
      setMensagem('Erro ao salvar. Dados mantidos.');
    } finally {
      setSalvando(false);
    }
  }

  const hoje = dataParaIso(new Date());
  const maximo = dataParaIso(new Date(Date.now() + 1825 * 864e5));

  return (
    <form onSubmit={salvar} style={{ maxWidth: 640 }}>
      <TituloTela>Cadastrar Lote</TituloTela>

      <label htmlFor="codigo" style={rotulo}>Código de Barras</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          id="codigo"
          ref={campoCodigo}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              processarCodigo(codigo);
            }
          }}
          placeholder="Aponte o leitor USB para a caixa"
          aria-label="Campo de código de barras — aponte o leitor USB para escanear"
          style={{ ...entrada, flex: 1 }}
        />
        {buscando && <span style={{ alignSelf: 'center', color: cores.neutro }}>buscando…</span>}
      </div>

      {medicamento?.nome && (
        <div style={{
          padding: 12, marginBottom: 8, borderRadius: 4,
          background: cores.neutroClaro, border: '1px solid ' + cores.borda,
        }}>
          <Icone nome="pill" tamanho={15} />{' '}
          {medicamento.nome}
          {medicamento.fabricante && (
            <span style={{ color: cores.neutro }}> · {medicamento.fabricante}</span>
          )}
        </div>
      )}

      {/* Ideia 13 P1 — o backend ainda não retorna situacao_regulatoria, então
          este bloco simplesmente não aparece. Acende sozinho quando o campo
          passar a vir. */}
      {medicamento?.situacao_regulatoria && (
        <p style={{
          fontSize: 12, marginBottom: 8, fontWeight: 500,
          color: medicamento.situacao_regulatoria === 'LIBERADO' ? cores.ok : cores.risco,
        }}>
          <Icone nome={medicamento.situacao_regulatoria === 'LIBERADO' ? 'check' : 'triangle-alert'} tamanho={14} />{' '}
          Situação: {medicamento.situacao_regulatoria}
        </p>
      )}

      {/* Ideia 13 P3 — sinalização sempre neutra (cinza). O volume sozinho
          não indica gravidade, e colorir de vermelho seria o mesmo alarme
          falso que o time evitou na versão completa da Ideia 01. */}
      {!CAMPOS_PENDENTES.notificacoesSeguranca &&
        medicamento?.total_notificacoes_seguranca != null &&
        medicamento.total_notificacoes_seguranca > 0 && (
        <div style={{
          padding: 10, marginBottom: 8, borderRadius: 8,
          background: cores.neutroClaro, border: '1px solid ' + cores.borda,
        }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500 }}>
            ℹ️ {medicamento.total_notificacoes_seguranca} notificação(ões) de
            segurança registrada(s) na base VigiMed (ANVISA)
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: cores.neutro }}>
            Isso não indica gravidade nem recall — consulte a fonte oficial da
            ANVISA para mais detalhes.
          </p>
        </div>
      )}

      {lidoViaDataMatrix && (
        <p style={{
          display: 'inline-block', padding: '4px 8px', marginBottom: 8,
          borderRadius: 4, background: cores.primaryLight,
          color: cores.primaryDark, fontSize: 11,
        }}>
          Lido via DataMatrix — dados preenchidos automaticamente
        </p>
      )}

      <label htmlFor="lote" style={rotulo}>Número do Lote</label>
      <input id="lote" value={numeroLote} onChange={(e) => setNumeroLote(e.target.value)} style={entrada} />

      <label htmlFor="qtd" style={rotulo}>Quantidade</label>
      <input id="qtd" type="number" min="1" value={quantidade}
        onChange={(e) => setQuantidade(e.target.value)} style={entrada} />

      <label htmlFor="preco" style={rotulo}>Preço Unitário (R$)</label>
      <input id="preco" type="number" step="0.01" min="0" value={preco}
        onChange={(e) => setPreco(e.target.value)} style={entrada} />

      <label htmlFor="validade" style={rotulo}>Data de Validade</label>
      <input id="validade" type="date" min={hoje} max={maximo} value={validade}
        onChange={(e) => setValidade(e.target.value)} style={entrada} />

      {mensagem && (
        <p role="status" aria-live="polite" style={{
          color: mensagem.includes('sucesso') ? cores.ok : cores.atencao,
        }}>
          {mensagem}
        </p>
      )}

      {/* Ideia 01 Reduzida — nunca afirmar que existe interação, só sinalizar
          para conferência humana. A ressalva fica sempre visível junto ao
          aviso, nunca atrás de um "ok" que some. */}
      {medicamento?.aviso_interacao && (
        <section style={{
          padding: 12, margin: '12px 0', borderRadius: 8,
          background: cores.neutroClaro, border: '1px solid ' + cores.borda,
        }}>
          <strong>ℹ️ Atenção</strong>
          <p style={{ margin: '6px 0 0' }}>{medicamento.aviso_interacao}</p>
          <RessalvaInteracao />
        </section>
      )}

      <button
        type="submit"
        disabled={camposVazios || salvando}
        aria-label={camposVazios
          ? 'Salvar desabilitado — preencha lote, quantidade e validade'
          : 'Salvar lote de ' + (medicamento?.nome ?? 'medicamento')}
        style={{
          width: '100%', padding: 14, marginTop: 16, border: 'none', borderRadius: 6,
          color: cores.sobreAcento, fontSize: 15,
          cursor: camposVazios || salvando ? 'not-allowed' : 'pointer',
          background: camposVazios || salvando ? cores.desabilitado : cores.primary,
        }}
      >
        {salvando ? 'Salvando…' : 'Salvar Lote'}
      </button>

      {DADOS_FALSOS.cadastrarLote && (
        <p style={{ fontSize: 11, color: cores.neutro }}>Modo de teste ativo.</p>
      )}
    </form>
  );
}

const rotulo: React.CSSProperties = { display: 'block', fontSize: 13, marginBottom: 4 };
const entrada: React.CSSProperties = {
  width: '100%', padding: 10, marginBottom: 12,
  border: '1px solid ' + cores.borda, borderRadius: 4,
};
