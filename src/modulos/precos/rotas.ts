import { Router } from 'express';
import { z } from 'zod';
import { exigirLogin } from '../../middlewares/autenticacao.js';
import { assincrona } from '../../middlewares/erros.js';
import { naoEncontrado } from '../../utils/erros.js';
import * as locaisRepo from '../locais/repositorio.js';
import * as produtosRepo from '../produtos/repositorio.js';
import * as precosRepo from './repositorio.js';

export const rotasPrecos = Router();

const esquemaRegistro = z
  .object({
    produtoId: z.string().uuid().optional(),
    codigoBarras: z.string().trim().min(6).max(20).optional(),
    localId: z.string().uuid().optional(),
    novoLocal: z
      .object({
        nome: z.string().trim().min(2).max(160),
        tipo: z.string().trim().max(40).optional(),
        endereco: z.string().trim().max(200).optional(),
        cidade: z.string().trim().max(120).optional(),
        uf: z.string().trim().length(2).optional(),
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
      })
      .optional(),
    valor: z.number().positive('O preço precisa ser maior que zero').max(1_000_000),
    moeda: z.string().length(3).default('BRL'),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD').optional(),
    fotoUrl: z.string().url().optional(),
  })
  .refine((d) => d.produtoId || d.codigoBarras, {
    message: 'Informe produtoId ou codigoBarras',
  })
  .refine((d) => d.localId || d.novoLocal, {
    message: 'Informe localId ou novoLocal',
  });

/**
 * POST /api/precos — é aqui que o projeto deixa de depender de base alheia.
 *
 * O usuário registra quanto pagou e onde. A loja pode ser uma que já veio do
 * OpenStreetMap (localId) ou uma que ele cadastra na hora (novoLocal), porque
 * mercadinho de bairro muitas vezes não está no mapa.
 */
rotasPrecos.post(
  '/precos',
  exigirLogin,
  assincrona(async (req, res) => {
    const dados = esquemaRegistro.parse(req.body);

    const produto = dados.produtoId
      ? await produtosRepo.buscarPorId(dados.produtoId)
      : await produtosRepo.buscarPorCodigo(dados.codigoBarras!);
    if (!produto) throw naoEncontrado('Produto não encontrado. Busque por ele antes de registrar o preço.');

    const local = dados.localId
      ? await locaisRepo.buscarPorId(dados.localId)
      : await locaisRepo.criarLocalManual(dados.novoLocal!);
    if (!local) throw naoEncontrado('Local não encontrado');

    const preco = await precosRepo.registrar({
      produtoId: produto.id,
      localId: local.id,
      usuarioId: req.usuarioId!,
      valor: dados.valor,
      moeda: dados.moeda,
      data: dados.data,
      fotoUrl: dados.fotoUrl ?? null,
      origem: 'usuario',
    });

    res.status(201).json({
      id: preco.id,
      valor: Number(preco.valor),
      moeda: preco.moeda,
      data: preco.data,
      produto: { id: produto.id, nome: produto.nome },
      local: { id: local.id, nome: local.nome },
    });
  }),
);

rotasPrecos.get(
  '/produtos/:id/precos',
  assincrona(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const produto = await produtosRepo.buscarPorId(id);
    if (!produto) throw naoEncontrado('Produto não encontrado');

    const historico = await precosRepo.historicoDoProduto(id);
    res.json({
      produto: { id: produto.id, nome: produto.nome },
      itens: historico.map((p) => ({
        id: p.id,
        valor: Number(p.valor),
        moeda: p.moeda,
        data: p.data,
        origem: p.origem,
        localId: p.local_id,
      })),
    });
  }),
);
