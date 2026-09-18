import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { emTeste } from './config/env.js';
import { openapi } from './docs/openapi.js';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js';
import { rotasAuth } from './modulos/auth/rotas.js';
import { rotasBusca } from './modulos/busca/rotas.js';
import { rotasPrecos } from './modulos/precos/rotas.js';

export function criarApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '200kb' }));

  // Limite de requisições. Desligado no teste, senão a suíte se estrangula.
  if (!emTeste) {
    app.use(
      '/api',
      rateLimit({
        windowMs: 60_000,
        limit: 60,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { erro: 'Muitas requisições. Espere um minuto.' },
      }),
    );
  }

  app.get('/saude', (_req, res) => {
    res.json({ ok: true, agora: new Date().toISOString() });
  });

  app.use('/api/auth', rotasAuth);
  app.use('/api', rotasBusca);
  app.use('/api', rotasPrecos);

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, {
    customSiteTitle: 'Acha Aqui — API',
  }));
  app.get('/openapi.json', (_req, res) => res.json(openapi));

  app.get('/', (_req, res) => {
    res.json({
      nome: 'Acha Aqui',
      descricao: 'Onde comprar um produto perto de você',
      documentacao: '/docs',
    });
  });

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);

  return app;
}
