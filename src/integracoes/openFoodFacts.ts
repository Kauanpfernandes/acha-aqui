import { env } from '../config/env.js';
import { comCache } from './cache.js';
import { buscarJson } from './httpExterno.js';

export interface ProdutoExterno {
  codigoBarras: string;
  nome: string;
  marca: string | null;
  quantidade: string | null;
  imagemUrl: string | null;
  categorias: string[];
  temNoBrasil: boolean;
}

interface RespostaBusca {
  count?: number;
  products?: Array<{
    code?: string;
    product_name?: string;
    product_name_pt?: string;
    brands?: string;
    quantity?: string;
    image_front_small_url?: string;
    categories_tags?: string[];
    countries_tags?: string[];
  }>;
}

const CAMPOS = [
  'code',
  'product_name',
  'product_name_pt',
  'brands',
  'quantity',
  'image_front_small_url',
  'categories_tags',
  'countries_tags',
].join(',');

function converter(bruto: NonNullable<RespostaBusca['products']>[number]): ProdutoExterno | null {
  const codigo = bruto.code?.trim();
  const nome = (bruto.product_name_pt || bruto.product_name || '').trim();
  if (!codigo || !nome) return null;

  return {
    codigoBarras: codigo,
    nome,
    marca: bruto.brands?.split(',')[0]?.trim() || null,
    quantidade: bruto.quantity?.trim() || null,
    imagemUrl: bruto.image_front_small_url || null,
    categorias: bruto.categories_tags ?? [],
    temNoBrasil: (bruto.countries_tags ?? []).includes('en:brazil'),
  };
}

/**
 * Busca produtos por nome no Open Food Facts.
 *
 * A base é mundial, então uma busca por "arroz" traz muita coisa de Espanha e
 * Portugal. Em vez de filtrar por país na query (o endpoint com filtro de país
 * é pesado e cai com frequência), pedimos um lote maior e empurramos os
 * produtos vendidos no Brasil para o topo aqui. Sai mais rápido e não depende
 * da parte instável da API.
 */
export async function buscarProdutos(
  termo: string,
  limite = 12,
): Promise<ProdutoExterno[]> {
  const termoLimpo = termo.trim().toLowerCase();
  const chave = `off:busca:${termoLimpo}:${limite}`;

  const { dado } = await comCache<ProdutoExterno[]>(
    chave,
    env.CACHE_MINUTOS_PRODUTO,
    async () => {
      const url =
        `${env.OPEN_FOOD_FACTS_URL}/cgi/search.pl` +
        `?search_terms=${encodeURIComponent(termoLimpo)}` +
        `&search_simple=1&action=process&json=1` +
        `&page_size=${Math.min(limite * 3, 50)}` +
        `&fields=${CAMPOS}`;

      const resposta = await buscarJson<RespostaBusca>(url, {
        fonte: 'Open Food Facts',
      });

      const produtos = (resposta.products ?? [])
        .map(converter)
        .filter((p): p is ProdutoExterno => p !== null);

      // Vendido no Brasil primeiro, mantendo a ordem de relevância da API dentro de cada grupo.
      const brasileiros = produtos.filter((p) => p.temNoBrasil);
      const resto = produtos.filter((p) => !p.temNoBrasil);

      return [...brasileiros, ...resto].slice(0, limite);
    },
  );

  return dado;
}

/** Busca um produto específico pelo código de barras. */
export async function buscarPorCodigoBarras(
  codigo: string,
): Promise<ProdutoExterno | null> {
  const chave = `off:codigo:${codigo}`;

  const { dado } = await comCache<ProdutoExterno | null>(
    chave,
    env.CACHE_MINUTOS_PRODUTO,
    async () => {
      const url = `${env.OPEN_FOOD_FACTS_URL}/api/v2/product/${encodeURIComponent(codigo)}?fields=${CAMPOS}`;
      const resposta = await buscarJson<{
        status?: number;
        product?: NonNullable<RespostaBusca['products']>[number];
      }>(url, { fonte: 'Open Food Facts' });

      if (resposta.status !== 1 || !resposta.product) return null;
      return converter(resposta.product);
    },
  );

  return dado;
}
