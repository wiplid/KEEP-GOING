import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const DB_PATH = join(tmpdir(), `kg-store-test-${Date.now()}.db`);

const server = spawn(process.execPath, ['--no-warnings', 'src/server.js'], {
  env: { ...process.env, PORT: String(PORT), DB_PATH },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve) => server.stdout.once('data', resolve));
server.stdout.resume();
async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json();
  return { status: res.status, data };
}

let passed = 0;
async function step(name, fn) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

try {
  console.log('Каталог');
  await step('категории с количеством товаров', async () => {
    const { status, data } = await api('GET', '/api/categories');
    assert.equal(status, 200);
    assert.equal(data.total, 12);
    assert.equal(data.items.find((c) => c.slug === 'bands').productsCount, 3);
  });
  await step('список товаров с пагинацией', async () => {
    const { data } = await api('GET', '/api/products?limit=5&page=2');
    assert.equal(data.items.length, 5);
    assert.equal(data.pages, 3);
  });
  await step('фильтр, поиск и сортировка', async () => {
    const { data } = await api('GET', '/api/products?category=t-shirts&sort=price_desc');
    assert.equal(data.total, 3);
    assert.equal(data.items[0].slug, 'kg-tee-oversize');
    const s = await api('GET', '/api/products?search=band');
    assert.equal(s.data.total, 3);
  });
  await step('плохая сортировка → 400', async () => {
    const { status, data } = await api('GET', '/api/products?sort=wrong');
    assert.equal(status, 400);
    assert.equal(data.error.code, 'BAD_QUERY');
  });
  await step('карточка товара + похожие + картинка отдаётся', async () => {
    const { data } = await api('GET', '/api/products/kg-tee-black');
    assert.deepEqual(data.sizes, ['XS', 'S', 'M', 'L', 'XL', 'XXL']);
    assert.equal(data.related.length, 2);
    const img = await fetch(data.image);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/svg+xml');
  });
  await step('несуществующий товар → 404', async () => {
    const { status } = await api('GET', '/api/products/nope');
    assert.equal(status, 404);
  });

  console.log('Корзина');
  const { data: cart } = await api('POST', '/api/cart');
  const tee = (await api('GET', '/api/products/kg-tee-black')).data;
  const towel = (await api('GET', '/api/products/kg-towel')).data;
  const towelXl = (await api('GET', '/api/products/kg-towel-xl')).data;
  const oversize = (await api('GET', '/api/products/kg-tee-oversize')).data;

  await step('товар с размером без размера → 422', async () => {
    const { status, data } = await api('POST', `/api/cart/${cart.id}/items`, { productId: tee.id });
    assert.equal(status, 422);
    assert.ok(data.error.details.size);
  });
  await step('добавление и слияние одинаковых позиций', async () => {
    await api('POST', `/api/cart/${cart.id}/items`, { productId: tee.id, size: 'M' });
    const { data } = await api('POST', `/api/cart/${cart.id}/items`, { productId: tee.id, size: 'M', quantity: 2 });
    assert.equal(data.items.length, 1);
    assert.equal(data.items[0].quantity, 3);
    assert.equal(data.total, 3 * 2490);
  });
  await step('нет в наличии → 409', async () => {
    const r1 = await api('POST', `/api/cart/${cart.id}/items`, { productId: towelXl.id });
    assert.equal(r1.status, 409);
    const r2 = await api('POST', `/api/cart/${cart.id}/items`, { productId: oversize.id, size: 'L', quantity: 4 });
    assert.equal(r2.data.error.details.available, 3);
  });
  let towelItemId;
  await step('изменение количества и удаление', async () => {
    const { data } = await api('POST', `/api/cart/${cart.id}/items`, { productId: towel.id });
    towelItemId = data.items.at(-1).id;
    const upd = await api('PATCH', `/api/cart/${cart.id}/items/${towelItemId}`, { quantity: 2 });
    assert.equal(upd.data.totalQuantity, 5);
    const del = await api('DELETE', `/api/cart/${cart.id}/items/${towelItemId}`);
    assert.equal(del.data.totalQuantity, 3);
  });
  await step('битый JSON → 400', async () => {
    const res = await fetch(`${BASE}/api/cart/${cart.id}/items`, { method: 'POST', body: '{oops' });
    assert.equal(res.status, 400);
  });

  console.log('Авторизация и заказ');
  const reg = await api('POST', '/api/auth/register', { name: 'Аня', email: 'anya@test.ru', password: 'secret1' });
  await step('регистрация, повтор email → 409', async () => {
    assert.equal(reg.status, 201);
    const again = await api('POST', '/api/auth/register', { name: 'Аня', email: 'ANYA@test.ru', password: 'secret1' });
    assert.equal(again.status, 409);
  });
  await step('вход и /me', async () => {
    const bad = await api('POST', '/api/auth/login', { email: 'anya@test.ru', password: 'wrong' });
    assert.equal(bad.status, 401);
    const { data } = await api('POST', '/api/auth/login', { email: 'anya@test.ru', password: 'secret1' });
    const me = await api('GET', '/api/auth/me', null, data.token);
    assert.equal(me.data.email, 'anya@test.ru');
  });
  await step('валидация заказа → 422 с полями', async () => {
    const { status, data } = await api('POST', '/api/orders', {
      cartId: cart.id, customer: { name: 'А', email: 'x', phone: '12' }, delivery: { type: 'courier' },
    });
    assert.equal(status, 422);
    assert.deepEqual(Object.keys(data.error.details).sort(),
      ['customer.email', 'customer.name', 'customer.phone', 'delivery.address']);
  });
  let order;
  await step('оформление заказа: доставка бесплатна от 5000 ₽, корзина очищена, остаток уменьшен', async () => {
    const { status, data } = await api('POST', '/api/orders', {
      cartId: cart.id,
      customer: { name: 'Аня', email: 'anya@test.ru', phone: '+7 (900) 123-45-67' },
      delivery: { type: 'courier', address: 'Челябинск, ул. Ленина, 1' },
    }, reg.data.token);
    assert.equal(status, 201);
    assert.match(data.number, /^KG-\d{5}$/);
    assert.equal(data.deliveryPrice, 0);
    assert.equal(data.total, 7470);
    order = data;
    const c = await api('GET', `/api/cart/${cart.id}`);
    assert.equal(c.data.items.length, 0);
    const t = await api('GET', '/api/products/kg-tee-black');
    assert.equal(t.data.stock, 57);
  });
  await step('пустая корзина → 409, заказ виден по id и в /api/orders', async () => {
    const empty = await api('POST', '/api/orders', {
      cartId: cart.id, customer: { name: 'Аня', email: 'anya@test.ru', phone: '89001234567' }, delivery: { type: 'pickup' },
    });
    assert.equal(empty.data.error.code, 'CART_EMPTY');
    const byId = await api('GET', `/api/orders/${order.id}`);
    assert.equal(byId.data.number, order.number);
    const mine = await api('GET', '/api/orders', null, reg.data.token);
    assert.equal(mine.data.items.length, 1);
    const anon = await api('GET', '/api/orders');
    assert.equal(anon.status, 401);
  });
  await step('платная доставка для заказа < 5000 ₽', async () => {
    const { data: c2 } = await api('POST', '/api/cart');
    await api('POST', `/api/cart/${c2.id}/items`, { productId: towel.id });
    const { data } = await api('POST', '/api/orders', {
      cartId: c2.id, customer: { name: 'Гость', email: 'g@test.ru', phone: '89001234567' },
      delivery: { type: 'courier', address: 'Москва, Тверская, 7' },
    });
    assert.equal(data.deliveryPrice, 300);
    assert.equal(data.total, 1590);
  });

  console.log('Прочее');
  await step('подписка на рассылку', async () => {
    assert.equal((await api('POST', '/api/newsletter', { email: 'a@b.ru' })).status, 201);
    assert.equal((await api('POST', '/api/newsletter', { email: 'a@b.ru' })).status, 409);
    assert.equal((await api('POST', '/api/newsletter', { email: 'nope' })).status, 422);
  });
  await step('405 и 404 на маршрутах, CORS', async () => {
    assert.equal((await api('PATCH', '/api/products')).status, 405);
    assert.equal((await api('GET', '/api/unknown')).status, 404);
    const res = await fetch(`${BASE}/api/products`, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  });

  console.log(`\nВсё ок: ${passed} проверок`);
} catch (err) {
  console.error('\n✗ Тест упал:', err.message);
  process.exitCode = 1;
} finally {
  server.kill();
}
