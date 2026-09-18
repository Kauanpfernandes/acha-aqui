import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { emProducao } from '../config/env.js';
import { ErroDaApi, ErroExterno } from '../utils/erros.js';

export function rotaNaoEncontrada(req: Request, res: Response): void {
  res.status(404).json({
    erro: 'Rota não encontrada',
    caminho: `${req.method} ${req.path}`,
    dica: 'A lista de rotas está em /docs',
  });
}

/**
 * Último filtro antes da resposta. Traduz cada tipo de erro para um status
 * e uma mensagem que o cliente entende, e garante que stack trace nunca
 * vaze em produção.
 */
export function tratarErros(
  erro: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (erro instanceof ZodError) {
    res.status(422).json({
      erro: 'Dados inválidos',
      campos: erro.issues.map((i) => ({
        campo: i.path.join('.') || '(raiz)',
        problema: i.message,
      })),
    });
    return;
  }

  if (erro instanceof ErroDaApi) {
    res.status(erro.status).json({
      erro: erro.message,
      ...(erro.detalhes ? { detalhes: erro.detalhes } : {}),
    });
    return;
  }

  if (erro instanceof ErroExterno) {
    res.status(503).json({
      erro: 'Um serviço externo não respondeu',
      fonte: erro.fonte,
      detalhe: erro.message,
    });
    return;
  }

  console.error('Erro não tratado:', erro);
  res.status(500).json({
    erro: 'Erro interno',
    ...(emProducao
      ? {}
      : { detalhe: erro instanceof Error ? erro.message : String(erro) }),
  });
}

/** Deixa o express repassar rejeições de rota async para o tratador acima. */
export function assincrona<T extends Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: T, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
