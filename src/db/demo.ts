import { emTransacao } from './pool.js';

export const PRODUTO_DEMO = 'de000000-0000-4000-8000-000000000001';
export const LOCAIS_DEMO = [
  'de000000-0000-4000-8000-000000000002',
  'de000000-0000-4000-8000-000000000003',
] as const;

/** Dados sintéticos, sem contas, credenciais compartilhadas ou chamadas externas. */
export async function prepararDemo(): Promise<void> {
  await emTransacao(async (cliente) => {
    await cliente.query(
      `insert into produtos (id, nome, marca, quantidade, origem)
       values ($1, 'Arroz DEMO (fictício)', 'Marca de demonstração', '1 kg', 'usuario')
       on conflict (id) do nothing`, [PRODUTO_DEMO],
    );
    for (const [i, id] of LOCAIS_DEMO.entries()) {
      await cliente.query(
        `insert into locais (id, nome, tipo, cidade, uf, geom)
         values ($1, $2, 'supermarket', 'Belo Horizonte', 'MG',
                 ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography)
         on conflict (id) do nothing`,
        [id, `Mercado DEMO ${i + 1} (fictício)`, -43.9451 + i * 0.003, -19.9235 - i * 0.002],
      );
      await cliente.query(
        `insert into precos (id, produto_id, local_id, valor, data, origem)
         values ($1, $2, $3, $4, '2026-01-01', 'usuario')
         on conflict (id) do nothing`,
        [`de000000-0000-4000-8000-00000000000${i + 4}`, PRODUTO_DEMO, id, i === 0 ? 6.49 : 5.99],
      );
    }
  });
}
