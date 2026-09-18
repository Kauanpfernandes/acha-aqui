import pg from 'pg';
import { env } from '../config/env.js';

/**
 * Postgres devolve NUMERIC como string por padrão, para não perder precisão.
 * Preço aqui cabe folgado em double, e a API fica bem mais simples de consumir
 * se o JSON vier com número em vez de string.
 */
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (valor) => Number(valor));

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (erro) => {
  console.error('Erro em conexão ociosa do Postgres:', erro);
});

export async function consultar<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  valores: unknown[] = [],
): Promise<T[]> {
  const resultado = await pool.query<T>(sql, valores);
  return resultado.rows;
}

export async function consultarUm<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  valores: unknown[] = [],
): Promise<T | null> {
  const linhas = await consultar<T>(sql, valores);
  return linhas[0] ?? null;
}

/** Roda um bloco dentro de uma transação, com rollback automático em caso de erro. */
export async function emTransacao<T>(
  bloco: (cliente: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await bloco(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

export async function fecharPool(): Promise<void> {
  await pool.end();
}
