/**
 * Erros que a aplicação sabe explicar. Qualquer coisa fora daqui é bug,
 * vira 500 e não vaza detalhe para o cliente.
 */
export class ErroDaApi extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detalhes?: unknown,
  ) {
    super(message);
    this.name = 'ErroDaApi';
  }
}

export const erroDeValidacao = (mensagem: string, detalhes?: unknown) =>
  new ErroDaApi(422, mensagem, detalhes);

export const naoEncontrado = (mensagem = 'Não encontrado', detalhes?: unknown) =>
  new ErroDaApi(404, mensagem, detalhes);

export const naoAutenticado = (mensagem = 'Faça login para continuar') =>
  new ErroDaApi(401, mensagem);

export const conflito = (mensagem: string) => new ErroDaApi(409, mensagem);

/**
 * Serviço externo fora do ar. Vira 503 e, no corpo, diz qual fonte falhou —
 * a busca continua respondendo com o que as outras fontes deram.
 */
export class ErroExterno extends Error {
  constructor(
    readonly fonte: string,
    message: string,
    readonly causa?: unknown,
  ) {
    super(message);
    this.name = 'ErroExterno';
  }
}
