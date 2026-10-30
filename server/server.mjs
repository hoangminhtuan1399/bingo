// Backend nhỏ phục vụ "offline results" và nhận kì mới từ app (chạy: npm start)
// DB: Turso khi có TURSO_DATABASE_URL, không thì file local crawl/bingo18.db (cùng một code, libSQL = SQLite)
import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

const PORT = Number(process.env.PORT) || 8787;
const LOCAL_DB = process.env.BINGO_DB || fileURLToPath(new URL('../crawl/bingo18.db', import.meta.url));
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || pathToFileURL(LOCAL_DB).href,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LIMIT = 200000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

// POST (ghi DB) chỉ nhận từ localhost hoặc origin trong ALLOWED_ORIGINS (phân tách bằng dấu phẩy), chặn trang web lạ.
// Có SYNC_TOKEN thì POST còn phải gửi đúng header X-Sync-Token (client không phải trình duyệt giả được Origin)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://hoangminhtuan1399.github.io').split(',');
const SYNC_TOKEN = process.env.SYNC_TOKEN;
const isAllowedOrigin = (origin) =>
  !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || ALLOWED_ORIGINS.includes(origin);
const sha256 = (s) => createHash('sha256').update(String(s)).digest();
const hasValidToken = (req) =>
  !SYNC_TOKEN || timingSafeEqual(sha256(req.headers['x-sync-token'] ?? ''), sha256(SYNC_TOKEN));

// Toàn bộ kì (tăng dần theo giờ) giữ trong bộ nhớ: ~110k kì, chỉ đọc DB một lần khi khởi động rồi cập nhật sau mỗi sync.
// Nếu có tiến trình khác sửa DB (VD chạy lại crawl.py khi dùng file local) thì cần khởi động lại server
let draws = null;
async function loadDraws() {
  draws ??= db.execute('SELECT id, drawn_at, result FROM draws ORDER BY drawn_at').then((rs) =>
    rs.rows.map((r) => ({ id: r.id, drawn_at: r.drawn_at, result: r.result }))
  );
  try {
    return await draws;
  } catch (e) {
    draws = null; // lần sau thử lại
    throw e;
  }
}

// from/to dạng YYYY-MM-DD (tính cả ngày `to`), limit = lấy N kì mới nhất
function filterDraws(all, { from, to, limit }) {
  let rows = all;
  if (from) rows = rows.filter((r) => r.drawn_at >= from);
  if (to) rows = rows.filter((r) => r.drawn_at.slice(0, 10) <= to);
  return limit ? rows.slice(-limit) : rows;
}

function parseParams(search) {
  const from = search.get('from') || undefined;
  const to = search.get('to') || undefined;
  const limit = search.has('limit') ? Number(search.get('limit')) : undefined;
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) throw new Error('from/to phải dạng YYYY-MM-DD');
  if (limit !== undefined && !(Number.isInteger(limit) && limit > 0 && limit <= MAX_LIMIT)) {
    throw new Error(`limit phải là số nguyên từ 1 đến ${MAX_LIMIT}`);
  }
  return { from, to, limit };
}

// Id kì liên tục theo khung giờ: mỗi ngày 159 kì, kì đầu 6:05, cách nhau 6 phút, kì cuối 21:53 (GMT+7)
const FIRST_SLOT_MIN = 6 * 60 + 5;
const STEP_MIN = 6;
const SLOTS_PER_DAY = 159;
const DRAW_AT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):00\+07:00$/;

// Thứ tự khung giờ tuyệt đối của kì; null nếu drawAt sai định dạng hoặc lệch lưới giờ
function slotIndex(drawAt) {
  const m = DRAW_AT_RE.exec(drawAt);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const offset = h * 60 + mi - FIRST_SLOT_MIN;
  if (offset < 0 || offset % STEP_MIN || offset / STEP_MIN >= SLOTS_PER_DAY) return null;
  return Math.round(Date.UTC(y, mo - 1, d) / 86400000) * SLOTS_PER_DAY + offset / STEP_MIN;
}

// Thêm các kì mới hơn kì cuối trong DB. API online không có id nên id = id kì cuối + số khung giờ cách nhau
async function syncDraws(input) {
  if (!Array.isArray(input)) throw new Error('gbingoDraws phải là mảng');
  const all = await loadDraws();
  const last = all.findLast((r) => !r.id.includes('.'));
  const lastSlot = slotIndex(last.drawn_at);
  const lastId = Number(last.id);
  const maxTime = Date.now() + 60000;

  const fresh = new Map();
  let ignored = 0;
  for (const d of input) {
    const slot = typeof d?.drawAt === 'string' ? slotIndex(d.drawAt) : null;
    const valid = slot !== null && /^[1-6]{3}$/.test(d.winningResult) && Date.parse(d.drawAt) <= maxTime;
    if (!valid || d.drawAt <= last.drawn_at) ignored++;
    else fresh.set(d.drawAt, { slot, drawAt: d.drawAt, result: d.winningResult });
  }
  const rows = [...fresh.values()]
    .sort((a, b) => a.slot - b.slot)
    .map((r) => ({ slot: r.slot, id: String(lastId + r.slot - lastSlot).padStart(7, '0'), drawn_at: r.drawAt, result: r.result }));

  if (rows.length) {
    await db.batch(
      rows.map((r) => ({ sql: 'INSERT INTO draws (id, drawn_at, result) VALUES (?, ?, ?)', args: [r.id, r.drawn_at, r.result] })),
      'write'
    );
    all.push(...rows.map(({ id, drawn_at, result }) => ({ id, drawn_at, result })));
  }
  // Số khung giờ giữa kì cuối cũ và kì mới nhất mà API online không có (quá cũ so với cửa sổ ~6 ngày của API)
  const missing = rows.length ? rows.at(-1).slot - lastSlot - rows.length : 0;
  return { added: rows.length, ignored, missing, latest: toLatest(all.at(-1)) };
}

// Hai request sync đồng thời sẽ cùng tính id từ một kì cuối, nên xếp hàng xử lý lần lượt
let syncQueue = Promise.resolve();
const enqueueSync = (input) => {
  const run = syncQueue.then(() => syncDraws(input));
  syncQueue = run.catch(() => {});
  return run;
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { reject(new Error('body quá lớn')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

const toDraw = (r) => ({ drawAt: r.drawn_at, winningResult: r.result });
const toLatest = (r) => ({ id: r.id, ...toDraw(r) });

const routes = {
  // Cùng định dạng https://bingo18.top/data/data.json mà app đang dùng (fetchOffUrl)
  '/data.json': async (search) => ({ gbingoDraws: filterDraws(await loadDraws(), parseParams(search)).map(toDraw) }),
  '/draws': async (search) =>
    filterDraws(await loadDraws(), parseParams(search)).map((r) => ({ id: r.id, ...toDraw(r) })),
  '/latest': async () => toLatest((await loadDraws()).at(-1)),
  '/health': () => ({ ok: true }), // không đụng DB, dùng cho health check của host
};

function send(req, res, status, body) {
  let payload = Buffer.from(JSON.stringify(body));
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  };
  if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    payload = gzipSync(payload);
    headers['Content-Encoding'] = 'gzip';
  }
  res.writeHead(status, headers);
  res.end(payload);
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Token',
      'Access-Control-Allow-Private-Network': 'true', // trang HTTPS (GitHub Pages) gọi vào localhost
    });
    return res.end();
  }
  try {
    if (req.method === 'POST' && url.pathname === '/sync') {
      if (!isAllowedOrigin(req.headers.origin)) return send(req, res, 403, { error: 'origin không được phép' });
      if (!hasValidToken(req)) return send(req, res, 401, { error: 'thiếu hoặc sai sync token' });
      const body = JSON.parse((await readBody(req)) || '{}');
      return send(req, res, 200, await enqueueSync(body.gbingoDraws));
    }
    const handler = req.method === 'GET' && routes[url.pathname];
    if (!handler) return send(req, res, 404, { error: 'not found' });
    send(req, res, 200, await handler(url.searchParams));
  } catch (e) {
    send(req, res, 400, { error: e.message });
  }
}).listen(PORT, () => console.log(`bingo backend: http://localhost:${PORT}  (db: ${process.env.TURSO_DATABASE_URL || LOCAL_DB})`));
