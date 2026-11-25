import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from '../db.js';
import { HttpError, Validator, EMAIL_RE, isNonEmptyString } from '../utils.js';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

const toUser = (u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.created_at });

function createSession(userId) {
  const token = randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
    .run(token, userId, new Date().toISOString());
  return token;
}

function readToken(req) {
  const header = req.headers.authorization ?? '';
  const [type, token] = header.split(' ');
  return type === 'Bearer' && token ? token : null;
}

export function currentUser(req) {
  const token = readToken(req);
  if (!token) return null;
  const user = db.prepare(`
    SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?
  `).get(token);
  return user ?? null;
}

export function requireUser(req) {
  const user = currentUser(req);
  if (!user) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Нужна авторизация: передайте заголовок Authorization: Bearer <token>');
  }
  return user;
}

export function register(ctx) {
  const { name, email, password } = ctx.body;
  new Validator()
    .check(isNonEmptyString(name, 2), 'name', 'Имя — минимум 2 символа')
    .check(typeof email === 'string' && EMAIL_RE.test(email), 'email', 'Некорректный email')
    .check(typeof password === 'string' && password.length >= 6, 'password', 'Пароль — минимум 6 символов')
    .throwIfInvalid();

  const normalized = email.trim().toLowerCase();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(normalized)) {
    throw new HttpError(409, 'EMAIL_TAKEN', 'Пользователь с таким email уже зарегистрирован', { email: 'Email уже занят' });
  }

  const { lastInsertRowid } = db.prepare(
    'INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)',
  ).run(normalized, name.trim(), hashPassword(password), new Date().toISOString());

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
  ctx.status = 201;
  return { token: createSession(user.id), user: toUser(user) };
}

export function login({ body }) {
  const { email, password } = body;
  new Validator()
    .check(typeof email === 'string' && email.length > 0, 'email', 'Введите email')
    .check(typeof password === 'string' && password.length > 0, 'password', 'Введите пароль')
    .throwIfInvalid();

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль');
  }
  return { token: createSession(user.id), user: toUser(user) };
}

export const me = ({ req }) => toUser(requireUser(req));

export function logout(ctx) {
  requireUser(ctx.req);
  db.prepare('DELETE FROM sessions WHERE token = ?').run(readToken(ctx.req));
  ctx.status = 204;
}
