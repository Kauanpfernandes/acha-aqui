import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIAS } from '../src/integracoes/categorias.js';

/**
 * A demonstração do GitHub Pages não tem servidor, então ela precisa da mesma
 * tabela de categorias que a API usa. Copiar a tabela na mão para dentro do
 * HTML seria garantia de as duas divergirem na primeira mudança.
 *
 * Então a tabela mora num lugar só, aqui no TypeScript, e este script gera o
 * JSON que a página baixa. O teste `categorias-web.test.ts` falha se alguém
 * mexer na tabela e esquecer de rodar isto.
 */
const aqui = dirname(fileURLToPath(import.meta.url));
const destino = join(aqui, '..', 'web', 'categorias.json');

export const conteudo = JSON.stringify(
  {
    _comentario:
      'Gerado por scripts/gerar-categorias-web.ts a partir de src/integracoes/categorias.ts. Não edite na mão.',
    categorias: CATEGORIAS,
  },
  null,
  2,
);

// `import.meta.url` bate com o argumento só quando o arquivo foi executado
// direto, e não importado pelo teste. É o que deixa os dois usarem a mesma
// função sem o teste sair escrevendo arquivo.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  await writeFile(destino, conteudo + '\n', 'utf8');
  console.log(`Categorias gravadas em web/categorias.json (${CATEGORIAS.length} categorias)`);
}
