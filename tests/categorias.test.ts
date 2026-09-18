import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../src/app.js';
import { categoriaDoTermo } from '../src/integracoes/categorias.js';
import {
  CENTRO_BH,
  LOJAS_AUTOPECAS,
  LOJAS_FARMACIA,
  simularApisExternas,
} from './apoio.js';

const app = criarApp();

describe('categoriaDoTermo', () => {
  it('reconhece o termo exato', () => {
    expect(categoriaDoTermo('pneu')?.id).toBe('autopecas');
    expect(categoriaDoTermo('parafuso')?.id).toBe('construcao');
    expect(categoriaDoTermo('caderno')?.id).toBe('papelaria');
  });

  it('ignora acento, porque quem digita com pressa escreve sem', () => {
    expect(categoriaDoTermo('ração')?.id).toBe('pet');
    expect(categoriaDoTermo('racao')?.id).toBe('pet');
    expect(categoriaDoTermo('óculos')?.id).toBe('oculos');
  });

  it('acha a categoria dentro de uma frase', () => {
    expect(categoriaDoTermo('pastilha de freio')?.id).toBe('autopecas');
    expect(categoriaDoTermo('ração de gato')?.id).toBe('pet');
  });

  it('devolve nulo quando não é nada que ela conheça', () => {
    expect(categoriaDoTermo('xpto que nao existe')).toBeNull();
    expect(categoriaDoTermo('a')).toBeNull();
  });
});

describe('GET /api/busca com produto que não é comida', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cai para a categoria e devolve as lojas certas quando não existe o produto', async () => {
    simularApisExternas({ produtos: [], lojas: LOJAS_AUTOPECAS });

    const { body } = await request(app)
      .get('/api/busca')
      .query({ q: 'pastilha de freio', ...CENTRO_BH, raio: 5000 })
      .expect(200);

    expect(body.resumo.modo).toBe('categoria');
    expect(body.produto).toBeNull();
    expect(body.categoria.id).toBe('autopecas');
    expect(body.categoria.rotulo).toBe('Auto peças e oficinas');

    const nomes = body.ondeTem.map((o: { nome: string }) => o.nome);
    expect(nomes).toContain('Auto Peças Central');
    expect(nomes).toContain('Oficina do Zé');

    // Sem produto não há preço, e a resposta diz isso em vez de inventar.
    expect(body.resumo.menorPreco).toBeNull();
    expect(body.resumo.lojasComPreco).toBe(0);
    expect(body.ondeTem.every((o: { preco: unknown }) => o.preco === null)).toBe(true);
  });

  it('procura farmácia como amenity, que é onde o Brasil está mapeado', async () => {
    const { corpos } = simularApisExternas({ produtos: [], lojas: LOJAS_FARMACIA });

    const { body } = await request(app)
      .get('/api/busca')
      .query({ q: 'dipirona', ...CENTRO_BH, raio: 5000 })
      .expect(200);

    expect(body.categoria.id).toBe('farmacia');
    expect(body.ondeTem[0].nome).toBe('Drogaria da Esquina');
    expect(body.ondeTem[0].tipo).toBe('pharmacy');

    const consulta = corpos.find((c) => c.includes('nwr'));
    expect(consulta).toMatch(/\["amenity"~"\^\(pharmacy\)\$"\]/);
  });

  it('não mistura mercado no resultado de peça de carro', async () => {
    // Primeiro uma busca de comida, que enche o banco de supermercado.
    simularApisExternas();
    await request(app)
      .get('/api/busca')
      .query({ q: 'leite condensado', ...CENTRO_BH, raio: 5000 })
      .expect(200);

    vi.unstubAllGlobals();
    simularApisExternas({ produtos: [], lojas: LOJAS_AUTOPECAS });

    const { body } = await request(app)
      .get('/api/busca')
      .query({ q: 'pneu', ...CENTRO_BH, raio: 5000 })
      .expect(200);

    const tipos = body.ondeTem.map((o: { tipo: string }) => o.tipo);
    expect(tipos).not.toContain('supermarket');
    expect(new Set(tipos)).toEqual(new Set(['car_parts', 'car_repair']));
  });

  it('ignora o produto sem relação que a API externa devolve por teimosia', async () => {
    // O Open Food Facts tenta achar alguma coisa de qualquer jeito. Aceitar
    // calado faria quem procura parafuso receber bolacha.
    simularApisExternas({
      produtos: [
        {
          code: '7890000000001',
          product_name: 'Bolacha Maria',
          brands: 'Marca Qualquer',
          categories_tags: ['en:biscuits'],
        },
      ],
      lojas: LOJAS_AUTOPECAS,
    });

    const { body } = await request(app)
      .get('/api/busca')
      .query({ q: 'parafuso sextavado', ...CENTRO_BH, raio: 5000 })
      .expect(200);

    expect(body.resumo.modo).toBe('categoria');
    expect(body.categoria.id).toBe('construcao');
  });

  it('continua preferindo o produto de verdade quando ele existe', async () => {
    simularApisExternas();

    const { body } = await request(app)
      .get('/api/busca')
      .query({ q: 'leite condensado', ...CENTRO_BH, raio: 5000 })
      .expect(200);

    expect(body.resumo.modo).toBe('produto');
    expect(body.produto.nome).toBe('Leite Condensado Moça');
    expect(body.categoria).toBeNull();
  });

  it('só devolve 404 quando não é produto nem tipo de loja', async () => {
    simularApisExternas({ produtos: [] });

    const { body } = await request(app)
      .get('/api/busca')
      .query({ q: 'xpto que nao existe', ...CENTRO_BH })
      .expect(404);

    expect(body.erro).toMatch(/não achei/i);
  });
});
