/**
 * Contrato de API — Seção 5 da especificação.
 *
 * Os nomes de campo batem exatamente com o que o main.py retorna; foram
 * conferidos no backend em produção, não inferidos do Flutter. Campos
 * marcados como opcionais são os que o backend AINDA não envia — ficam
 * undefined e a UI simplesmente não os renderiza.
 */

export interface Alerta {
  id_alerta: number;
  medicamento: string;
  score: number;
  tipo: 'vencimento' | 'discrepancia' | 'regulatorio' | 'esquecido' | 'campanha_vacinacao';
  recomendacao: string;
  valor_financeiro_risco: number;
  sobra_projetada: number;
  status: string;
  validade: string;   // AAAA-MM-DD
  quantidade: number;

  // --- Não vêm do buscar_alertas atual (verificado no main.py) ---
  /** Ideia 03 — sazonalidade regional. */
  sindrome_ajuste?: string;
  /** Ideia 17 — meses sem movimentação, para tipo 'esquecido'. */
  meses_parado?: number;
}

export interface RespostaAlertas {
  alertas: Alerta[];
}

export interface Medicamento {
  encontrado: boolean;
  id_medicamento?: number;
  nome?: string;
  fabricante?: string;
  categoria?: string;
  // Ideias 01 e 13 — ainda não implementadas no backend.
  aviso_interacao?: string;
  situacao_regulatoria?: string;
  total_notificacoes_seguranca?: number;
}

export interface ItemHistorico {
  farmaceutico: string;
  tipo_acao: 'cadastro_lote' | 'alerta_resolvido' | 'pergunta_eva' | string;
  descricao: string;
  data_hora: string;
  /** Ideia 24 — origem da integração. */
  sistema_origem?: string;
}

export interface Fabricante {
  fabricante: string;
  /**
   * `null` quando a base é insuficiente: menos farmácias com alerta aberto
   * do que o piso mínimo do fabricante. Não é score zero — é ausência de
   * agregado. O backend prefere `null` a `0`, justamente para a tela não
   * poder confundir os dois.
   */
  score_medio: number | null;
  total_lotes: number;
}

export interface DashboardEurofarma {
  total_farmacias: number;
  dados_suficientes: boolean;
  /** null quando dados_suficientes é false — nunca exibir como 0. */
  total_desperdicio_evitado: number | null;
  total_medicamentos_preservados: number | null;
  ivf_medio: number | null;
  farmacias_anvisa_ready: number | null;
  termometro_fabricantes: Fabricante[];
}

export interface AlocacaoRegional {
  medicamento: string;
  quantidade_total: number;
  simulado: boolean;
  alocacao: { regiao: string; percentual: number }[];
}

export interface MatchRede {
  farmacia_parceira: string;
  distancia_km: number;
  medicamento_complementar: string;
  motivo: string;
  simulado: boolean;
}

export interface SolicitacaoDevolucao {
  id_solicitacao: number;
  medicamento: string;
  lote: string;
  quantidade: number;
  validade: string;
  data_solicitacao: string;
  status: 'PENDENTE' | 'ENVIADA';
}

export interface ClienteRastreado {
  cliente_cpf: string | null;
  cliente_telefone: string | null;
  data_venda: string | null;
}

/* ==========================================================================
 * Nível 2 — FEFO, Elegibilidade e Watchlist.
 *
 * Os nomes batem com o que as Functions devolvem em produção, conferidos
 * na rodada de teste de cada uma, não inferidos da especificação.
 * ========================================================================== */

/** Um lote dentro do agrupamento FEFO. Mesma forma no prioritário e nos demais. */
export interface LoteFEFO {
  id_lote: number;
  numero_lote: string;
  validade: string;   // AAAA-MM-DD
  dias_restantes: number;
  quantidade: number;
}

export interface MedicamentoFEFO {
  id_medicamento: number;
  nome: string;
  lote_prioritario: LoteFEFO;
  /** Pode ser vazio? Não: a Function descarta medicamento com menos de 2 lotes. */
  outros_lotes: LoteFEFO[];
  previsao_venda_ate_vencimento: number;
  excesso_provavel: number;
}

export interface RespostaPrioridadeDispensa {
  medicamentos: MedicamentoFEFO[];
}

/**
 * Os quatro critérios vêm SEMPRE, inclusive os que passam — é o que
 * permite a tela dizer qual falhou em vez de só "não apto".
 *
 * A tela itera sobre o que o backend mandou, não sobre esta lista fixa:
 * se um quinto critério aparecer, ele é exibido sem mudança de código.
 */
export interface CriteriosElegibilidade {
  quantidade_suficiente: boolean;
  validade_suficiente: boolean;
  categoria_permitida: boolean;
  farmacia_verificada: boolean;
}

export interface LoteAvaliado {
  id_lote: number;
  medicamento: string;
  apto: boolean;
  criterios: CriteriosElegibilidade;
}

export interface RespostaElegibilidade {
  lotes_avaliados: LoteAvaliado[];
}

export interface ItemWatchlist {
  id_watchlist: number;
  id_medicamento: number;
  nome: string;
  /** Opcional no cadastro — a farmácia pode só sinalizar interesse. */
  quantidade_desejada: number | null;
  /**
   * Vem na resposta, mas é null em todos os medicamentos hoje (nenhum tem
   * categoria preenchida). Tipado para não surpreender quando passar a vir.
   */
  categoria: string | null;
  data_criacao: string;
}

export interface RespostaWatchlist {
  itens: ItemWatchlist[];
}

export interface MatchWatchlist {
  id_medicamento: number;
  nome: string;
  quantidade_desejada: number | null;
  /**
   * Única estrutura do backend que expõe id_farmacia de outra farmácia —
   * exceção deliberada e delimitada ao recurso de redistribuição.
   * Sem nome nem contato: o fluxo de conexão entre farmácias não existe.
   */
  farmacia_com_excesso: {
    id_farmacia: number;
    id_lote: number;
    quantidade_disponivel: number;
    dias_restantes: number;
  };
}

export interface RespostaMatchesWatchlist {
  matches: MatchWatchlist[];
}
