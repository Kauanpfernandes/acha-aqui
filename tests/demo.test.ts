import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { criarApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prepararDemo } from '../src/db/demo.js';
import { pool } from '../src/db/pool.js';

afterEach(() => { env.DEMO_ENABLED = false; });

describe('Demonstração pública', () => {
  it('carga repetida não duplica dados e a API calcula distâncias reais', async () => {
    await prepararDemo();
    await prepararDemo();
    env.DEMO_ENABLED = true;
    const app = criarApp();
    const res = await request(app).get('/api/demo').expect(200);
    expect(res.body.demonstracao).toBe(true);
    expect(res.body.itens).toHaveLength(2);
    expect(res.body.itens.map((i: { valor: number }) => i.valor)).toEqual([5.99, 6.49]);
    expect(res.body.itens[1].distancia_metros).toBeGreaterThan(50);
    expect(res.body.itens[1].distancia_metros).toBeLessThan(150);
    const { rows } = await pool.query('select count(*)::int as total from precos');
    expect(rows[0].total).toBe(2);
    await request(app).get('/pronto').expect(200);
  });
  it('não permite criar contas ou preços no modo demo', async () => {
    env.DEMO_ENABLED = true;
    const app = criarApp();
    await request(app).post('/api/auth/cadastro').send({}).expect(403);
    await request(app).post('/api/precos').send({}).expect(403);
    await request(app).get('/docs/').expect(200);
  });
  it('não disponibiliza a rota quando desativada', async () => {
    env.DEMO_ENABLED = false;
    await request(criarApp()).get('/api/demo').expect(404);
  });
});
