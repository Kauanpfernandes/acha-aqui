import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { conteudo } from '../scripts/gerar-categorias-web.js';

/**
 * A tabela de categorias mora no TypeScript, e a demonstração estática baixa
 * uma cópia em JSON. Uma cópia que ninguém verifica é uma cópia que vai ficar
 * velha, então este teste é o que obriga a rodar o gerador:
 *
 *     npm run categorias:web
 */
describe('web/categorias.json', () => {
  it('está igual à tabela do TypeScript', async () => {
    const arquivo = await readFile(
      new URL('../web/categorias.json', import.meta.url),
      'utf8',
    );

    expect(arquivo.trim()).toBe(conteudo.trim());
  });
});
