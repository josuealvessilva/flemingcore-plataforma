import { useState } from 'react';
import { entrar, ErroLogin, type ClaimsFlemingCore, type TipoUsuario } from '../../services/auth';
import { BotaoTema } from '../../theme/tema';
import { Marca } from '../../components/Marca';
import { Icone } from '../../components/Icone';

/**
 * Login com dois tipos de usuário — porte do login_screen.dart.
 *
 * A base de autenticação é compartilhada entre farmacêutico e Eurofarma
 * (Seção 1); o que muda é a cor de acento de cada opção, sinalizando as
 * duas experiências visuais distintas.
 *
 * Visual refeito em 26/09/2026. A regra de autenticação não mudou em nada:
 * mesma função `entrar`, mesmos estados, mesmas mensagens de erro. O que
 * mudou é a apresentação — painel de marca à esquerda com a logomarca, e
 * o formulário à direita. Em tela estreita o painel vira um cabeçalho.
 */

const TIPOS: { valor: TipoUsuario; icone: string; nome: string; desc: string; acento: string }[] = [
  {
    valor: 'FARMACEUTICO',
    icone: 'pill',
    nome: 'Farmacêutico',
    desc: 'Estoque, alertas e Flora',
    acento: 'var(--primaria)',
  },
  {
    valor: 'EUROFARMA',
    icone: 'factory',
    nome: 'Eurofarma',
    desc: 'Painel da indústria',
    acento: 'var(--eurofarma)',
  },
];

export function LoginScreen({ onEntrou }: { onEntrou: (c: ClaimsFlemingCore) => void }) {
  const [tipo, setTipo] = useState<TipoUsuario | null>(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const camposVazios = !email || !senha || !tipo;

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (camposVazios || carregando) return;
    setCarregando(true);
    setErro(null);
    try {
      onEntrou(await entrar(email, senha, tipo));
    } catch (err) {
      setErro(err instanceof ErroLogin ? err.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="fc-login">
      <aside className="fc-login__marca">
        <Marca tamanho={46} sobreEscuro />

        {/* O texto é o mesmo da landing page, de propósito: quem chega pelo
            site encontra aqui a mesma frase, não outra promessa. */}
        <div>
          <h1 className="fc-login__titulo">
            Menos perdas. Mais controle. Um estoque farmacêutico mais inteligente.
          </h1>
          <p className="fc-login__sub">
            O FlemingCore transforma dados de estoque, validade e giro em decisões
            inteligentes para reduzir perdas e evitar rupturas.
          </p>

          <ul className="fc-login__pontos">
            <li className="fc-login__ponto">
              <Icone nome="chart-column" tamanho={14} />
              <span>Visão consolidada</span>
            </li>
            <li className="fc-login__ponto">
              <Icone nome="bell" tamanho={14} />
              <span>Alertas preventivos</span>
            </li>
            <li className="fc-login__ponto">
              <Icone nome="network" tamanho={14} />
              <span>Decisão em rede</span>
            </li>
          </ul>
        </div>

        {/* A landing é a raiz do site; o app vive em /app. Em produção isso
            vem do layout de arquivos (scripts/organizar-web.mjs) e, no
            desenvolvimento, do middleware do vite.config.ts. */}
        <a className="fc-login__creditos" href="/">
          <Icone nome="arrow-right" tamanho={15} estilo={{ transform: 'rotate(180deg)' }} />
          Conhecer o FlemingCore
        </a>
      </aside>

      <main className="fc-login__painel">
        <form onSubmit={submeter} className="fc-login__forma">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
            <BotaoTema />
          </div>

          <h2 style={{ fontSize: 26, marginBottom: 4 }}>Entrar</h2>
          <p style={{ color: 'var(--texto-suave)', fontSize: 14, marginBottom: 22 }}>
            Escolha o seu acesso e use as credenciais do FlemingCore.
          </p>

          <div role="group" aria-label="Tipo de acesso" className="fc-tipo" style={{ marginBottom: 20 }}>
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                type="button"
                onClick={() => setTipo(t.valor)}
                aria-pressed={tipo === t.valor}
                aria-label={`Entrar como ${t.nome}`}
                className="fc-tipo__op"
                style={{ '--acento-tipo': t.acento } as React.CSSProperties}
              >
                <span className="fc-tipo__icone" style={{ color: t.acento }}><Icone nome={t.icone} tamanho={18} /></span>
                <span className="fc-tipo__nome">{t.nome}</span>
                <span className="fc-tipo__desc">{t.desc}</span>
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="email" className="fc-rotulo">E-mail</label>
            <input
              id="email" type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="fc-campo" placeholder="voce@farmacia.com.br"
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label htmlFor="senha" className="fc-rotulo">Senha</label>
            <div className="fc-senha">
              <input
                id="senha" type={senhaVisivel ? 'text' : 'password'} autoComplete="current-password"
                value={senha} onChange={(e) => setSenha(e.target.value)}
                className="fc-campo" placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setSenhaVisivel((v) => !v)}
                aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
                className="fc-olho"
              >
                <Icone nome={senhaVisivel ? 'eye-off' : 'eye'} tamanho={17} />
              </button>
            </div>
          </div>

          {erro && (
            <p role="alert" aria-live="assertive" className="fc-erro" style={{ marginBottom: 16 }}>
              <Icone nome="triangle-alert" tamanho={16} />
              <span>{erro}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={camposVazios || carregando}
            aria-label={
              camposVazios
                ? 'Botão Entrar desabilitado — preencha email, senha e tipo de usuário'
                : carregando ? 'Entrando' : 'Entrar no sistema'
            }
            className="fc-botao fc-botao--primario fc-botao--bloco"
            style={{ padding: '13px 18px', fontSize: 15 }}
          >
            {carregando ? (
              <>
                <span className="fc-pulso" aria-hidden="true"><i /><i /><i /></span>
                Entrando
              </>
            ) : 'Entrar'}
          </button>

          {camposVazios && !erro && (
            <p style={{ fontSize: 12.5, color: 'var(--texto-fraco)', marginTop: 12, textAlign: 'center' }}>
              Escolha o tipo de acesso e preencha e-mail e senha para continuar.
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
