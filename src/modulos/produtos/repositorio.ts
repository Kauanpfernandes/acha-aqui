import { consultar, consultarUm } from '../../db/pool.js';
import type { ProdutoExterno } from '../../integracoes/openFoodFacts.js';

export interface Produto {
  id: string;
  codigo_barras: string | null;
  nome: string;
  marca: string | null;
  quantidade: string | null;
  imagem_url: string | null;
  categorias: string[];
  origem: string;
}

/**
 * Guarda (ou atualiza) um produto que veio do Open Food Facts.
 * O código de barras é a chave natural: o mesmo produto não entra duas vezes.
 */
export async function salvarProdutoExterno(
  externo: ProdutoExterno,
): Promise<Produto> {
  const linha = await consultarUm<Produto>(
    `insert into produtos (codigo_barras, nome, marca, quantidade, imagem_url, categorias, origem)
     values ($1, $2, $3, $4, $5, $6, 'openfoodfacts')
     on conflict (codigo_barras) do update
       set nome          = excluded.nome,
           marca         = excluded.marca,
           quantidade    = excluded.quantidade,
           imagem_url    = coalesce(excluded.imagem_url, produtos.imagem_url),
           categorias    = excluded.categorias,
           atualizado_em = now()
     returning *`,
    [
      externo.codigoBarras,
      externo.nome,
      externo.marca,
      externo.quantidade,
      externo.imagemUrl,
      externo.categorias,
    ],
  );
  return linha!;
}

export async function salvarVariosExternos(
  externos: ProdutoExterno[],
): Promise<Produto[]> {
  const salvos: Produto[] = [];
  for (const externo of externos) {
    salvos.push(await salvarProdutoExterno(externo));
  }
  return salvos;
}

export async function buscarPorId(id: string): Promise<Produto | null> {
  return consultarUm<Produto>('select * from produtos where id = $1', [id]);
}

export async function buscarPorCodigo(codigo: string): Promise<Produto | null> {
  return consultarUm<Produto>(
    'select * from produtos where codigo_barras = $1',
    [codigo],
  );
}

/**
 * Busca local por nome, tolerante a digitação torta.
 *
 * `similarity` vem do pg_trgm: compara os pedaços de três letras das duas
 * palavras. "arros integral" ainda acha "Arroz Integral", o que uma busca com
 * LIKE nunca acharia. O resultado do banco é o que responde rápido enquanto a
 * API externa ainda está sendo consultada.
 */
export async function procurarPorNome(
  termo: string,
  limite = 12,
): Promise<Produto[]> {
  return consultar<Produto>(
    `select *, similarity(nome, $1) as pontuacao
       from produtos
      where nome % $1 or nome ilike '%' || $1 || '%'
      order by pontuacao desc, nome
      limit $2`,
    [termo, limite],
  );
}
