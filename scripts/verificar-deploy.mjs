import assert from 'node:assert/strict';

const base = new URL(process.argv[2] ?? 'http://localhost:3000');
assert.ok(['http:', 'https:'].includes(base.protocol), 'Informe uma URL HTTP ou HTTPS');
async function obter(path) {
  const res = await fetch(new URL(path, base), { signal: AbortSignal.timeout(60_000) });
  assert.equal(res.status, 200, `${path}: HTTP ${res.status}`);
  return res;
}
const pronto = await (await obter('/pronto')).json();
assert.equal(pronto.ok, true);
const demo = await (await obter('/api/demo')).json();
assert.equal(demo.demonstracao, true);
assert.equal(demo.itens.length, 2);
assert.ok(demo.itens.every((i) => typeof i.distancia_metros === 'number' && i.distancia_metros >= 0));
assert.ok(demo.itens[0].valor <= demo.itens[1].valor);
const spec = await (await obter('/openapi.json')).json();
assert.ok(spec.paths['/api/demo']);
const html = await (await obter('/docs/')).text();
assert.ok(html.includes('swagger-ui'));
await obter('/docs/swagger-ui-bundle.js');
console.log('OK: PostgreSQL/PostGIS, dados fictícios, OpenAPI e arquivos do Swagger disponíveis.');
