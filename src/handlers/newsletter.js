import { db } from '../db.js';
import { HttpError, Validator, EMAIL_RE } from '../utils.js';

export function subscribe(ctx) {
  const { email } = ctx.body;
  new Validator()
    .check(typeof email === 'string' && EMAIL_RE.test(email), 'email', 'Некорректный email')
    .throwIfInvalid();

  const normalized = email.trim().toLowerCase();
  if (db.prepare('SELECT 1 FROM subscribers WHERE email = ?').get(normalized)) {
    throw new HttpError(409, 'ALREADY_SUBSCRIBED', 'Этот email уже подписан');
  }
  db.prepare('INSERT INTO subscribers (email, created_at) VALUES (?, ?)').run(normalized, new Date().toISOString());
  ctx.status = 201;
  return { email: normalized, subscribed: true };
}
