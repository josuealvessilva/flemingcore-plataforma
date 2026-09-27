/**
 * Mascaramento de dado pessoal — Seção 4 da especificação.
 *
 * A regra é "sempre mascarado na exibição, mesmo que o backend algum dia
 * mande o dado completo". Por isso estas funções não confiam no formato
 * de entrada: elas normalizam para dígitos e remontam mascarado. Se o
 * valor já vier mascarado do backend, o resultado é o mesmo — idempotente.
 */

/** '12345678900' ou '123.456.789-00' -> '***.456.789-**' */
export function mascararCpf(valor: string | null | undefined): string {
  if (!valor) return 'não informado';
  const digitos = valor.replace(/\D/g, '');
  // Já vinha mascarado (poucos dígitos reais) — devolve como está.
  if (digitos.length !== 11) return valor;
  return `***.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-**`;
}

/** '11987655678' ou '(11) 98765-5678' -> '(11) 9****-5678' */
export function mascararTelefone(valor: string | null | undefined): string {
  if (!valor) return '—';
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length < 10) return valor;
  const ddd = digitos.slice(0, 2);
  const fim = digitos.slice(-4);
  return `(${ddd}) 9****-${fim}`;
}
