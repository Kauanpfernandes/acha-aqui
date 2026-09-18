import { consultar, consultarUm } from '../../db/pool.js';
import type { LocalExterno } from '../../integracoes/overpass.js';

export interface Local {
  id: string;
  osm_tipo: string | null;
  osm_id: string | null;
  nome: string;
  tipo: string;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
}

export interface LocalComDistancia extends Local {
  lat: number;
  lon: number;
  distancia_metros: number;
}

/**
 * Salva uma loja vinda do OpenStreetMap. O par (tipo, id) do OSM é a chave:
 * a mesma loja importada de novo atualiza em vez de duplicar.
 */
export async function salvarLocalExterno(externo: LocalExterno): Promise<Local> {
  const linha = await consultarUm<Local>(
    `insert into locais (osm_tipo, osm_id, nome, tipo, endereco, cidade, uf, geom)
     values ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326)::geography)
     on conflict (osm_tipo, osm_id) do update
       set nome     = excluded.nome,
           tipo     = excluded.tipo,
           endereco = coalesce(excluded.endereco, locais.endereco),
           cidade   = coalesce(excluded.cidade, locais.cidade),
           uf       = coalesce(excluded.uf, locais.uf),
           geom     = excluded.geom
     returning id, osm_tipo, osm_id::text, nome, tipo, endereco, cidade, uf`,
    [
      externo.osmTipo,
      externo.osmId,
      externo.nome,
      externo.tipo,
      externo.endereco,
      externo.cidade,
      externo.uf,
      externo.lon, // ST_MakePoint é (x, y) = (longitude, latitude). Trocar aqui
      externo.lat, // joga a loja para o outro lado do mundo.
    ],
  );
  return linha!;
}

export async function salvarVariosExternos(
  externos: LocalExterno[],
): Promise<Local[]> {
  const salvos: Local[] = [];
  for (const externo of externos) {
    salvos.push(await salvarLocalExterno(externo));
  }
  return salvos;
}

/**
 * Lojas dentro de um raio, da mais perto para a mais longe.
 *
 * `ST_DWithin` em coluna `geography` usa o índice GiST e calcula distância
 * sobre a esfera, em metros. É o que faz isso continuar rápido com a tabela
 * grande, em vez de calcular a distância de todas as linhas para depois filtrar.
 */
export async function porPerto(
  lat: number,
  lon: number,
  raioMetros: number,
  limite = 50,
  tipos: string[] | null = null,
): Promise<LocalComDistancia[]> {
  // O filtro por tipo entra no SQL, e não depois em JavaScript, porque o
  // `limit` corta antes: filtrar em memória as 50 mais próximas devolveria
  // zero auto peças num centro cheio de padaria.
  return consultar<LocalComDistancia>(
    `with ponto as (
       select ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography as g
     )
     select l.id, l.osm_tipo, l.osm_id::text, l.nome, l.tipo,
            l.endereco, l.cidade, l.uf,
            ST_Y(l.geom::geometry) as lat,
            ST_X(l.geom::geometry) as lon,
            round(ST_Distance(l.geom, ponto.g)::numeric) as distancia_metros
       from locais l, ponto
      where ST_DWithin(l.geom, ponto.g, $3)
        and ($5::text[] is null or l.tipo = any($5))
      order by l.geom <-> ponto.g
      limit $4`,
    [lat, lon, raioMetros, limite, tipos],
  );
}

export async function buscarPorOsm(
  osmTipo: string,
  osmId: number,
): Promise<Local | null> {
  return consultarUm<Local>(
    `select id, osm_tipo, osm_id::text, nome, tipo, endereco, cidade, uf
       from locais where osm_tipo = $1 and osm_id = $2`,
    [osmTipo, osmId],
  );
}

export async function buscarPorId(id: string): Promise<Local | null> {
  return consultarUm<Local>(
    `select id, osm_tipo, osm_id::text, nome, tipo, endereco, cidade, uf
       from locais where id = $1`,
    [id],
  );
}

/** Cadastro manual, para loja que não existe no OpenStreetMap. */
export async function criarLocalManual(dados: {
  nome: string;
  tipo?: string;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  lat: number;
  lon: number;
}): Promise<Local> {
  const linha = await consultarUm<Local>(
    `insert into locais (nome, tipo, endereco, cidade, uf, geom)
     values ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography)
     returning id, osm_tipo, osm_id::text, nome, tipo, endereco, cidade, uf`,
    [
      dados.nome,
      dados.tipo ?? 'loja',
      dados.endereco ?? null,
      dados.cidade ?? null,
      dados.uf ?? null,
      dados.lon,
      dados.lat,
    ],
  );
  return linha!;
}
