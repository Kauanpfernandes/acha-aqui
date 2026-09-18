import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../src/app.js';
import { CENTRO_BH, precoExterno, simularApisExternas } from './apoio.js';

const app = criarApp();

describe('GET /api/busca', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('acha o produto e lista as lojas do raio, da mais perto para a mais longe', async () => {
    simularApisExternas();

    const resposta = await request(app)
      .get('/api/busca')
      .query({ q: 'leite condensado', ...CENTRO_BH, raio: 5000 })
      .expect(200);

    expect(resposta.body.produto.nome).toBe('Leite Condensado Moça');
    expect(resposta.body.produto.codigoBarras).toBe('7891000100103');

    const nomes = resposta.body.ondeTem.map((o: { nome: string }) => o.nome);
    expect(nomes).toEqual([
      'Supermercado Perto',
      'Mercado do Meio',
      'Atacado Longe',
    ]);

    expect(resposta.body.resumo.lojasNoRaio).toBe(3);
    expect(resposta.body.resumo.lojasComPreco).toBe(0);
    expect(resposta.body.resumo.menorPreco).toBeNull();
  });

  it('calcula a distância em metros e escreve de forma legível', async () => {
    simularApisExternas();

    const { body } = await request(app)
      .get('/api/busca')
      .query({ q: 'leite condensado', ...CENTRO_BH, raio: 5000 })
      .expect(200);

    const maisPerto = body.ondeTem[0];
    // Centro de BH até a Rua da Bahia, 100: algumas centenas de metros.
    expect(maisPerto.distanciaMetros).toBeGreaterThan(50);
    expect(maisPerto.distanciaMetros).toBeLessThan(1500);
    expect(maisPerto.distanciaTexto).toMatch(/^\d+ m$/);

    const maisLonge = body.ondeTem[2];
    expect(maisLonge.distanciaMetros).toBeGreaterThan(maisPerto.distanciaMetros);
    expect(maisLonge.distanciaTexto).toMatch(/km$/);
  });

  it('respeita o raio: loja fora dele não aparece', async () => {
    simularApisExternas();

    const { body } = await request(app)
      .get('/api/busca')
      .query({ q: 'leite condensado', ...CENTRO_BH, raio: 1000 })
      .expect(200);

    const nomes = body.ondeTem.map((o: { nome: string }) => o.nome);
    expect(nomes).toContain('Supermercado Perto');
    expect(nomes).not.toContain('Atacado Longe');
  });

  it('importa o preço do Open Prices e põe a loja com preço na frente', async () => {
    simularApisExternas({ precos: [precoExterno(8.49)] });

    const { body } = await request(app)
      .get('/api/busca')
      .query({ q: 'leite condensado', ...CENTRO_BH, raio: 5000 })
      .expect(200);

    // A loja com preço vem primeiro, mesmo não sendo a mais perto.
    expect(body.ondeTem[0].nome).toBe('Mercado do Meio');
    expect(body.ondeTem[0].preco.valor).toBe(8.49);
    expect(body.ondeTem[0].preco.origem).toBe('openprices');
    expect(body.resumo.menorPreco).toBe(8.49);
    expect(body.resumo.lojasComPreco).toBe(1);
  });

  it('continua respondendo quando o Open Food Facts cai, se o produto já é conhecido', async () => {
    // Primeira busca: tudo no ar, o produto entra no nosso banco.
    simularApisExternas();
    await request(app)
      .get('/api/busca')
      .query({ q: 'leite condensado', ...CENTRO_BH })
      .expect(200);

    vi.unstubAllGlobals();

    // Segunda busca: termo diferente (para o cache da primeira nao valer)
    // e a API externa caiu. O produto tem que sair do nosso banco.
    simularApisExternas({ offFalha: true });
    const { body } = await request(app)
      .get('/api/busca')
      .query({ q: 'condensado', ...CENTRO_BH, raio: 5000 })
      .expect(200);

    expect(body.produto.nome).toBe('Leite Condensado Moça');

    const off = body.fontes.find((f: { nome: string }) => f.nome === 'Open Food Facts');
    expect(off.ok).toBe(false);
    expect(off.detalhe).toBeTruthy();
  });

  it('avisa qual fonte falhou em vez de derrubar a busca', async () => {
    simularApisExternas({ overpassFalha: true, openPricesFalha: true });

    const { body } = await request(app)
      .get('/api/busca')
      .query({ q: 'leite condensado', ...CENTRO_BH })
      .expect(200);

    const porNome = Object.fromEntries(
      body.fontes.map((f: { nome: string; ok: boolean }) => [f.nome, f.ok]),
    );
    expect(porNome['Open Food Facts']).toBe(true);
    expect(porNome['OpenStreetMap']).toBe(false);
    expect(body.ondeTem).toEqual([]);
  });

  it('devolve 404 quando nenhum produto bate com o termo', async () => {
    simularApisExternas({ produtos: [] });

    const { body } = await request(app)
      .get('/api/busca')
      .query({ q: 'xpto que nao existe', ...CENTRO_BH })
      .expect(404);

    expect(body.erro).toMatch(/não achei/i);
  });

  it('recusa coordenada inválida', async () => {
    simularApisExternas();

    const { body } = await request(app)
      .get('/api/busca')
      .query({ q: 'arroz', lat: 200, lon: -43.9 })
      .expect(422);

    expect(body.erro).toBe('Dados inválidos');
    expect(body.campos[0].campo).toBe('lat');
  });

  it('exige pelo menos duas letras no termo', async () => {
    simularApisExternas();
    await request(app)
      .get('/api/busca')
      .query({ q: 'a', ...CENTRO_BH })
      .expect(422);
  });

  it('não chama a API externa duas vezes para a mesma busca (cache)', async () => {
    const { chamadas } = simularApisExternas();

    await request(app).get('/api/busca').query({ q: 'leite condensado', ...CENTRO_BH }).expect(200);
    const depoisDaPrimeira = chamadas.filter((u) => u.includes('search.pl')).length;

    await request(app).get('/api/busca').query({ q: 'leite condensado', ...CENTRO_BH }).expect(200);
    const depoisDaSegunda = chamadas.filter((u) => u.includes('search.pl')).length;

    expect(depoisDaPrimeira).toBe(1);
    expect(depoisDaSegunda).toBe(1);
  });
});
