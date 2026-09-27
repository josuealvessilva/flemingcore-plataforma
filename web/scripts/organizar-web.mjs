/**
 * Arruma a saída da build web para o endereço que o produto usa:
 *
 *   /       → landing page
 *   /app    → login e o resto do app
 *
 * Feito movendo arquivo, não com regra de reescrita do provedor: assim o
 * caminho funciona igual em qualquer hospedagem estática, e não depende de
 * o Vercel avaliar rewrite antes ou depois de procurar o arquivo no disco
 * (ele procura o arquivo primeiro — um rewrite de "/" seria ignorado,
 * porque /index.html existe).
 *
 * Antes:  dist-web/index.html (app)      dist-web/site/index.html (landing)
 * Depois: dist-web/app/index.html (app)  dist-web/index.html      (landing)
 *
 * Os dois html apontam para os próprios assets por caminho absoluto
 * (/assets/… e /site/assets/…), então mover o html não quebra referência.
 */
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SAIDA = 'dist-web';

async function existe(caminho) {
  try {
    await access(caminho);
    return true;
  } catch {
    return false;
  }
}

const appHtml = join(SAIDA, 'index.html');
const landingHtml = join(SAIDA, 'site', 'index.html');

for (const necessario of [appHtml, landingHtml]) {
  if (!(await existe(necessario))) {
    console.error(`[organizar-web] faltando: ${necessario}`);
    process.exit(1);
  }
}

await mkdir(join(SAIDA, 'app'), { recursive: true });
await rename(appHtml, join(SAIDA, 'app', 'index.html'));

// A landing vira a raiz. Cópia por leitura/escrita e o original é apagado:
// dois endereços para a mesma página confundiriam buscador e histórico.
await writeFile(appHtml, await readFile(landingHtml));
await rm(landingHtml);

console.log('[organizar-web] / = landing, /app = app');
