// Nhập toàn bộ crawl/bingo18.db lên Turso (chạy một lần, chạy lại an toàn vì INSERT OR IGNORE)
//   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node server/import-to-turso.mjs
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

if (!process.env.TURSO_DATABASE_URL) throw new Error('Thiếu TURSO_DATABASE_URL');
const SOURCE_DB = process.env.BINGO_DB || fileURLToPath(new URL('../crawl/bingo18.db', import.meta.url));
const BATCH_SIZE = 500;

const source = new DatabaseSync(SOURCE_DB, { readOnly: true });
const rows = source.prepare('SELECT id, drawn_at, result FROM draws ORDER BY drawn_at').all();
const dest = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

await dest.execute('CREATE TABLE IF NOT EXISTS draws (id TEXT PRIMARY KEY, drawn_at TEXT NOT NULL, result TEXT NOT NULL)');
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  await dest.batch(
    rows.slice(i, i + BATCH_SIZE).map((r) => ({
      sql: 'INSERT OR IGNORE INTO draws (id, drawn_at, result) VALUES (?, ?, ?)',
      args: [r.id, r.drawn_at, r.result],
    })),
    'write'
  );
  console.log(`${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
}
const { rows: [{ n }] } = await dest.execute('SELECT COUNT(*) AS n FROM draws');
console.log(`Xong: ${n} kì trên đích, ${rows.length} kì ở nguồn`);
