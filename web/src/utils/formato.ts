/** Formatação pt-BR — equivalente ao intl/NumberFormat do Flutter. */

const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

export function formatarReais(valor: number | null | undefined): string {
  if (valor == null) return '—';
  return MOEDA.format(valor);
}

export function formatarNumero(valor: number | null | undefined): string {
  if (valor == null) return '—';
  return new Intl.NumberFormat('pt-BR').format(valor);
}

/** Dias entre hoje e uma validade 'AAAA-MM-DD'. */
export function calcularDiasRestantes(validade: string): number {
  const alvo = new Date(`${validade}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

export function dataParaIso(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

/**
 * Prioridade legível a partir do score — Seção 10.
 *
 * "Score: 85" é número técnico; o farmacêutico decide por urgência. O
 * número continua disponível como detalhe secundário, não some.
 */
export function prioridadePorScore(score: number): {
  rotulo: string;
  nivel: 'critica' | 'atencao' | 'baixa';
} {
  if (score >= 70) return { rotulo: 'Prioridade Crítica', nivel: 'critica' };
  if (score >= 40) return { rotulo: 'Prioridade Média', nivel: 'atencao' };
  return { rotulo: 'Prioridade Baixa', nivel: 'baixa' };
}
