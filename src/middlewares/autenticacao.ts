import type { NextFunction, Request, Response } from 'express';
import { lerToken } from '../modulos/auth/servico.js';
import { naoAutenticado } from '../utils/erros.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuarioId?: string;
    }
  }
}

function extrairToken(req: Request): string | null {
  const cabecalho = req.header('authorization');
  if (!cabecalho) return null;
  const [tipo, token] = cabecalho.split(' ');
  if (tipo?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/** Barra quem não está logado. */
export function exigirLogin(req: Request, _res: Response, next: NextFunction): void {
  const token = extrairToken(req);
  if (!token) {
    next(naoAutenticado('Mande o token no cabeçalho Authorization: Bearer <token>'));
    return;
  }
  try {
    req.usuarioId = lerToken(token).id;
    next();
  } catch (erro) {
    next(erro);
  }
}

/**
 * Identifica o usuário se houver token, mas deixa passar quem não tem.
 * A busca funciona sem login; só registrar preço exige conta.
 */
export function loginOpcional(req: Request, _res: Response, next: NextFunction): void {
  const token = extrairToken(req);
  if (token) {
    try {
      req.usuarioId = lerToken(token).id;
    } catch {
      // Token estragado numa rota pública: segue como visitante.
    }
  }
  next();
}
