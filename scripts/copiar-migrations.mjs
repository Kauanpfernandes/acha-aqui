import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * O tsc compila .ts e ignora todo o resto, então as migrations .sql não
 * chegavam em dist/ e o `npm start` morria procurando a pasta.
 *
 * Um script em Node, e não um `cp -r` no package.json, porque o projeto
 * precisa buildar igual no Windows e no Linux do CI.
 */
const aqui = dirname(fileURLToPath(import.meta.url));
const origem = join(aqui, '..', 'src', 'db', 'migrations');
const destino = join(aqui, '..', 'dist', 'db', 'migrations');

await mkdir(destino, { recursive: true });
await cp(origem, destino, { recursive: true });

console.log('Migrations copiadas para dist/db/migrations');
