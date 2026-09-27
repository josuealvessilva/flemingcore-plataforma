import type { CSSProperties } from 'react';
import { BotaoTema } from '../theme/tema';
import { Marca } from './Marca';
import { Icone } from './Icone';

export interface ItemNav {
  id: string;
  label: string;
  icone: string;
  /** Contagem exibida como badge (só quando > 0). */
  badge?: number;
}

/**
 * Sidebar compartilhada pelas duas áreas — porte de
 * sidebar_farmaceutico.dart e sidebar_eurofarma.dart.
 *
 * A base é a mesma; a identidade visual muda pela cor de acento, que cada
 * layout passa (Seção 1: mesma base de autenticação, experiências visuais
 * distintas). O acento entra como variável CSS (`--acento-area`), então o
 * item ativo e o rótulo da área acompanham a área sem prop nova.
 *
 * Ela fica ESCURA nos dois modos, de propósito: a logomarca tem o texto
 * branco e só se lê sobre fundo escuro. É também o padrão de navegação
 * lateral que o app já usava.
 */
export function Sidebar({
  itens, paginaAtiva, onNavegar, nomeUsuario, acento, onSair,
}: {
  itens: ItemNav[];
  paginaAtiva: string;
  onNavegar: (id: string) => void;
  nomeUsuario: string;
  acento: string;
  onSair: () => void;
}) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fc-sidebar"
      style={{ '--acento-area': acento } as CSSProperties}
    >
      <div className="fc-sidebar__marca">
        <Marca tamanho={28} sobreEscuro />
      </div>

      <ul className="fc-sidebar__lista">
        {itens.map((item) => {
          const ativo = paginaAtiva === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onNavegar(item.id)}
                aria-current={ativo ? 'page' : undefined}
                aria-label={
                  item.badge
                    ? `${item.label}, ${item.badge} pendente${item.badge > 1 ? 's' : ''}`
                    : item.label
                }
                className="fc-sidebar__item"
              >
                <Icone nome={item.icone} tamanho={17} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span aria-hidden="true" className="fc-sidebar__badge">{item.badge}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="fc-sidebar__rodape">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <span
            aria-hidden="true"
            style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'color-mix(in srgb, var(--acento-area) 26%, transparent)',
              border: '1px solid color-mix(in srgb, var(--acento-area) 55%, transparent)',
              color: '#fff', fontSize: 13, fontWeight: 700,
            }}
          >
            {nomeUsuario.charAt(0)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
              {nomeUsuario}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Sessão ativa</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BotaoTema sobreEscuro />
          <button
            type="button"
            onClick={onSair}
            className="fc-tema fc-tema--escura"
            style={{ color: '#FF9A9A' }}
            aria-label="Sair da sessão"
          >
            <Icone nome="log-out" tamanho={14} />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
