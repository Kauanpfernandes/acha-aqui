import { Router } from 'express';
import { z } from 'zod';
import { exigirLogin } from '../../middlewares/autenticacao.js';
import { assincrona } from '../../middlewares/erros.js';
import { naoEncontrado } from '../../utils/erros.js';
import * as servico from './servico.js';

export const rotasAuth = Router();

const esquemaCadastro = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(120),
  email: z.string().trim().email('E-mail inválido'),
  senha: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres').max(200),
});

const esquemaLogin = z.object({
  email: z.string().trim().email('E-mail inválido'),
  senha: z.string().min(1, 'Informe a senha'),
});

rotasAuth.post(
  '/cadastro',
  assincrona(async (req, res) => {
    const dados = esquemaCadastro.parse(req.body);
    const resultado = await servico.cadastrar(dados);
    res.status(201).json(resultado);
  }),
);

rotasAuth.post(
  '/login',
  assincrona(async (req, res) => {
    const dados = esquemaLogin.parse(req.body);
    const resultado = await servico.entrar(dados);
    res.json(resultado);
  }),
);

rotasAuth.get(
  '/eu',
  exigirLogin,
  assincrona(async (req, res) => {
    const usuario = await servico.porId(req.usuarioId!);
    if (!usuario) throw naoEncontrado('Usuário não encontrado');
    res.json(usuario);
  }),
);
