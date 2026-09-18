import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { categoriaDoTermo } from '../src/integracoes/categorias.js';

/**
 * A API classifica o termo no servidor; a demonstração do GitHub Pages precisa
 * fazer o mesmo sozinha, no navegador, porque lá não existe servidor.
 *
 * A tabela de categorias as duas já dividem (web/categorias.json é gerado do
 * TypeScript). O que sobra duplicado é a função que dá a nota, e foi
 * justamente nela que apareceu a diferença: a versão do navegador usava
 * `indexOf` com aritmética para testar o fim da string, e o -1 de "não achei"
 * batia por acaso com a conta, fazendo "xpto que nao existe" virar jardinagem.
 *
 * Então o teste arranca a função de dentro do HTML e cobra dela a mesma
 * resposta que a API dá. Se as duas divergirem de novo, a suíte quebra.
 */
async function matcherDoDemo(): Promise<(t: string) => string | null> {
  const html = await readFile(new URL('../web/index.html', import.meta.url), 'utf8');
  const json = await readFile(new URL('../web/categorias.json', import.meta.url), 'utf8');

  const pedaco = (nome: string) => {
    const inicio = html.indexOf(`function ${nome}(`);
    if (inicio === -1) throw new Error(`não achei ${nome} no web/index.html`);

    // Conta chaves a partir da primeira para achar onde a função fecha.
    let nivel = 0;
    for (let i = html.indexOf('{', inicio); i < html.length; i++) {
      if (html[i] === '{') nivel++;
      else if (html[i] === '}' && --nivel === 0) return html.slice(inicio, i + 1);
    }
    throw new Error(`função ${nome} não fecha`);
  };

  const fabrica = new Function(
    'dados',
    `${pedaco('semAcento')}
     ${pedaco('categoriaDoTermo')}
     var categorias = dados.categorias;
     return function(t){ var c = categoriaDoTermo(t); return c ? c.id : null; };`,
  ) as (dados: unknown) => (t: string) => string | null;

  return fabrica(JSON.parse(json));
}

describe('a demonstração classifica o termo igual à API', () => {
  const casos = [
    'pneu',
    'pastilha de freio',
    'parafuso sextavado',
    'ração',
    'racao de gato',
    'dipirona',
    'remédio',
    'caderno',
    'óculos de grau',
    'bicicleta',
    'colchão',
    'xpto que nao existe',
    'asdfghjkl',
    'a',
  ];

  it('dá a mesma resposta nos dois lados', async () => {
    const naPagina = await matcherDoDemo();

    for (const termo of casos) {
      const naApi = categoriaDoTermo(termo)?.id ?? null;
      expect(naPagina(termo), `termo: ${termo}`).toBe(naApi);
    }
  });

  it('não inventa categoria para termo sem sentido', async () => {
    const naPagina = await matcherDoDemo();

    expect(naPagina('xpto que nao existe')).toBeNull();
    expect(categoriaDoTermo('xpto que nao existe')).toBeNull();
  });
});
