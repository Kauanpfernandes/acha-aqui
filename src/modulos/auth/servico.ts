import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { consultarUm } from '../../db/pool.js';
import { conflito, naoAutenticado } from '../../utils/erros.js';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senha_hash: string;
  criado_em: string;
}

export interface UsuarioPublico {
  id: string;
  nome: string;
  email: string;
}

const RODADAS = 10;

function publico(u: Usuario): UsuarioPublico {
  return { id: u.id, nome: u.nome, email: u.email };
}

export function gerarToken(usuario: UsuarioPublico): string {
  return jwt.sign({ sub: usuario.id, nome: usuario.nome }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRA_EM,
  } as jwt.SignOptions);
}

export function lerToken(token: string): { id: string } {
  try {
    const dados = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (!dados.sub) throw new Error('token sem dono');
    return { id: String(dados.sub) };
  } catch {
    throw naoAutenticado('Token inválido ou expirado');
  }
}

export async function cadastrar(dados: {
  nome: string;
  email: string;
  senha: string;
}): Promise<{ usuario: UsuarioPublico; token: string }> {
  const jaExiste = await consultarUm<{ id: string }>(
    'select id from usuarios where lower(email) = lower($1)',
    [dados.email],
  );
  if (jaExiste) throw conflito('Já existe uma conta com esse e-mail');

  const hash = await bcrypt.hash(dados.senha, RODADAS);

  const usuario = await consultarUm<Usuario>(
    `insert into usuarios (nome, email, senha_hash)
     values ($1, $2, $3) returning *`,
    [dados.nome.trim(), dados.email.trim().toLowerCase(), hash],
  );

  const pub = publico(usuario!);
  return { usuario: pub, token: gerarToken(pub) };
}

/**
 * Login. A mensagem é a mesma para e-mail inexistente e senha errada,
 * de propósito: contar qual dos dois falhou entrega para um atacante
 * quais e-mails têm conta aqui.
 */
export async function entrar(dados: {
  email: string;
  senha: string;
}): Promise<{ usuario: UsuarioPublico; token: string }> {
  const usuario = await consultarUm<Usuario>(
    'select * from usuarios where lower(email) = lower($1)',
    [dados.email],
  );

  const hashDeReferencia =
    usuario?.senha_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';

  // Compara sempre, mesmo sem usuário: assim o tempo de resposta não denuncia
  // se o e-mail existe.
  const confere = await bcrypt.compare(dados.senha, hashDeReferencia);

  if (!usuario || !confere) throw naoAutenticado('E-mail ou senha incorretos');

  const pub = publico(usuario);
  return { usuario: pub, token: gerarToken(pub) };
}

export async function porId(id: string): Promise<UsuarioPublico | null> {
  const u = await consultarUm<Usuario>('select * from usuarios where id = $1', [id]);
  return u ? publico(u) : null;
}
