import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = process.env.DB_PATH || fileURLToPath(new URL('../data/store.db', import.meta.url));
for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });

await import('./db.js');
console.log('База пересоздана:', path);
