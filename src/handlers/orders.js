import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { HttpError, notFound, Validator, EMAIL_RE, isNonEmptyString, transaction } from '../utils.js';
import { buildCart } from './cart.js';
import { currentUser, requireUser } from './auth.js';

export const COURIER_PRICE = 300;
export const FREE_DELIVERY_FROM = 5000;

const STATUS_LABELS = { new: 'Новый', paid: 'Оплачен', shipped: 'Отправлен', done: 'Получен', cancelled: 'Отменён' };

function toOrder(order, baseUrl) {
  const items = db.prepare(`
    SELECT oi.*, p.slug, p.images FROM order_items oi JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ? ORDER BY oi.id
  `).all(order.id);

  return {
    id: order.id,
    number: order.number,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status] ?? order.status,
    customer: { name: order.customer_name, email: order.email, phone: order.phone },
    delivery: { type: order.delivery_type, address: order.address, price: order.delivery_price },
    comment: order.comment,
    items: items.map((i) => ({
      productId: i.product_id,
      slug: i.slug,
      name: i.name,
      image: `${baseUrl}/images/${JSON.parse(i.images)[0]}`,
      price: i.price,
      size: i.size,
      quantity: i.quantity,
      lineTotal: i.price * i.quantity,
    })),
    subtotal: order.subtotal,
    deliveryPrice: order.delivery_price,
    total: order.total,
    createdAt: order.created_at,
  };
}

export const deliveryInfo = () => ({
  options: [
    { type: 'pickup', name: 'Самовывоз', price: 0 },
    { type: 'courier', name: 'Курьер', price: COURIER_PRICE, freeFrom: FREE_DELIVERY_FROM },
  ],
});

export function createOrder(ctx) {
  const { body, baseUrl } = ctx;
  const customer = body.customer ?? {};
  const delivery = body.delivery ?? {};
  const phoneDigits = String(customer.phone ?? '').replace(/\D/g, '');

  new Validator()
    .check(isNonEmptyString(body.cartId), 'cartId', 'Не передан cartId')
    .check(isNonEmptyString(customer.name, 2), 'customer.name', 'Имя — минимум 2 символа')
    .check(typeof customer.email === 'string' && EMAIL_RE.test(customer.email), 'customer.email', 'Некорректный email')
    .check(phoneDigits.length >= 10 && phoneDigits.length <= 15, 'customer.phone', 'Телефон — от 10 до 15 цифр')
    .check(['pickup', 'courier'].includes(delivery.type), 'delivery.type', 'Способ доставки: pickup или courier')
    .check(delivery.type !== 'courier' || isNonEmptyString(delivery.address, 5), 'delivery.address', 'Укажите адрес доставки')
    .check(body.comment === undefined || (typeof body.comment === 'string' && body.comment.length <= 500), 'comment', 'Комментарий — до 500 символов')
    .throwIfInvalid();

  const cart = buildCart(body.cartId, baseUrl);
  if (cart.items.length === 0) throw new HttpError(409, 'CART_EMPTY', 'Корзина пуста');

  const problems = cart.items
    .filter((i) => i.product.stock < i.quantity)
    .map((i) => ({ itemId: i.id, productId: i.product.id, name: i.product.name, available: i.product.stock }));
  if (problems.length) {
    throw new HttpError(409, 'OUT_OF_STOCK', 'Некоторых товаров не хватает на складе', { items: problems });
  }

  const subtotal = cart.total;
  const deliveryPrice = delivery.type === 'courier' && subtotal < FREE_DELIVERY_FROM ? COURIER_PRICE : 0;
  const user = currentUser(ctx.req);
  const id = randomUUID();

  transaction(db, () => {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO orders (id, user_id, customer_name, email, phone, delivery_type, address, comment,
                          subtotal, delivery_price, total, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, user?.id ?? null, customer.name.trim(), customer.email.trim(), String(customer.phone).trim(),
      delivery.type, delivery.type === 'courier' ? delivery.address.trim() : null, body.comment?.trim() || null,
      subtotal, deliveryPrice, subtotal + deliveryPrice, new Date().toISOString(),
    );
    db.prepare('UPDATE orders SET number = ? WHERE id = ?')
      .run(`KG-${String(lastInsertRowid).padStart(5, '0')}`, id);

    const insItem = db.prepare(
      'INSERT INTO order_items (order_id, product_id, name, price, size, quantity) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    for (const item of cart.items) {
      insItem.run(id, item.product.id, item.product.name, item.product.price, item.size, item.quantity);
      decStock.run(item.quantity, item.product.id);
    }
    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(body.cartId);
  });

  ctx.status = 201;
  return toOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(id), baseUrl);
}

export function getOrder({ params, baseUrl }) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(params.id);
  if (!order) throw notFound('ORDER_NOT_FOUND', 'Заказ не найден');
  return toOrder(order, baseUrl);
}

export function myOrders({ req, baseUrl }) {
  const user = requireUser(req);
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  return { items: rows.map((o) => toOrder(o, baseUrl)) };
}
