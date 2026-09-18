import { env } from '../config/env.js';
import { comCache } from './cache.js';
import { buscarJson } from './httpExterno.js';

export interface PrecoExterno {
  origemId: string;
  codigoBarras: string | null;
  valor: number;
  moeda: string;
  data: string;
  local: {
    osmTipo: 'node' | 'way' | 'relation' | null;
    osmId: number | null;
    nome: string;
    cidade: string | null;
    pais: string | null;
    lat: number | null;
    lon: number | null;
  } | null;
}

interface RespostaPrecos {
  items?: Array<{
    id?: number;
    price?: number;
    currency?: string;
    date?: string;
    product_code?: string | null;
    location?: {
      osm_type?: string;
      osm_id?: number;
      osm_name?: string;
      osm_address_city?: string | null;
      osm_address_country?: string | null;
      osm_lat?: number | null;
      osm_lon?: number | null;
    } | null;
  }>;
  total?: number;
}

function converter(
  bruto: NonNullable<RespostaPrecos['items']>[number],
): PrecoExterno | null {
  if (bruto.id === undefined || typeof bruto.price !== 'number') return null;

  const l = bruto.location;
  const tipo = l?.osm_type?.toLowerCase();

  return {
    origemId: String(bruto.id),
    codigoBarras: bruto.product_code ?? null,
    valor: bruto.price,
    moeda: bruto.currency ?? 'EUR',
    data: bruto.date ?? new Date().toISOString().slice(0, 10),
    local: l
      ? {
          osmTipo:
            tipo === 'node' || tipo === 'way' || tipo === 'relation' ? tipo : null,
          osmId: l.osm_id ?? null,
          nome: l.osm_name ?? 'Loja sem nome',
          cidade: l.osm_address_city ?? null,
          pais: l.osm_address_country ?? null,
          lat: l.osm_lat ?? null,
          lon: l.osm_lon ?? null,
        }
      : null,
  };
}

/**
 * Preços já registrados para um produto, no Open Prices.
 *
 * Essa base é colaborativa e hoje é quase toda europeia — no Brasil a cobertura
 * é rala. Ela entra como ponto de partida, não como fonte principal: o que
 * sustenta o Acha Aqui é o preço que os próprios usuários registram. Por isso
 * o que vem daqui é importado para a nossa tabela `precos` com origem
 * 'openprices', e some junto com o resto nas consultas por distância.
 */
export async function precosDoProduto(
  codigoBarras: string,
  limite = 25,
): Promise<PrecoExterno[]> {
  const chave = `openprices:produto:${codigoBarras}:${limite}`;

  const { dado } = await comCache<PrecoExterno[]>(
    chave,
    env.CACHE_MINUTOS_PRECO,
    async () => {
      const url =
        `${env.OPEN_PRICES_URL}/api/v1/prices` +
        `?product_code=${encodeURIComponent(codigoBarras)}` +
        `&size=${limite}&order_by=-date`;

      const resposta = await buscarJson<RespostaPrecos>(url, {
        fonte: 'Open Prices',
      });

      return (resposta.items ?? [])
        .map(converter)
        .filter((p): p is PrecoExterno => p !== null)
        .filter((p) => p.local?.lat != null && p.local?.lon != null);
    },
  );

  return dado;
}
