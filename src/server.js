import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import './db.js';
import { Router } from './router.js';
import { HttpError, readJson, sendJson, sendError } from './utils.js';
import * as catalog from './handlers/catalog.js';
import * as cart from './handlers/cart.js';
import * as auth from './handlers/auth.js';
import * as orders from './handlers/orders.js';
import * as newsletter from './handlers/newsletter.js';

const PORT = Number(process.env.PORT) || 3000;
const DELAY_MS = Number(process.env.DELAY_MS) || 0;
const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

const router = new Router()
  .get('/api', () => ({
    name: 'KEEP GOING store API',
    docs: 'Смотрите API.md в репозитории',
    endpoints: [
      'GET    /api/categories',
      'GET    /api/products',
      'GET    /api/products/:slug',
      'POST   /api/cart',
      'GET    /api/cart/:cartId',
      'DELETE /api/cart/:cartId',
      'POST   /api/cart/:cartId/items',
      'PATCH  /api/cart/:cartId/items/:itemId',
      'DELETE /api/cart/:cartId/items/:itemId',
      'GET    /api/delivery',
      'POST   /api/orders',
      'GET    /api/orders',
      'GET    /api/orders/:id',
      'POST   /api/auth/register',
      'POST   /api/auth/login',
      'GET    /api/auth/me',
      'POST   /api/auth/logout',
      'POST   /api/newsletter',
    ],
  }))
  .get('/api/categories', catalog.listCategories)
  .get('/api/products', catalog.listProducts)
  .get('/api/products/:slug', catalog.getProduct)

  .post('/api/cart', cart.createCart)
  .get('/api/cart/:cartId', cart.getCart)
  .delete('/api/cart/:cartId', cart.clearCart)
  .post('/api/cart/:cartId/items', cart.addItem)
  .patch('/api/cart/:cartId/items/:itemId', cart.updateItem)
  .delete('/api/cart/:cartId/items/:itemId', cart.removeItem)

  .get('/api/delivery', orders.deliveryInfo)
  .post('/api/orders', orders.createOrder)
  .get('/api/orders', orders.myOrders)
  .get('/api/orders/:id', orders.getOrder)

  .post('/api/auth/register', auth.register)
  .post('/api/auth/login', auth.login)
  .get('/api/auth/me', auth.me)
  .post('/api/auth/logout', auth.logout)

  .post('/api/newsletter', newsletter.subscribe);

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

function serveStatic(pathname, res) {
  const filePath = normalize(join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new HttpError(404, 'NOT_FOUND', 'Файл не найден');
  }
  res.writeHead(200, {
    'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': 'public, max-age=3600',
  });
  createReadStream(filePath).pipe(res);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  setCors(res);
  res.on('finish', () => {
    if (req.method !== 'OPTIONS') console.log(`${req.method} ${req.url} → ${res.statusCode} (${Date.now() - started} мс)`);
  });

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    if (DELAY_MS) await new Promise((r) => setTimeout(r, DELAY_MS));

    if (req.method === 'GET' && url.pathname.startsWith('/images/')) return serveStatic(url.pathname, res);

    const { handler, params, pathMatched } = router.match(req.method, url.pathname);
    if (!handler) {
      throw pathMatched
        ? new HttpError(405, 'METHOD_NOT_ALLOWED', `Метод ${req.method} не поддерживается для ${url.pathname}`)
        : new HttpError(404, 'NOT_FOUND', `Маршрут ${url.pathname} не найден`);
    }

    const ctx = {
      req,
      res,
      url,
      params,
      query: Object.fromEntries(url.searchParams),
      baseUrl: `http://${req.headers.host ?? `localhost:${PORT}`}`,
      body: ['POST', 'PATCH'].includes(req.method) ? await readJson(req) : undefined,
      status: 200,
    };
    const data = await handler(ctx);
    sendJson(res, ctx.status, data);
  } catch (err) {
    if (!(err instanceof HttpError)) console.error(err);
    if (!res.headersSent) sendError(res, err);
  }
});

server.listen(PORT, () => {
  console.log(`KEEP GOING API: http://localhost:${PORT}/api`);
  if (DELAY_MS) console.log(`Задержка ответов: ${DELAY_MS} мс`);
});
