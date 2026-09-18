import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Os testes compartilham um banco só, então rodam em fila.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.DATABASE_URL_TESTE ??
        'postgres://postgres:postgres@localhost:5432/achaaqui_test',
      JWT_SECRET: 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres',
    },
  },
});
