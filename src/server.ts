import { criarApp } from './app.js';
import { env } from './config/env.js';
import { migrar } from './db/migrar.js';
import { fecharPool } from './db/pool.js';

async function subir(): Promise<void> {
  const novas = await migrar();
  if (novas.length) console.log(`Migrations aplicadas: ${novas.join(', ')}`);

  const app = criarApp();
  const servidor = app.listen(env.PORT, () => {
    console.log(`Acha Aqui de pé em http://localhost:${env.PORT}`);
    console.log(`Documentação em http://localhost:${env.PORT}/docs`);
  });

  // Encerramento limpo: para de aceitar conexão nova, espera as em andamento
  // e só então fecha o pool do banco.
  const encerrar = (sinal: string) => {
    console.log(`\n${sinal} recebido, encerrando...`);
    servidor.close(async () => {
      await fecharPool();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => encerrar('SIGTERM'));
  process.on('SIGINT', () => encerrar('SIGINT'));
}

subir().catch((erro) => {
  console.error('Não consegui subir:', erro);
  process.exit(1);
});
