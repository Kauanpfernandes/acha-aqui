import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../src/app.js';
import { CENTRO_BH, simularApisExternas } from './apoio.js';

const app = criarApp();

async function contaComToken(email = 'quem@exemplo.test') {
  const { body } = await request(app)
    .post('/api/auth/cadastro')
    .send({ nome: 'Quem', email, senha: 'senha-bem-grande' })
    .expect(201);
  return body.token as string;
}

/** Faz uma busca só para popular produto e lojas no banco. */
async function popular() {
  simularApisExternas();
  const { body } = await request(app)
    .get('/api/busca')
    .query({ q: 'leite condensado', ...CENTRO_BH, raio: 5000 })
    .expect(200);
  return {
    produtoId: body.produto.id as string,
    localId: body.ondeTem[0].localId as string,
  };
}

describe('POST /api/precos', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registra o preço e ele passa a aparecer na busca', async () => {
    const token = await contaComToken();
    const { produtoId, localId } = await popular();

    await request(app)
      .post('/api/precos')
      .set('Authorization', `Bearer ${token}`)
      .send({ produtoId, localId, valor: 7.99 })
      .expect(201);

    const { body } = await request(app)
      .get('/api/busca')
      .query({ q: 'leite condensado', ...CENTRO_BH, raio: 5000 })
      .expect(200);

    const comPreco = body.ondeTem.find((o: { preco: unknown }) => o.preco !== null);
    expect(comPreco.preco.valor).toBe(7.99);
    expect(comPreco.preco.origem).toBe('usuario');
    expect(body.resumo.menorPreco).toBe(7.99);
  });

  it('exige login', async () => {
    const { produtoId, localId } = await popular();

    await request(app)
      .post('/api/precos')
      .send({ produtoId, localId, valor: 7.99 })
      .expect(401);
  });

  it('recusa preço zerado ou negativo', async () => {
    const token = await contaComToken();
    const { produtoId, localId } = await popular();

    for (const valor of [0, -5]) {
      const { body } = await request(app)
        .post('/api/precos')
        .set('Authorization', `Bearer ${token}`)
        .send({ produtoId, localId, valor })
        .expect(422);
      expect(body.campos[0].campo).toBe('valor');
    }
  });

  it('aceita cadastrar uma loja que não está no OpenStreetMap', async () => {
    const token = await contaComToken();
    const { produtoId } = await popular();

    const { body } = await request(app)
      .post('/api/precos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        produtoId,
        valor: 6.5,
        novoLocal: {
          nome: 'Mercadinho do Zé',
          lat: -19.9228,
          lon: -43.9455,
          cidade: 'Belo Horizonte',
        },
      })
      .expect(201);

    expect(body.local.nome).toBe('Mercadinho do Zé');

    const busca = await request(app)
      .get('/api/busca')
      .query({ q: 'leite condensado', ...CENTRO_BH, raio: 5000 })
      .expect(200);

    const zé = busca.body.ondeTem.find(
      (o: { nome: string }) => o.nome === 'Mercadinho do Zé',
    );
    expect(zé.preco.valor).toBe(6.5);
  });

  it('o mesmo usuário registrando de novo no mesmo dia corrige o valor, não duplica', async () => {
    const token = await contaComToken();
    const { produtoId, localId } = await popular();

    await request(app)
      .post('/api/precos')
      .set('Authorization', `Bearer ${token}`)
      .send({ produtoId, localId, valor: 7.99 })
      .expect(201);

    await request(app)
      .post('/api/precos')
      .set('Authorization', `Bearer ${token}`)
      .send({ produtoId, localId, valor: 8.49 })
      .expect(201);

    const { body } = await request(app)
      .get(`/api/produtos/${produtoId}/precos`)
      .expect(200);

    expect(body.itens).toHaveLength(1);
    expect(body.itens[0].valor).toBe(8.49);
  });

  it('dois usuários podem registrar o mesmo produto na mesma loja', async () => {
    const tokenA = await contaComToken('a@exemplo.test');
    const tokenB = await contaComToken('b@exemplo.test');
    const { produtoId, localId } = await popular();

    await request(app)
      .post('/api/precos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ produtoId, localId, valor: 7.99 })
      .expect(201);

    await request(app)
      .post('/api/precos')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ produtoId, localId, valor: 8.2 })
      .expect(201);

    const { body } = await request(app)
      .get(`/api/produtos/${produtoId}/precos`)
      .expect(200);

    expect(body.itens).toHaveLength(2);
  });

  it('recusa produto que não existe', async () => {
    const token = await contaComToken();
    const { localId } = await popular();

    await request(app)
      .post('/api/precos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        produtoId: '00000000-0000-0000-0000-000000000000',
        localId,
        valor: 5,
      })
      .expect(404);
  });
});
