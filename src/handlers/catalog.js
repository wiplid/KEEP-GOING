import { db } from '../db.js';
import { HttpError, notFound, toInt } from '../utils.js';

const SELECT_PRODUCT = `
  SELECT p.*, c.slug AS category_slug, c.name AS category_name
  FROM products p JOIN categories c ON c.id = p.category_id
`;

const imageUrl = (baseUrl, file) => `${baseUrl}/images/${file}`;

export function toProduct(row, baseUrl) {
  const images = JSON.parse(row.images).map((f) => imageUrl(baseUrl, f));
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    price: row.price,
    oldPrice: row.old_price ?? null,
    category: { slug: row.category_slug, name: row.category_name },
    image: images[0],
    images,
    sizes: row.sizes ? JSON.parse(row.sizes) : null,
    stock: row.stock,
    inStock: row.stock > 0,
    isNew: Boolean(row.is_new),
    createdAt: row.created_at,
  };
}

export function listCategories() {
  const items = db.prepare(`
    SELECT c.slug, c.name, COUNT(p.id) AS productsCount
    FROM categories c LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id ORDER BY c.position
  `).all();
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM products').get();
  return { total, items };
}

const SORTS = {
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'p.price ASC, p.id ASC',
  price_desc: 'p.price DESC, p.id ASC',
  name: 'p.name COLLATE NOCASE ASC',
};

export function listProducts({ query, baseUrl }) {
  const where = [];
  const params = {};

  if (query.category) {
    where.push('c.slug = :category');
    params.category = query.category;
  }
  if (query.search?.trim()) {
    where.push('(p.name LIKE :q OR p.description LIKE :q)');
    params.q = `%${query.search.trim()}%`;
  }
  if (query.minPrice !== undefined) {
    where.push('p.price >= :minPrice');
    params.minPrice = toInt(query.minPrice, 0);
  }
  if (query.maxPrice !== undefined) {
    where.push('p.price <= :maxPrice');
    params.maxPrice = toInt(query.maxPrice, Number.MAX_SAFE_INTEGER);
  }
  if (query.inStock === 'true') where.push('p.stock > 0');
  if (query.isNew === 'true') where.push('p.is_new = 1');

  const sort = query.sort ?? 'newest';
  if (!SORTS[sort]) {
    throw new HttpError(400, 'BAD_QUERY', `Неизвестная сортировка "${sort}". Допустимо: ${Object.keys(SORTS).join(', ')}`);
  }

  const limit = Math.min(Math.max(toInt(query.limit, 12), 1), 50);
  const page = Math.max(toInt(query.page, 1), 1);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { total } = db.prepare(`
    SELECT COUNT(*) AS total FROM products p JOIN categories c ON c.id = p.category_id ${whereSql}
  `).get(params);

  const rows = db.prepare(`${SELECT_PRODUCT} ${whereSql} ORDER BY ${SORTS[sort]} LIMIT :limit OFFSET :offset`)
    .all({ ...params, limit, offset: (page - 1) * limit });

  return {
    items: rows.map((r) => toProduct(r, baseUrl)),
    total,
    page,
    limit,
    pages: Math.max(Math.ceil(total / limit), 1),
  };
}

export function getProduct({ params, baseUrl }) {
  const key = params.slug;
  const row = /^\d+$/.test(key)
    ? db.prepare(`${SELECT_PRODUCT} WHERE p.id = ?`).get(Number(key))
    : db.prepare(`${SELECT_PRODUCT} WHERE p.slug = ?`).get(key);
  if (!row) throw notFound('PRODUCT_NOT_FOUND', 'Товар не найден');

  const related = db.prepare(`${SELECT_PRODUCT} WHERE p.category_id = ? AND p.id != ? ORDER BY p.created_at DESC LIMIT 4`)
    .all(row.category_id, row.id);

  return { ...toProduct(row, baseUrl), related: related.map((r) => toProduct(r, baseUrl)) };
}
