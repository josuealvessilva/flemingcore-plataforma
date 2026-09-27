/**
 * Configuração central do FlemingCore.
 *
 * A URL base substitui o placeholder 'https://[URL_DAS_FUNCTIONS]' que
 * estava no http_interceptor.dart.
 */
export const BASE_URL =
  import.meta.env.VITE_FUNCTIONS_URL ??
  'https://southamerica-east1-flemingcore-53272.cloudfunctions.net';

/** Alvo da build: 'desktop' (Electron, farmacêutico) ou 'web' (Eurofarma). */
export const EH_DESKTOP =
  typeof window !== 'undefined' && Boolean((window as never as { flemingcore?: unknown }).flemingcore);

/**
 * Modo de teste por tela — equivalente às constantes `_usarDadosFalsos`
 * espalhadas pelas telas Flutter (Seção 7 da especificação).
 *
 * `false` = tela chama o endpoint real.
 * `true`  = tela usa dado fictício local e mostra a tarja de modo de teste.
 *
 * O valor de cada uma reflete o que foi VERIFICADO no main.py em produção,
 * não suposição. Trocar para false só quando o endpoint existir de verdade.
 */
export const DADOS_FALSOS = {
  // --- Endpoints confirmados no backend (23 Functions em produção) ---
  alertas: false,              // buscar_alertas
  cadastrarLote: false,        // cadastrar_lote + buscar_medicamento
  historico: false,            // buscar_historico
  flora: false,                // eva_chat
  redeFlemingCore: false,      // sugerir_match_rede
  dashboardEurofarma: false,   // buscar_dashboard_eurofarma
  termometro: false,           // buscar_dashboard_eurofarma.termometro_fabricantes
  conformidade: false,         // buscar_dashboard_eurofarma.farmacias_anvisa_ready
  alocacaoRegional: false,     // sugerir_alocacao_regional

  // --- Nivel 2: as quatro Functions novas, testadas em producao ---
  prioridadeDispensa: false,   // buscar_prioridade_dispensa
  elegibilidade: false,        // verificar_elegibilidade_redistribuicao
  watchlist: false,            // adicionar/buscar_minha/remover/buscar_matches_watchlist

  // --- Endpoints que NÃO existem no backend (verificado no main.py) ---
  devolucoes: true,            // falta buscar_solicitacoes_devolucao / marcar_solicitacao_enviada
  relatorioAuditoria: true,    // falta gerar_relatorio_auditoria
  wrapped: true,               // falta gerar_wrapped_anual
  rastreabilidade: true,       // falta buscar_clientes_por_lote (depende da Ideia 11)
  impactoSocial: true,         // falta calcular_impacto_social
  vulnerabilidade: true,       // nenhum endpoint devolve IVF por região

  // buscar_alertas devolve exatamente 10 campos do alerta e nada mais —
  // não traz selo_ativo/indice_anvisa_ready (Ideias 07+09) nem o IVF da
  // própria farmácia (Ideia 19). Verificado no main.py.
  seloConformidade: true,
  ivfFarmacia: true,
} as const;

/**
 * Campos que o backend AINDA não retorna, verificados no main.py.
 * buscar_medicamento devolve só: encontrado, id_medicamento, nome,
 * fabricante, categoria.
 */
export const CAMPOS_PENDENTES = {
  avisoInteracao: true,        // Ideia 01 — buscar_medicamento não retorna
  situacaoRegulatoria: true,   // Ideia 13 P1 — buscar_medicamento não retorna
  notificacoesSeguranca: true, // Ideia 13 P3 — decisão de threshold pendente
} as const;

/**
 * Ideia 15 — fluxo de discrepância.
 *
 * A Function resolver_alerta lê acao_tomada com .get() e aceita
 * motivo_discrepancia sozinho: exige um dos dois, não os dois. Quando o
 * motivo vem, ele tem precedência, o lote não sofre ação e os totais da
 * farmácia não são tocados — verificado contra o banco real.
 *
 * A flag continua existindo como interruptor: se o fluxo precisar ser
 * bloqueado de novo, voltar para false desabilita o envio na interface
 * sem remover a tela.
 */
export const RESOLVER_ALERTA_ACEITA_DISCREPANCIA = true;
