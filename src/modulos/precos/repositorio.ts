import { consultar, consultarUm } from '../../db/pool.js';

export interface Preco {
  id: string;
  produto_id: string;
  local_id: string;
  usuario_id: string | null;
  valor: number;
  moeda: string;
  data: string;
  foto_url: string | null;
  origem: string;
}

export interface OfertaPerto {
  local_id: string;
  local_nome: string;
  local_tipo: string;
  endereco: string | null;
  cidade: string | null;
  lat: number;
  lon: number;
  distancia_metros: number;
  valor: number | null;
  moeda: string | null;
  data: string | null;
  origem: string | null;
}

export async function registrar(dados: {
  produtoId: string;
  localId: string;
  usuarioId: string | null;
  valor: number;
  moeda?: string;
  data?: string;
  fotoUrl?: string | null;
  origem?: 'usuario' | 'openprices';
  origemId?: string | null;
}): Promise<Preco> {
  const linha = await consultarUm<Preco>(
    `insert into precos
       (produto_id, local_id, usuario_id, valor, moeda, data, foto_url, origem, origem_id)
     values ($1, $2, $3, $4, $5, coalesce($6::date, current_date), $7, $8, $9)
     on conflict (produto_id, local_id, usuario_id, data) do update
       set valor = excluded.valor,
           foto_url = coalesce(excluded.foto_url, precos.foto_url)
     returning *`,
    [
      dados.produtoId,
      dados.localId,
      dados.usuarioId,
      dados.valor,
      dados.moeda ?? 'BRL',
      dados.data ?? null,
      dados.fotoUrl ?? null,
      dados.origem ?? 'usuario',
      dados.origemId ?? null,
    ],
  );
  return linha!;
}

/** Importa preço do Open Prices sem duplicar o mesmo registro na segunda rodada. */
export async function importarExterno(dados: {
  produtoId: string;
  localId: string;
  valor: number;
  moeda: string;
  data: string;
  origemId: string;
}): Promise<void> {
  await consultar(
    `insert into precos (produto_id, local_id, usuario_id, valor, moeda, data, origem, origem_id)
     values ($1, $2, null, $3, $4, $5::date, 'openprices', $6)
     on conflict (origem, origem_id) where origem_id is not null
       do nothing`,
    [dados.produtoId, dados.localId, dados.valor, dados.moeda, dados.data, dados.origemId],
  );
}

/**
 * A consulta que responde a pergunta do app: onde eu acho este produto perto
 * de mim, e por quanto.
 *
 * Devolve TODA loja dentro do raio, não só as que têm preço. Loja sem preço
 * vem com valor nulo e ainda é útil: é onde provavelmente tem o produto, e é
 * onde o próximo usuário pode registrar quanto custou.
 *
 * O `distinct on` pega, para cada loja, só o preço mais recente — sem isso a
 * mesma loja apareceria uma vez por registro histórico.
 */
export async function ofertasPerto(params: {
  produtoId: string;
  lat: number;
  lon: number;
  raioMetros: number;
  limite?: number;
}): Promise<OfertaPerto[]> {
  const { produtoId, lat, lon, raioMetros, limite = 30 } = params;

  return consultar<OfertaPerto>(
    `with ponto as (
       select ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography as g
     ),
     perto as (
       select l.id, l.nome, l.tipo, l.endereco, l.cidade,
              ST_Y(l.geom::geometry) as lat,
              ST_X(l.geom::geometry) as lon,
              round(ST_Distance(l.geom, ponto.g)::numeric) as distancia_metros
         from locais l, ponto
        where ST_DWithin(l.geom, ponto.g, $4)
        order by l.geom <-> ponto.g
        limit $5
     ),
     recente as (
       select distinct on (p.local_id)
              p.local_id, p.valor, p.moeda, p.data, p.origem
         from precos p
        where p.produto_id = $1
          and p.local_id in (select id from perto)
        order by p.local_id, p.data desc, p.criado_em desc
     )
     select perto.id   as local_id,
            perto.nome as local_nome,
            perto.tipo as local_tipo,
            perto.endereco,
            perto.cidade,
            perto.lat,
            perto.lon,
            perto.distancia_metros,
            recente.valor,
            recente.moeda,
            recente.data::text,
            recente.origem
       from perto
       left join recente on recente.local_id = perto.id
      order by (recente.valor is null), recente.valor asc, perto.distancia_metros asc`,
    [produtoId, lat, lon, raioMetros, limite],
  );
}

export async function historicoDoProduto(
  produtoId: string,
  limite = 50,
): Promise<Preco[]> {
  return consultar<Preco>(
    `select * from precos where produto_id = $1 order by data desc, criado_em desc limit $2`,
    [produtoId, limite],
  );
}
