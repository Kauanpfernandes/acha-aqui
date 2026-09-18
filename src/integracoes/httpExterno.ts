import { env } from '../config/env.js';
import { ErroExterno } from '../utils/erros.js';

interface Opcoes {
  fonte: string;
  timeoutMs?: number;
  tentativas?: number;
  metodo?: 'GET' | 'POST';
  corpo?: string;
  cabecalhos?: Record<string, string>;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cliente HTTP para as APIs públicas que o Acha Aqui consome.
 *
 * Três coisas que ele resolve e que fetch puro não resolve:
 *
 * 1. Timeout. Sem isso, uma API lenta trava a requisição do usuário até o
 *    navegador desistir. Aqui ela tem alguns segundos e cai fora.
 * 2. Retry só no que faz sentido. Erro de rede e 5xx podem ser passageiros,
 *    então tenta de novo com espera crescente. 404 e 400 não melhoram com
 *    insistência: falham na hora.
 * 3. User-Agent identificando o projeto. As APIs do Open Food Facts e o
 *    Overpass pedem isso, e quem não manda leva bloqueio.
 */
export async function buscarJson<T>(url: string, opcoes: Opcoes): Promise<T> {
  const {
    fonte,
    timeoutMs = env.TIMEOUT_EXTERNO_MS,
    tentativas = 3,
    metodo = 'GET',
    corpo,
    cabecalhos = {},
  } = opcoes;

  let ultimoErro: unknown;

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const abortador = new AbortController();
    const relogio = setTimeout(() => abortador.abort(), timeoutMs);

    try {
      const resposta = await fetch(url, {
        method: metodo,
        body: corpo,
        signal: abortador.signal,
        headers: {
          'User-Agent': env.USER_AGENT,
          Accept: 'application/json',
          ...cabecalhos,
        },
      });

      if (resposta.status >= 500 || resposta.status === 429) {
        throw new ErroExterno(
          fonte,
          `${fonte} respondeu ${resposta.status}`,
        );
      }

      if (!resposta.ok) {
        // 4xx que não seja 429: insistir não adianta.
        throw Object.assign(
          new ErroExterno(fonte, `${fonte} respondeu ${resposta.status}`),
          { naoTentarDeNovo: true },
        );
      }

      return (await resposta.json()) as T;
    } catch (erro) {
      ultimoErro = erro;

      const desistir =
        (erro as { naoTentarDeNovo?: boolean })?.naoTentarDeNovo === true;
      if (desistir || tentativa === tentativas) break;

      // 300ms, 600ms, 1200ms...
      await esperar(300 * 2 ** (tentativa - 1));
    } finally {
      clearTimeout(relogio);
    }
  }

  if (ultimoErro instanceof ErroExterno) throw ultimoErro;

  const abortou =
    ultimoErro instanceof Error && ultimoErro.name === 'AbortError';
  throw new ErroExterno(
    fonte,
    abortou
      ? `${fonte} não respondeu em ${timeoutMs}ms`
      : `Falha ao falar com ${fonte}`,
    ultimoErro,
  );
}
