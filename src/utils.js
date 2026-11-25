export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (code, message) => new HttpError(404, code, message);

export function sendJson(res, status, data) {
  if (status === 204) {
    res.writeHead(204);
    return res.end();
  }
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export function sendError(res, err) {
  const status = err instanceof HttpError ? err.status : 500;
  const error = {
    code: err instanceof HttpError ? err.code : 'INTERNAL_ERROR',
    message: err instanceof HttpError ? err.message : 'Что-то сломалось на сервере',
  };
  if (err instanceof HttpError && err.details) error.details = err.details;
  sendJson(res, status, { error });
}

const MAX_BODY = 1024 * 1024;

export function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Тело запроса больше 1 МБ'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return reject(new HttpError(400, 'INVALID_JSON', 'Тело запроса должно быть JSON-объектом'));
        }
        resolve(parsed);
      } catch {
        reject(new HttpError(400, 'INVALID_JSON', 'Не удалось разобрать JSON. Проверьте заголовок Content-Type и тело запроса'));
      }
    });
    req.on('error', reject);
  });
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class Validator {
  constructor() {
    this.errors = {};
  }
  check(condition, field, message) {
    if (!condition && !this.errors[field]) this.errors[field] = message;
    return this;
  }
  throwIfInvalid() {
    if (Object.keys(this.errors).length) {
      throw new HttpError(422, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей', this.errors);
    }
  }
}

export const isNonEmptyString = (v, min = 1) => typeof v === 'string' && v.trim().length >= min;

export function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
