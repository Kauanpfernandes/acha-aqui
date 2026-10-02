import { Router } from 'express';
import { LOCAIS_DEMO, PRODUTO_DEMO } from '../../db/demo.js';
import { consultar } from '../../db/pool.js';
import { assincrona } from '../../middlewares/erros.js';

export const rotasDemo = Router();

rotasDemo.get('/demo', assincrona(async (_req, res) => {
  const itens = await consultar(
    `select l.nome, p.valor, p.moeda, p.data::text,
            round(ST_Distance(l.geom,
              ST_SetSRID(ST_MakePoint(-43.9451, -19.9227), 4326)::geography)::numeric) as distancia_metros
       from precos p join locais l on l.id = p.local_id
      where p.produto_id = $1 and l.id = any($2::uuid[])
      order by p.valor, distancia_metros`,
    [PRODUTO_DEMO, LOCAIS_DEMO],
  );
  res.json({
    demonstracao: true,
    aviso: 'Lojas, produto e preços fictícios. Não são ofertas reais.',
    produto: { id: PRODUTO_DEMO, nome: 'Arroz DEMO (fictício)' },
    origem: 'PostgreSQL + PostGIS: consulta real, sem serviços externos',
    itens,
  });
}));
