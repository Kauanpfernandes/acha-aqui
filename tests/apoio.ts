import { vi } from 'vitest';

/** Produto que o Open Food Facts devolveria para "leite condensado". */
export const PRODUTO_OFF = {
  code: '7891000100103',
  product_name: 'Leite Condensado Moça',
  brands: 'Nestlé',
  quantity: '395 g',
  image_front_small_url: 'https://exemplo.test/moca.jpg',
  categories_tags: ['en:dairies', 'en:sweetened-condensed-milks'],
  countries_tags: ['en:brazil'],
};

/** Três supermercados em Belo Horizonte, a distâncias diferentes do centro. */
export const LOJAS_OVERPASS = [
  {
    type: 'node',
    id: 1001,
    lat: -19.9235,
    lon: -43.9445,
    tags: {
      name: 'Supermercado Perto',
      shop: 'supermarket',
      'addr:street': 'Rua da Bahia',
      'addr:housenumber': '100',
      'addr:city': 'Belo Horizonte',
    },
  },
  {
    type: 'node',
    id: 1002,
    lat: -19.93,
    lon: -43.95,
    tags: { name: 'Mercado do Meio', shop: 'supermarket', 'addr:city': 'Belo Horizonte' },
  },
  {
    type: 'way',
    id: 1003,
    center: { lat: -19.945, lon: -43.96 },
    tags: { name: 'Atacado Longe', shop: 'supermarket' },
  },
];

/**
 * Lojas que não são mercado, para os testes da busca por categoria.
 *
 * A farmácia entra como `amenity=pharmacy` de propósito: é assim que ela está
 * mapeada no Brasil, e uma consulta que só olhasse `shop` acharia quatro
 * farmácias no centro de BH em vez de sessenta e cinco.
 */
export const LOJAS_AUTOPECAS = [
  {
    type: 'node',
    id: 2001,
    lat: -19.9235,
    lon: -43.9445,
    tags: { name: 'Auto Peças Central', shop: 'car_parts', 'addr:city': 'Belo Horizonte' },
  },
  {
    type: 'node',
    id: 2002,
    lat: -19.93,
    lon: -43.95,
    tags: { name: 'Oficina do Zé', shop: 'car_repair' },
  },
];

export const LOJAS_FARMACIA = [
  {
    type: 'node',
    id: 3001,
    lat: -19.9233,
    lon: -43.9448,
    tags: { name: 'Drogaria da Esquina', amenity: 'pharmacy', 'addr:city': 'Belo Horizonte' },
  },
];

interface OpcoesFalsas {
  offFalha?: boolean;
  overpassFalha?: boolean;
  /** Só o espelho principal cai, para testar se o segundo é tentado. */
  overpassPrimeiroFalha?: boolean;
  openPricesFalha?: boolean;
  produtos?: unknown[];
  lojas?: unknown[];
  precos?: unknown[];
}

/**
 * Troca o fetch global por um dublê que responde as três APIs externas.
 *
 * Testar contra a internet de verdade deixaria a suíte lenta, instável e
 * dependente de serviço de terceiro estar de pé. Aqui cada teste diz
 * exatamente o que cada fonte responde, inclusive quando ela cai.
 */
export function simularApisExternas(opcoes: OpcoesFalsas = {}) {
  const chamadas: string[] = [];
  /** O corpo de cada POST, para checar que consulta foi montada. */
  const corpos: string[] = [];

  const falso = vi.fn(async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = String(entrada);
    chamadas.push(url);
    if (typeof init?.body === 'string') corpos.push(decodeURIComponent(init.body));

    // A ordem importa: prices.openfoodfacts.org tambem contem "openfoodfacts.org".
    if (url.includes('prices.openfoodfacts')) {
      if (opcoes.openPricesFalha) throw new TypeError('fetch failed');
      return resposta({ items: opcoes.precos ?? [] });
    }

    if (url.includes('openfoodfacts.org')) {
      if (opcoes.offFalha) throw new TypeError('fetch failed');
      if (url.includes('/api/v2/product/')) {
        return resposta({ status: 1, product: PRODUTO_OFF });
      }
      return resposta({ products: opcoes.produtos ?? [PRODUTO_OFF], count: 1 });
    }

    if (url.includes('overpass')) {
      if (opcoes.overpassFalha) throw new TypeError('fetch failed');
      if (opcoes.overpassPrimeiroFalha && url.includes('overpass-api.de')) {
        throw new TypeError('fetch failed');
      }
      return resposta({ elements: opcoes.lojas ?? LOJAS_OVERPASS });
    }

    throw new Error(`URL não prevista no teste: ${url}`);
  });

  vi.stubGlobal('fetch', falso);
  return { chamadas, corpos, falso };
}

function resposta(corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Preço do Open Prices numa loja que também existe no Overpass. */
export function precoExterno(precoReais: number, osmId = 1002) {
  return {
    id: 90_000 + osmId,
    price: precoReais,
    currency: 'BRL',
    date: '2026-09-10',
    product_code: PRODUTO_OFF.code,
    location: {
      osm_type: 'NODE',
      osm_id: osmId,
      osm_name: 'Mercado do Meio',
      osm_address_city: 'Belo Horizonte',
      osm_address_country: 'Brazil',
      osm_lat: -19.93,
      osm_lon: -43.95,
    },
  };
}

/** Centro de BH, usado como "onde o usuário está" nos testes. */
export const CENTRO_BH = { lat: -19.9227, lon: -43.9451 };
