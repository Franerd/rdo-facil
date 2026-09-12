import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = await mkdtemp(join(tmpdir(), 'rdo-api-'));
process.env.NODE_ENV = 'test'; process.env.RDO_ROOT = root; process.env.RDO_API_TOKEN = 'teste-seguro';
const { server } = await import('./server.mjs');
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const auth = { Authorization: 'Bearer teste-seguro' };

test('health check público', async () => { const response = await fetch(`${base}/api/health`); assert.equal(response.status, 200); assert.equal((await response.json()).ok, true); });
test('protege os dados sem token', async () => { assert.equal((await fetch(`${base}/api/reports`)).status, 401); });
test('salva e devolve um RDO', async () => {
  const report = { obra: 'Obra teste', local: 'Rua A', status: 'open', data: '2026-09-12' };
  assert.equal((await fetch(`${base}/api/reports/rdo-1`, { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(report) })).status, 200);
  const items = await (await fetch(`${base}/api/reports`, { headers: auth })).json();
  assert.equal(items.length, 1); assert.equal(items[0].obra, 'Obra teste');
});
test('salva, entrega e exclui uma foto', async () => {
  const bytes = Buffer.from('imagem-teste');
  const created = await (await fetch(`${base}/api/reports/rdo-1/photos`, { method: 'POST', headers: { ...auth, 'X-File-Name': 'foto.jpg', 'X-File-Type': 'image/jpeg' }, body: bytes })).json();
  const downloaded = await fetch(`${base}/api/photos/${created.id}/file`, { headers: auth });
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
  assert.equal((await fetch(`${base}/api/photos/${created.id}`, { method: 'DELETE', headers: auth })).status, 204);
});

test.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true }); });

