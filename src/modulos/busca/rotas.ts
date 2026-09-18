import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { assincrona } from '../../middlewares/erros.js';
import { naoEncontrado } from '../../utils/erros.js';
import * as locaisRepo from '../locais/repositorio.js';
import * as produtosRepo from '../produtos/repositorio.js';
import { buscar } from './servico.js';

export const rotasBusca = Router();

const coordenada = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

const esquemaBusca = coordenada.extend({
  q: z.string().trim().min(2, 'Digite pelo menos 2 letras').max(120),
  raio: z.coerce
    .number()
    .int()
    .positive()
    .max(env.RAIO_MAXIMO_METROS)
    .optional(),
});

/**
 * GET /api/busca?q=arroz&lat=-19.92&lon=-43.94&raio=3000
 *
 * A rota principal: o que a pessoa digitou, onde ela está, e o raio que aceita
 * andar. Não exige login.
 */
rotasBusca.get(
  '/busca',
  assincrona(async (req, res) => {
    const { q, lat, lon, raio } = esquemaBusca.parse(req.query);
    const resultado = await buscar({
      termo: q,
      lat,
      lon,
      raioMetros: raio,
    });
    res.json(resultado);
  }),
);

/** Sugestões enquanto a pessoa digita, só do que já está no nosso banco. */
rotasBusca.get(
  '/produtos',
  assincrona(async (req, res) => {
    const { q } = z
      .object({ q: z.string().trim().min(2).max(120) })
      .parse(req.query);

    const achados = await produtosRepo.procurarPorNome(q, 10);
    res.json({
      itens: achados.map((p) => ({
        id: p.id,
        codigoBarras: p.codigo_barras,
        nome: p.nome,
        marca: p.marca,
        quantidade: p.quantidade,
        imagemUrl: p.imagem_url,
      })),
    });
  }),
);

rotasBusca.get(
  '/produtos/:id',
  assincrona(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const produto = await produtosRepo.buscarPorId(id);
    if (!produto) throw naoEncontrado('Produto não encontrado');
    res.json(produto);
  }),
);

/** Lojas por perto, sem amarrar a produto nenhum. */
rotasBusca.get(
  '/locais',
  assincrona(async (req, res) => {
    const { lat, lon, raio } = coordenada
      .extend({
        raio: z.coerce.number().int().positive().max(env.RAIO_MAXIMO_METROS).optional(),
      })
      .parse(req.query);

    const achados = await locaisRepo.porPerto(
      lat,
      lon,
      raio ?? env.RAIO_PADRAO_METROS,
    );

    res.json({
      itens: achados.map((l) => ({
        id: l.id,
        nome: l.nome,
        tipo: l.tipo,
        endereco: l.endereco,
        cidade: l.cidade,
        lat: Number(l.lat),
        lon: Number(l.lon),
        distanciaMetros: Number(l.distancia_metros),
      })),
    });
  }),
);
