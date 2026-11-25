import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed } from './seed.js';

const DEFAULT_PATH = fileURLToPath(new URL('../data/store.db', import.meta.url));
export const DB_PATH = process.env.DB_PATH || DEFAULT_PATH;

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id        INTEGER PRIMARY KEY,
  slug      TEXT NOT NULL UNIQUE,
  name      TEXT NOT NULL,
  position  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id           INTEGER PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  price        INTEGER NOT NULL,            -- в рублях
  old_price    INTEGER,                     -- цена до скидки
  category_id  INTEGER NOT NULL REFERENCES categories(id),
  images       TEXT NOT NULL,               -- JSON-массив имён файлов
  sizes        TEXT,                        -- JSON-массив или NULL
  stock        INTEGER NOT NULL DEFAULT 0,
  is_new       INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS carts (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cart_items (
  id          INTEGER PRIMARY KEY,
  cart_id     TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  size        TEXT NOT NULL DEFAULT '',
  quantity    INTEGER NOT NULL,
  UNIQUE (cart_id, product_id, size)
);

CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  number          TEXT UNIQUE,
  user_id         INTEGER REFERENCES users(id),
  customer_name   TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT NOT NULL,
  delivery_type   TEXT NOT NULL,
  address         TEXT,
  comment         TEXT,
  subtotal        INTEGER NOT NULL,
  delivery_price  INTEGER NOT NULL,
  total           INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'new',
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id          INTEGER PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  name        TEXT NOT NULL,
  price       INTEGER NOT NULL,
  size        TEXT,
  quantity    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subscribers (
  email       TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL
);
`);

const { n } = db.prepare('SELECT COUNT(*) AS n FROM products').get();
if (n === 0) seed(db);
