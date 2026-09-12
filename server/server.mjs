import { createServer } from 'node:http';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

const root = resolve(process.env.RDO_ROOT || join(process.cwd(), '.rdo-server'));
const dataDir = join(root, 'data');
const photoDir = join(root, 'photos');
const databaseFile = join(dataDir, 'database.json');
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';
let token = process.env.RDO_API_TOKEN || '';
let allowedOrigins = (process.env.RDO_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map(value => value.trim()).filter(Boolean);

const emptyDatabase = () => ({ version: 1, reports: {}, works: {}, streets: {}, photos: {} });
let database = emptyDatabase();
let writeQueue = Promise.resolve();

async function initialize() {
  await mkdir(dataDir, { recursive: true });
  await mkdir(photoDir, { recursive: true });
  try {
    const config = JSON.parse(await readFile(join(dataDir, 'config.json'), 'utf8'));
    token ||= String(config.token || '');
    if (Array.isArray(config.allowedOrigins)) allowedOrigins = config.allowedOrigins;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!token && process.env.NODE_ENV !== 'test') throw new Error('RDO_API_TOKEN não configurado');
  try { database = { ...emptyDatabase(), ...JSON.parse(await readFile(databaseFile, 'utf8')) }; }
  catch (error) { if (error.code !== 'ENOENT') throw error; await persist(); }
}

function persist() {
  writeQueue = writeQueue.then(async () => {
    const temporary = `${databaseFile}.${randomBytes(5).toString('hex')}.tmp`;
    await writeFile(temporary, JSON.stringify(database, null, 2));
    await rename(temporary, databaseFile);
  });
  return writeQueue;
}

function sameToken(received) {
  if (!token) return true;
  const expected = Buffer.from(token);
  const actual = Buffer.from(received || '');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-File-Name, X-File-Type, X-Photo-Id');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
}

function json(res, statusCode, value) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

async function body(req, maxBytes = 2_000_000) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > maxBytes) throw Object.assign(new Error('Payload muito grande'), { statusCode: 413 }); chunks.push(chunk); }
  return Buffer.concat(chunks);
}

async function jsonBody(req) {
  const raw = await body(req);
  try { return raw.length ? JSON.parse(raw.toString('utf8')) : {}; }
  catch { throw Object.assign(new Error('JSON inválido'), { statusCode: 400 }); }
}

const collection = name => Object.values(database[name]).sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));

async function route(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/health') return json(res, 200, { ok: true, service: 'RDO Fácil', version: 1 });
  if (!sameToken(req.headers.authorization?.replace(/^Bearer\s+/i, ''))) return json(res, 401, { error: 'Acesso não autorizado' });

  if (url.pathname === '/api/snapshot' && req.method === 'GET') {
    return json(res, 200, { reports: collection('reports'), works: collection('works'), streets: collection('streets') });
  }

  const resource = url.pathname.match(/^\/api\/(reports|works|streets)(?:\/([^/]+))?$/);
  if (resource) {
    const [, name, encodedId] = resource; const id = encodedId && decodeURIComponent(encodedId);
    if (req.method === 'GET') return json(res, 200, id ? database[name][id] || null : collection(name));
    if (req.method === 'PUT' && id) {
      const value = await jsonBody(req); const now = new Date().toISOString();
      database[name][id] = { ...database[name][id], ...value, id, updatedAt: now, createdAt: database[name][id]?.createdAt || value.createdAt || now };
      await persist(); return json(res, 200, database[name][id]);
    }
    if (req.method === 'DELETE' && id) {
      if (name === 'reports') {
        for (const photo of Object.values(database.photos).filter(item => item.reportId === id)) await deletePhoto(photo.id);
      }
      delete database[name][id]; await persist(); res.writeHead(204); return res.end();
    }
  }

  const reportPhotos = url.pathname.match(/^\/api\/reports\/([^/]+)\/photos$/);
  if (reportPhotos) {
    const reportId = decodeURIComponent(reportPhotos[1]);
    if (req.method === 'GET') return json(res, 200, collection('photos').filter(photo => photo.reportId === reportId));
    if (req.method === 'POST') {
      const contents = await body(req, 25_000_000); if (!contents.length) return json(res, 400, { error: 'Foto vazia' });
      const requestedId = String(req.headers['x-photo-id'] || '');
      const id = /^[a-zA-Z0-9-]{8,80}$/.test(requestedId) ? requestedId : randomUUID(); const type = String(req.headers['x-file-type'] || 'image/jpeg');
      const suffix = safeExtension(String(req.headers['x-file-name'] || ''), type); const file = `${id}${suffix}`;
      await writeFile(join(photoDir, file), contents);
      const now = new Date().toISOString();
      database.photos[id] = { id, reportId, name: decodeURIComponent(String(req.headers['x-file-name'] || `foto${suffix}`)), type, caption: '', size: contents.length, file, createdAt: now, updatedAt: now };
      await persist(); return json(res, 201, database.photos[id]);
    }
  }

  const photo = url.pathname.match(/^\/api\/photos\/([^/]+)(?:\/(file))?$/);
  if (photo) {
    const id = decodeURIComponent(photo[1]); const item = database.photos[id];
    if (!item) return json(res, 404, { error: 'Foto não encontrada' });
    if (photo[2] && req.method === 'GET') {
      const info = await stat(join(photoDir, item.file));
      res.writeHead(200, { 'Content-Type': item.type, 'Content-Length': info.size, 'Cache-Control': 'private, max-age=3600' });
      return createReadStream(join(photoDir, item.file)).pipe(res);
    }
    if (req.method === 'PATCH') { const value = await jsonBody(req); item.caption = String(value.caption || ''); item.updatedAt = new Date().toISOString(); await persist(); return json(res, 200, item); }
    if (req.method === 'DELETE') { await deletePhoto(id); await persist(); res.writeHead(204); return res.end(); }
  }
  return json(res, 404, { error: 'Rota não encontrada' });
}

function safeExtension(name, type) {
  const extension = extname(name).toLowerCase();
  if (/^\.(jpe?g|png|webp|gif|heic|heif)$/.test(extension)) return extension;
  return ({ 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/heic': '.heic' })[type] || '.jpg';
}

async function deletePhoto(id) {
  const photo = database.photos[id]; if (!photo) return;
  await rm(join(photoDir, photo.file), { force: true }); delete database.photos[id];
}

await initialize();
export const server = createServer((req, res) => route(req, res).catch(error => json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Erro interno' })));
if (process.env.NODE_ENV !== 'test') server.listen(port, host, () => console.log(`RDO Fácil API em http://${host}:${port}`));
