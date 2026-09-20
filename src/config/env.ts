import 'dotenv/config';
import { z } from 'zod';

/**
 * Toda configuração entra por aqui. Se faltar alguma variável obrigatória,
 * o processo morre na subida com uma mensagem clara, em vez de quebrar
 * no meio de uma requisição três horas depois.
 */
const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET precisa de pelo menos 32 caracteres'),
  JWT_EXPIRA_EM: z.string().default('7d'),

  // Integrações externas. Têm padrão porque todas são públicas e sem chave.
  OPEN_FOOD_FACTS_URL: z.string().url().default('https://world.openfoodfacts.org'),
  OPEN_PRICES_URL: z.string().url().default('https://prices.openfoodfacts.org'),
  OVERPASS_URL: z.string().url().default('https://overpass-api.de/api/interpreter'),
  // O Overpass é mantido por doação e devolve 504 quando está cheio. Um
  // espelho fora do ar não pode ser o fim da busca, então existe um segundo.
  OVERPASS_URL_RESERVA: z
    .string()
    .url()
    .default('https://overpass.kumi.systems/api/interpreter'),

  // Quanto tempo uma resposta externa fica valendo no cache, em minutos.
  CACHE_MINUTOS_PRODUTO: z.coerce.number().int().positive().default(60 * 24 * 7),
  CACHE_MINUTOS_PRECO: z.coerce.number().int().positive().default(60 * 6),
  CACHE_MINUTOS_LOCAL: z.coerce.number().int().positive().default(60 * 24 * 30),

  TIMEOUT_EXTERNO_MS: z.coerce.number().int().positive().default(6000),

  // Identificação exigida pelas APIs públicas que usamos. É educado e evita bloqueio.
  USER_AGENT: z
    .string()
    .default('AchaAqui/1.0 (https://github.com/Kauanpfernandes/acha-aqui)'),

  RAIO_PADRAO_METROS: z.coerce.number().int().positive().default(3000),
  RAIO_MAXIMO_METROS: z.coerce.number().int().positive().default(25000),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  const problemas = resultado.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  console.error(`Configuração inválida:\n${problemas}`);
  process.exit(1);
}

export const env = resultado.data;
export const emTeste = env.NODE_ENV === 'test';
export const emProducao = env.NODE_ENV === 'production';
