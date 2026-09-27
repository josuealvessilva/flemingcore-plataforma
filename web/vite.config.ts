import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Roteamento do site no servidor de desenvolvimento.
 *
 * Em produção o layout de arquivos resolve isso sozinho (ver
 * scripts/organizar-web.mjs): a landing vira o index.html da raiz e o app
 * vai para /app/index.html. O servidor do Vite não sabe disso — ele serve
 * o app na raiz e a landing em /site/index.html.
 *
 * Este middleware reescreve as duas rotas para que desenvolvimento e
 * produção tenham exatamente o mesmo endereço: `/` é a landing e `/app` é
 * o login. Sem ele, um link testado aqui quebraria lá (ou o contrário).
 */
function rotasDoSiteEmDesenvolvimento(): Plugin {
  return {
    name: 'flemingcore-rotas-dev',
    configureServer(server) {
      // Registrado direto (sem retornar função): assim roda ANTES dos
      // middlewares internos do Vite, que é quem serve os dois html.
      server.middlewares.use((req, _res, next) => {
        const [caminho, busca] = (req.url ?? '/').split('?');
        const query = busca ? `?${busca}` : '';
        if (caminho === '/') {
          req.url = `/site/index.html${query}`;
        } else if (caminho === '/app' || caminho === '/app/') {
          req.url = `/index.html${query}`;
        }
        next();
      });
    },
  };
}

// base './' é obrigatório para o Electron: o app empacotado carrega o
// index.html via file://, e caminhos absolutos ('/assets/...') quebram.
// A build web (mode 'web') usa '/' normalmente.
export default defineConfig(({ mode }) => ({
  plugins: [react(), rotasDoSiteEmDesenvolvimento()],
  base: mode === 'web' ? '/' : './',
  build: {
    outDir: mode === 'web' ? 'dist-web' : 'dist',
    emptyOutDir: true,
  },
}));
