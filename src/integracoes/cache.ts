import { consultarUm, pool } from '../db/pool.js';

/**
 * Cache simples em cima do Postgres.
 *
 * Por que no banco e não em memória: a aplicação pode rodar em mais de uma
 * instância, e quando ela reinicia o cache continua lá. Por que não Redis:
 * seria mais uma peça de infraestrutura para manter por um ganho que, neste
 * volume, não existe.
 */
export async function lerCache<T>(chave: string): Promise<T | null> {
  const linha = await consultarUm<{ conteudo: T }>(
    'select conteudo from cache_externo where chave = $1 and expira_em > now()',
    [chave],
  );
  return linha ? linha.conteudo : null;
}

export async function gravarCache(
  chave: string,
  conteudo: unknown,
  minutos: number,
): Promise<void> {
  await pool.query(
    `insert into cache_externo (chave, conteudo, expira_em)
     values ($1, $2::jsonb, now() + ($3 || ' minutes')::interval)
     on conflict (chave) do update
       set conteudo = excluded.conteudo,
           expira_em = excluded.expira_em,
           criado_em = now()`,
    [chave, JSON.stringify(conteudo), String(minutos)],
  );
}

/**
 * Busca no cache; se não achar, chama a função e guarda o resultado.
 *
 * Se a chamada falhar, tenta devolver o cache vencido antes de desistir:
 * preço de ontem é melhor que tela de erro.
 */
export async function comCache<T>(
  chave: string,
  minutos: number,
  buscar: () => Promise<T>,
): Promise<{ dado: T; doCache: boolean; vencido: boolean }> {
  const emCache = await lerCache<T>(chave);
  if (emCache !== null) return { dado: emCache, doCache: true, vencido: false };

  try {
    const dado = await buscar();
    await gravarCache(chave, dado, minutos);
    return { dado, doCache: false, vencido: false };
  } catch (erro) {
    const vencido = await consultarUm<{ conteudo: T }>(
      'select conteudo from cache_externo where chave = $1',
      [chave],
    );
    if (vencido) return { dado: vencido.conteudo, doCache: true, vencido: true };
    throw erro;
  }
}

export async function limparCacheVencido(): Promise<number> {
  const resultado = await pool.query(
    'delete from cache_externo where expira_em < now()',
  );
  return resultado.rowCount ?? 0;
}
