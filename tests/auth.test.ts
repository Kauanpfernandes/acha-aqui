import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.js';

const app = criarApp();

const conta = {
  nome: 'Kauan',
  email: 'kauan@exemplo.test',
  senha: 'senha-bem-grande',
};

// Sem async de propósito: devolve o encadeamento do supertest, para os testes
// poderem continuar com .expect(...).
function criarConta(sobrescrever: Partial<typeof conta> = {}) {
  return request(app)
    .post('/api/auth/cadastro')
    .send({ ...conta, ...sobrescrever });
}

describe('Conta', () => {
  it('cadastra e já devolve o token', async () => {
    const { body, status } = await criarConta();

    expect(status).toBe(201);
    expect(body.usuario.email).toBe('kauan@exemplo.test');
    expect(body.token).toBeTruthy();
    // A senha (nem o hash) nunca sai na resposta.
    expect(JSON.stringify(body)).not.toContain('senha');
  });

  it('recusa e-mail repetido, mesmo com outra caixa de letra', async () => {
    await criarConta().expect(201);
    const { body, status } = await criarConta({ email: 'KAUAN@Exemplo.test' });

    expect(status).toBe(409);
    expect(body.erro).toMatch(/já existe/i);
  });

  it('exige senha de pelo menos 8 caracteres', async () => {
    const { body, status } = await criarConta({ senha: '1234' });

    expect(status).toBe(422);
    expect(body.campos[0].campo).toBe('senha');
  });

  it('recusa e-mail malformado', async () => {
    const { status } = await criarConta({ email: 'isso-nao-e-email' });
    expect(status).toBe(422);
  });

  it('entra com a senha certa', async () => {
    await criarConta().expect(201);

    const { body, status } = await request(app)
      .post('/api/auth/login')
      .send({ email: conta.email, senha: conta.senha });

    expect(status).toBe(200);
    expect(body.token).toBeTruthy();
  });

  it('dá a mesma resposta para senha errada e para e-mail inexistente', async () => {
    await criarConta().expect(201);

    const senhaErrada = await request(app)
      .post('/api/auth/login')
      .send({ email: conta.email, senha: 'outra-senha-qualquer' });

    const semConta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@exemplo.test', senha: 'outra-senha-qualquer' });

    expect(senhaErrada.status).toBe(401);
    expect(semConta.status).toBe(401);
    // Mensagem idêntica: não entrega quais e-mails têm conta aqui.
    expect(senhaErrada.body.erro).toBe(semConta.body.erro);
  });

  it('/eu responde com o dono do token', async () => {
    const { body } = await criarConta().expect(201);

    const eu = await request(app)
      .get('/api/auth/eu')
      .set('Authorization', `Bearer ${body.token}`)
      .expect(200);

    expect(eu.body.email).toBe(conta.email);
    expect(eu.body.id).toBe(body.usuario.id);
  });

  it('/eu barra quem não manda token', async () => {
    const { body } = await request(app).get('/api/auth/eu').expect(401);
    expect(body.erro).toMatch(/Authorization/);
  });

  it('/eu barra token inventado', async () => {
    await request(app)
      .get('/api/auth/eu')
      .set('Authorization', 'Bearer token.completamente.falso')
      .expect(401);
  });
});
