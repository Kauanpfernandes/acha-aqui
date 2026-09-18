import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, fecharPool } from './pool.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const pastaMigrations = join(aqui, 'migrations');

/**
 * Migrations são arquivos .sql numerados. Cada um roda uma vez só e fica
 * registrado na tabela de controle. Rodar de novo não quebra nada.
 */
export async function migrar(): Promise<string[]> {
  await pool.query(`
    create table if not exists migrations_aplicadas (
      nome        text primary key,
      aplicada_em timestamptz not null default now()
    )
  `);

  const arquivos = (await readdir(pastaMigrations))
    .filter((n) => n.endsWith('.sql'))
    .sort();

  const { rows } = await pool.query<{ nome: string }>(
    'select nome from migrations_aplicadas',
  );
  const jaAplicadas = new Set(rows.map((r) => r.nome));

  const novas: string[] = [];

  for (const arquivo of arquivos) {
    if (jaAplicadas.has(arquivo)) continue;

    const sql = await readFile(join(pastaMigrations, arquivo), 'utf8');
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(sql);
      await cliente.query(
        'insert into migrations_aplicadas (nome) values ($1)',
        [arquivo],
      );
      await cliente.query('COMMIT');
      novas.push(arquivo);
    } catch (erro) {
      await cliente.query('ROLLBACK');
      throw new Error(
        `Migration ${arquivo} falhou: ${erro instanceof Error ? erro.message : erro}`,
      );
    } finally {
      cliente.release();
    }
  }

  return novas;
}

// Permite rodar direto: npm run migrate
const executadoDireto = process.argv[1]?.endsWith('migrar.ts');
if (executadoDireto) {
  migrar()
    .then((novas) => {
      if (novas.length === 0) console.log('Banco já estava em dia.');
      else console.log(`Aplicadas: ${novas.join(', ')}`);
      return fecharPool();
    })
    .catch(async (erro) => {
      console.error(erro.message ?? erro);
      await fecharPool();
      process.exit(1);
    });
}
