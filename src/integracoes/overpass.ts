import { env } from '../config/env.js';
import { comCache } from './cache.js';
import { buscarJson } from './httpExterno.js';

export interface LocalExterno {
  osmTipo: 'node' | 'way' | 'relation';
  osmId: number;
  nome: string;
  tipo: string;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  lat: number;
  lon: number;
}

interface RespostaOverpass {
  elements?: Array<{
    type?: string;
    id?: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  }>;
}

/**
 * Que tipo de estabelecimento vende o quê.
 *
 * O Overpass não sabe o que é "arroz": ele sabe que um ponto no mapa é
 * `shop=supermarket`. A ponte entre o produto e o tipo de loja é esta tabela,
 * alimentada pelas categorias que o Open Food Facts devolve.
 */
const CATEGORIA_PARA_LOJA: Array<{ quando: RegExp; lojas: string[] }> = [
  {
    quando: /beverages|drinks|waters|juices|sodas/,
    lojas: ['supermarket', 'convenience', 'beverages', 'alcohol'],
  },
  {
    quando: /medicament|pharmac|dietary-supplement/,
    lojas: ['chemist', 'supermarket'],
  },
  {
    quando: /pet|cat-food|dog-food/,
    lojas: ['pet', 'supermarket'],
  },
  {
    quando: /bread|bakery|pastr|viennoiserie/,
    lojas: ['bakery', 'supermarket', 'convenience'],
  },
  {
    quando: /meat|poultry|sausage|charcuter/,
    lojas: ['butcher', 'supermarket'],
  },
  {
    quando: /fruits|vegetables|greengrocer/,
    lojas: ['greengrocer', 'supermarket'],
  },
  {
    quando: /cosmetic|hygiene|beauty|shampoo/,
    lojas: ['chemist', 'supermarket', 'cosmetics'],
  },
];

const LOJAS_PADRAO = ['supermarket', 'convenience', 'grocery', 'general'];

export function lojasParaCategorias(categorias: string[]): FiltroOsm[] {
  const texto = categorias.join(' ').toLowerCase();
  const encontradas = CATEGORIA_PARA_LOJA.filter((r) => r.quando.test(texto))
    .flatMap((r) => r.lojas);

  const lojas = [...new Set([...encontradas, ...LOJAS_PADRAO])];
  const filtros: FiltroOsm[] = [{ chave: 'shop', valores: lojas }];

  // Remédio e afins: farmácia no Brasil é amenity, não shop.
  if (/medicament|pharmac|dietary-supplement/.test(texto)) {
    filtros.push({ chave: 'amenity', valores: ['pharmacy'] });
  }

  return filtros;
}

export interface FiltroOsm {
  chave: string;
  valores: string[];
}

function montarConsulta(
  lat: number,
  lon: number,
  raioMetros: number,
  filtros: FiltroOsm[],
): string {
  // `nwr` pega nó, caminho e relação de uma vez; `out center` devolve um ponto
  // único mesmo para polígonos (um supermercado desenhado como área).
  //
  // Os filtros vão num grupo `( ... );` porque nem tudo é `shop`: farmácia no
  // Brasil está mapeada como `amenity=pharmacy`, e uma consulta que só olhasse
  // `shop` acharia 4 farmácias no centro de BH em vez de 65.
  const partes = filtros
    .filter((f) => f.valores.length > 0)
    .map(
      (f) =>
        `  nwr["${f.chave}"~"^(${f.valores.join('|')})$"](around:${raioMetros},${lat},${lon});`,
    )
    .join('\n');

  return `[out:json][timeout:25];
(
${partes}
);
out center tags 80;`;
}

function converter(
  elemento: NonNullable<RespostaOverpass['elements']>[number],
): LocalExterno | null {
  const tags = elemento.tags ?? {};
  const nome = tags['name']?.trim();
  const lat = elemento.lat ?? elemento.center?.lat;
  const lon = elemento.lon ?? elemento.center?.lon;
  const tipoOsm = elemento.type;

  if (!nome || lat === undefined || lon === undefined) return null;
  if (tipoOsm !== 'node' && tipoOsm !== 'way' && tipoOsm !== 'relation') return null;
  if (elemento.id === undefined) return null;

  const rua = tags['addr:street'];
  const numero = tags['addr:housenumber'];
  const endereco = rua ? [rua, numero].filter(Boolean).join(', ') : null;

  return {
    osmTipo: tipoOsm,
    osmId: elemento.id,
    nome,
    tipo: tags['shop'] ?? tags['amenity'] ?? 'loja',
    endereco,
    cidade: tags['addr:city'] ?? null,
    uf: tags['addr:state'] ?? null,
    lat,
    lon,
  };
}

/**
 * Lojas de determinados tipos num raio ao redor de um ponto, direto do
 * OpenStreetMap. Sem chave, sem cota, sem cartão de crédito.
 *
 * O cache aqui é longo de propósito: supermercado não muda de lugar, e o
 * Overpass é um serviço mantido por doação — martelar seria abuso.
 */
export async function lojasPorPerto(
  lat: number,
  lon: number,
  raioMetros: number,
  filtros: FiltroOsm[] = [{ chave: 'shop', valores: LOJAS_PADRAO }],
): Promise<LocalExterno[]> {
  // Arredondar a coordenada da chave (~100m) faz duas buscas quase no mesmo
  // lugar reaproveitarem o mesmo cache, em vez de gerar uma chave nova por metro.
  const assinatura = filtros
    .map((f) => `${f.chave}=${[...f.valores].sort().join('+')}`)
    .sort()
    .join(';');
  const chave = `overpass:${lat.toFixed(3)}:${lon.toFixed(3)}:${raioMetros}:${assinatura}`;

  const { dado } = await comCache<LocalExterno[]>(
    chave,
    env.CACHE_MINUTOS_LOCAL,
    async () => {
      const consulta = montarConsulta(lat, lon, raioMetros, filtros);
      const resposta = await buscarJson<RespostaOverpass>(env.OVERPASS_URL, {
        fonte: 'OpenStreetMap (Overpass)',
        metodo: 'POST',
        corpo: `data=${encodeURIComponent(consulta)}`,
        cabecalhos: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeoutMs: 25_000,
      });

      return (resposta.elements ?? [])
        .map(converter)
        .filter((l): l is LocalExterno => l !== null);
    },
  );

  return dado;
}
