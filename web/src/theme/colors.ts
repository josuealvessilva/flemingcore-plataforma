/**
 * Paleta central — porte do app_colors.dart.
 *
 * Farmacêutico e Eurofarma são experiências visuais distintas (Seção 1),
 * não o mesmo app com a cor trocada: cada um tem seu próprio conjunto de
 * acento, mantendo a base compartilhada.
 *
 * Cores de status (vermelho = risco, laranja = atenção, verde = ok) são
 * semânticas — sistema de farol — e não mudam entre as duas áreas.
 *
 * MUDANÇA DE 26/09/2026 — modo claro e escuro: cada valor aqui virou uma
 * variável CSS declarada em theme/estilos.css, em vez do hexadecimal fixo.
 * As chaves e o significado continuam iguais, então todas as telas que já
 * liam `cores.primary` passaram a acompanhar o tema sem precisar mudar.
 * Os hexadecimais de cada modo estão no estilos.css, com a origem de cada um.
 *
 * CUIDADO: como o valor agora é `var(--x)`, não dá mais para concatenar
 * transparência no fim (`${cores.primary}14`). Use
 * `color-mix(in srgb, ${cores.primary} 8%, transparent)`.
 */
export const cores = {
  sidebarBg: 'var(--marinho)',
  primary: 'var(--primaria)',
  primaryDark: 'var(--primaria-forte)',
  primaryLight: 'var(--primaria-suave)',
  sidebarItemAtivo: 'rgba(255, 255, 255, 0.11)',

  // Acento próprio da Eurofarma — o login já usava laranja para
  // diferenciar o tipo de usuário.
  eurofarmaAccent: 'var(--eurofarma)',
  eurofarmaAccentLight: 'var(--eurofarma-suave)',

  risco: 'var(--risco)',
  atencao: 'var(--atencao)',
  ok: 'var(--ok)',
  neutro: 'var(--neutro)',
  neutroClaro: 'var(--superficie-3)',
  borda: 'var(--linha)',
  aviso: 'var(--aviso-fundo)',

  // Acrescentados junto com o modo escuro. Antes cada tela escrevia '#fff'
  // e '#9E9E9E' direto no style, o que ficava branco sobre branco no escuro.
  superficie: 'var(--superficie)',
  superficieAlt: 'var(--superficie-2)',
  fundo: 'var(--fundo)',
  texto: 'var(--texto)',
  textoSuave: 'var(--texto-suave)',
  /** Texto sobre um fundo de acento (primária, risco, laranja). */
  sobreAcento: 'var(--texto-sobre-acento)',
  desabilitado: 'var(--desabilitado)',
  trilho: 'var(--trilho)',
} as const;
