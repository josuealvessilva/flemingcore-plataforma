import { useCallback, useEffect, useState } from 'react';
import { Icone } from '../components/Icone';

/**
 * Modo claro e escuro.
 *
 * A escolha fica no localStorage do navegador — é preferência de quem está
 * usando aquela máquina, não dado do sistema, então não vai para o backend.
 * Sem escolha salva, segue a preferência do sistema operacional.
 *
 * Todo acesso ao localStorage está protegido: em janela anônima ou com
 * dados de site bloqueados, ler ou escrever levanta exceção, e o app não
 * pode quebrar por causa de um botão de tema.
 *
 * O estado é de módulo, não de componente: o botão do tema aparece no login
 * e na sidebar, e duas cópias de useState se desencontrariam na primeira
 * troca. Aqui todos os assinantes recebem o mesmo valor.
 */
export type Tema = 'claro' | 'escuro';

const CHAVE = 'flemingcore.tema';

function temaSalvo(): Tema | null {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'claro' || v === 'escuro' ? v : null;
  } catch {
    return null;
  }
}

function temaDoSistema(): Tema {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
  } catch {
    return 'claro';
  }
}

let temaAtual: Tema = temaSalvo() ?? temaDoSistema();
const assinantes = new Set<(t: Tema) => void>();

export function aplicarTema(tema: Tema) {
  temaAtual = tema;
  document.documentElement.dataset.tema = tema;
  // Pinta a barra do navegador/janela junto com o app.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', tema === 'escuro' ? '#020A14' : '#0F2438');
  assinantes.forEach((fn) => fn(tema));
}

/** Chamado uma vez na subida do app, antes de renderizar. */
export function iniciarTema() {
  aplicarTema(temaAtual);

  // Enquanto ninguém escolheu manualmente, acompanha o sistema em tempo real.
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', (e) => {
      if (!temaSalvo()) aplicarTema(e.matches ? 'escuro' : 'claro');
    });
  } catch {
    // Navegador sem matchMedia: fica no tema já aplicado.
  }
}

/** Estado do tema + função para alternar. */
export function useTema(): [Tema, () => void] {
  const [tema, setTema] = useState<Tema>(temaAtual);

  useEffect(() => {
    assinantes.add(setTema);
    setTema(temaAtual);
    return () => {
      assinantes.delete(setTema);
    };
  }, []);

  const alternar = useCallback(() => {
    const novo: Tema = temaAtual === 'escuro' ? 'claro' : 'escuro';
    aplicarTema(novo);
    try {
      localStorage.setItem(CHAVE, novo);
    } catch {
      // Sem persistência disponível: o tema vale só para esta sessão.
    }
  }, []);

  return [tema, alternar];
}

/**
 * Botão de alternância.
 *
 * `sobreEscuro` existe porque a sidebar é escura nos dois modos: lá o botão
 * precisa da borda clara, senão some no fundo marinho.
 */
export function BotaoTema({ sobreEscuro = false }: { sobreEscuro?: boolean }) {
  const [tema, alternar] = useTema();
  const indoPara = tema === 'escuro' ? 'claro' : 'escuro';
  return (
    <button
      type="button"
      onClick={alternar}
      className={`fc-tema${sobreEscuro ? ' fc-tema--escura' : ''}`}
      aria-label={`Mudar para o modo ${indoPara}`}
      title={`Mudar para o modo ${indoPara}`}
    >
      <Icone nome={tema === 'escuro' ? 'sun' : 'moon'} tamanho={15} />
      <span>{tema === 'escuro' ? 'Claro' : 'Escuro'}</span>
    </button>
  );
}
