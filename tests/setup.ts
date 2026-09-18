import { afterAll, beforeAll, beforeEach } from 'vitest';
import { migrar } from '../src/db/migrar.js';
import { fecharPool, pool } from '../src/db/pool.js';

beforeAll(async () => {
  await migrar();
});

/**
 * Cada teste começa com o banco limpo. `truncate ... cascade` derruba as
 * dependências junto e `restart identity` zera as sequências, então um teste
 * nunca enxerga o lixo do anterior.
 */
beforeEach(async () => {
  await pool.query(
    'truncate precos, produtos, locais, usuarios, cache_externo restart identity cascade',
  );
});

afterAll(async () => {
  await fecharPool();
});
