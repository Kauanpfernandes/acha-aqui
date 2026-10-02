import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { emTeste, env } from './config/env.js';
import { pool } from './db/pool.js';
import { rotasDemo } from './modulos/demo/rotas.js';
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

  app.get('/pronto', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const consulta = { text: 'select PostGIS_Version()', query_timeout: 3000 };
      await pool.query(consulta);
      res.json({ ok: true, banco: 'PostgreSQL + PostGIS' });
    } catch {
      res.status(503).json({ ok: false, erro: 'Banco indisponível' });
    }
  });

  if (env.DEMO_ENABLED) {
    app.use('/api', (req, res, next) => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        res.status(403).json({ erro: 'Demonstração pública somente para leitura. Execute localmente para testar escritas.' });
        return;
      }
      next();
    });
    app.use('/api', rotasDemo);
  }

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
      disponibilidade: '/pronto',
      demonstracao: env.DEMO_ENABLED ? '/api/demo' : null,
    });
  });

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);

  return app;
}
