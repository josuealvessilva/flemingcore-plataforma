import type { TipoUsuario } from './auth';

/**
 * Notificação nativa — porte do notification_service.dart.
 *
 * Regra: SÓ para farmacêutico, nunca para Eurofarma (Seção 4).
 * A checagem de tipo fica aqui, não na tela, para não haver caminho
 * acidental de habilitar no lado errado.
 */

interface PonteDesktop {
  ehDesktop: boolean;
  notificar: (titulo: string, corpo: string) => Promise<void>;
}

function ponte(): PonteDesktop | null {
  const w = window as never as { flemingcore?: PonteDesktop };
  return w.flemingcore ?? null;
}

let habilitado = false;

export function iniciarNotificacoes(tipo: TipoUsuario): void {
  if (tipo !== 'FARMACEUTICO') return; // Eurofarma nunca recebe
  if (!ponte()) return;                // build web não tem notificação nativa
  habilitado = true;
}

export function pararNotificacoes(): void {
  habilitado = false;
}

export async function notificar(titulo: string, corpo: string): Promise<void> {
  if (!habilitado) return;
  await ponte()?.notificar(titulo, corpo);
}
