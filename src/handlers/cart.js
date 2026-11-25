import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { HttpError, notFound, Validator } from '../utils.js';
import { toProduct } from './catalog.js';

const now = () => new Date().toISOString();

function ensureCart(cartId) {
  const cart = db.prepare('SELECT * FROM carts WHERE id = ?').get(cartId);
  if (!cart) throw notFound('CART_NOT_FOUND', 'Корзина не найдена. Создайте новую через POST /api/cart');
  return cart;
}

const touch = (cartId) => db.prepare('UPDATE carts SET updated_at = ? WHERE id = ?').run(now(), cartId);

export function buildCart(cartId, baseUrl) {
  const cart = ensureCart(cartId);
  const rows = db.prepare(`
    SELECT ci.id AS item_id, ci.size AS item_size, ci.quantity AS item_quantity,
           p.*, c.slug AS category_slug, c.name AS category_name
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE ci.cart_id = ? ORDER BY ci.id
  `).all(cartId);

  const items = rows.map((r) => {
    const product = toProduct(r, baseUrl);
    return {
      id: r.item_id,
      quantity: r.item_quantity,
      size: r.item_size || null,
      lineTotal: product.price * r.item_quantity,
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        image: product.image,
        stock: product.stock,
        inStock: product.inStock,
      },
    };
  });

  return {
    id: cart.id,
    items,
    totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
    total: items.reduce((s, i) => s + i.lineTotal, 0),
    updatedAt: cart.updated_at,
  };
}

export function createCart(ctx) {
  const id = randomUUID();
  const ts = now();
  db.prepare('INSERT INTO carts (id, created_at, updated_at) VALUES (?, ?, ?)').run(id, ts, ts);
  ctx.status = 201;
  return buildCart(id, ctx.baseUrl);
}

export const getCart = ({ params, baseUrl }) => buildCart(params.cartId, baseUrl);

export function clearCart({ params, baseUrl }) {
  ensureCart(params.cartId);
  db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(params.cartId);
  touch(params.cartId);
  return buildCart(params.cartId, baseUrl);
}

export function addItem({ params, body, baseUrl }) {
  ensureCart(params.cartId);
  const quantity = body.quantity ?? 1;

  const v = new Validator()
    .check(Number.isInteger(body.productId), 'productId', 'Укажите productId (число)')
    .check(Number.isInteger(quantity) && quantity >= 1 && quantity <= 99, 'quantity', 'Количество — целое число от 1 до 99');
  v.throwIfInvalid();

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(body.productId);
  if (!product) throw notFound('PRODUCT_NOT_FOUND', 'Товар не найден');

  const sizes = product.sizes ? JSON.parse(product.sizes) : null;
  const size = sizes ? body.size : '';
  if (sizes && !sizes.includes(size)) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Выберите размер', { size: `Доступные размеры: ${sizes.join(', ')}` });
  }

  const existing = db.prepare('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ? AND size = ?')
    .get(params.cartId, product.id, size);
  const newQty = (existing?.quantity ?? 0) + quantity;

  if (product.stock < newQty) {
    throw new HttpError(409, 'OUT_OF_STOCK',
      product.stock === 0 ? 'Товара нет в наличии' : `В наличии только ${product.stock} шт.`,
      { available: product.stock });
  }

  if (existing) {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(newQty, existing.id);
  } else {
    db.prepare('INSERT INTO cart_items (cart_id, product_id, size, quantity) VALUES (?, ?, ?, ?)')
      .run(params.cartId, product.id, size, quantity);
  }
  touch(params.cartId);
  return buildCart(params.cartId, baseUrl);
}

function ensureItem(cartId, itemId) {
  const item = db.prepare('SELECT * FROM cart_items WHERE id = ? AND cart_id = ?').get(Number(itemId), cartId);
  if (!item) throw notFound('CART_ITEM_NOT_FOUND', 'Позиция в корзине не найдена');
  return item;
}

export function updateItem({ params, body, baseUrl }) {
  ensureCart(params.cartId);
  const item = ensureItem(params.cartId, params.itemId);

  new Validator()
    .check(Number.isInteger(body.quantity) && body.quantity >= 0 && body.quantity <= 99, 'quantity', 'Количество — целое число от 0 до 99')
    .throwIfInvalid();

  if (body.quantity === 0) {
    db.prepare('DELETE FROM cart_items WHERE id = ?').run(item.id);
  } else {
    const { stock } = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.product_id);
    if (stock < body.quantity) {
      throw new HttpError(409, 'OUT_OF_STOCK', `В наличии только ${stock} шт.`, { available: stock });
    }
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(body.quantity, item.id);
  }
  touch(params.cartId);
  return buildCart(params.cartId, baseUrl);
}

export function removeItem({ params, baseUrl }) {
  ensureCart(params.cartId);
  const item = ensureItem(params.cartId, params.itemId);
  db.prepare('DELETE FROM cart_items WHERE id = ?').run(item.id);
  touch(params.cartId);
  return buildCart(params.cartId, baseUrl);
}
