// Nguồn dữ liệu phụ, không chặn IP nước ngoài như API Vietlott. File ~3MB và gbingoDraws nằm
// gần cuối file, nên chỉ tải 100KB cuối (~1100 kì) bằng Range
const DATA_URL = 'https://bingo18.top/data/data.json';
const DATA_TAIL_BYTES = 100000;
// Kì hoa đã báo gần nhất, lưu chung KV với subscription nên có prefix để phân biệt
const LAST_HOA_KEY = 'state:lastHoa';

const encoder = new TextEncoder();

function b64u(input) {
  const bytes = typeof input === 'string' ? encoder.encode(input) : new Uint8Array(input);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uDecode(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function concat(...arrays) {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let offset = 0;
  arrays.forEach((a) => {
    out.set(a, offset);
    offset += a.length;
  });
  return out;
}

async function sha256Hex(text) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

async function vapidAuthorization(endpoint, env) {
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = b64u(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: env.VAPID_SUBJECT
  }));
  const key = await crypto.subtle.importKey(
    'jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(`${header}.${payload}`));
  return `vapid t=${header}.${payload}.${b64u(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

// Mã hoá payload theo RFC 8291 (aes128gcm), bắt buộc khi push có nội dung
async function encryptPayload(subscription, plaintext) {
  const uaPublic = b64uDecode(subscription.keys.p256dh);
  const authSecret = b64uDecode(subscription.keys.auth);
  const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256)
  );

  const prkKey = await hmac(authSecret, ecdhSecret);
  const ikm = await hmac(prkKey, concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic, [1]));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, encoder.encode('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16);
  const nonce = (await hmac(prk, encoder.encode('Content-Encoding: nonce\0\x01'))).slice(0, 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, aesKey, concat(encoder.encode(plaintext), [2])
  ));

  // Header: salt (16) | record size (4) | độ dài public key (1) | public key của server (65)
  const header = new Uint8Array(21);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  return concat(header, asPublic, cipher);
}

async function sendPush(subscription, message, env) {
  return fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint, env),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '300',
      Urgency: 'high'
    },
    body: await encryptPayload(subscription, JSON.stringify(message))
  });
}

function getHoa(winningResult) {
  const s = String(winningResult);
  return s[0] === s[1] && s[1] === s[2] ? parseInt(s[0]) : null;
}

// Kì mới nhất, hoa (null nếu không phải hoa) và số kì chưa ra hoa trước đó
// (VD hoa ở kì 100 và 180 -> 80). prevHoaGap = null nếu không thấy hoa trước đó trong `total` kì
async function fetchLatestDraw() {
  const res = await fetch(DATA_URL, { headers: { Range: `bytes=-${DATA_TAIL_BYTES}` } });
  if (!res.ok) throw new Error(`${DATA_URL} -> ${res.status}`);
  const text = await res.text();
  const draws = [...text.matchAll(/"drawAt":\s*"([^"]+)",\s*"winningResult":\s*"(\d+)"/g)]
    .map(([, drawAt, winningResult]) => ({ drawAt, winningResult }));
  if (!draws.length) return null;

  const last = draws.length - 1;
  const { winningResult, drawAt } = draws[last];
  const hoa = getHoa(winningResult);
  let prevHoaGap = null;
  if (hoa !== null) {
    for (let i = last - 1; i >= 0; i--) {
      if (getHoa(draws[i].winningResult) !== null) {
        prevHoaGap = last - i;
        break;
      }
    }
  }
  return { winningResult, drawAt, hoa, prevHoaGap, total: draws.length };
}

function formatHoaMessage(draw) {
  const gap = draw.prevHoaGap === null ? `≥${draw.total - 1}` : draw.prevHoaGap;
  return {
    title: `Hoa ${draw.hoa}`,
    body: `${draw.winningResult} - Hoa ${draw.hoa}\nChưa ra hoa trước đó: ${gap} kì`,
    tag: draw.drawAt
  };
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(env);
    const reply = (body, status = 200, type = 'application/json') =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status, headers: { ...cors, 'Content-Type': type }
      });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (url.pathname === '/vapid-public-key') return reply(env.VAPID_PUBLIC_KEY, 200, 'text/plain');

    // Kiểm tra Worker có đọc được dữ liệu không
    if (url.pathname === '/latest') {
      try {
        return reply(await fetchLatestDraw() || {});
      } catch (e) {
        return reply({ error: String(e) }, 502);
      }
    }

    if (url.pathname === '/subscribe' && request.method === 'POST') {
      const sub = await request.json();
      if (!sub || !sub.endpoint || !sub.keys) return reply({ error: 'invalid subscription' }, 400);
      await env.SUBS.put(await sha256Hex(sub.endpoint), JSON.stringify(sub));
      return reply({ ok: true });
    }

    if (url.pathname === '/unsubscribe' && request.method === 'POST') {
      const { endpoint } = await request.json();
      if (endpoint) await env.SUBS.delete(await sha256Hex(endpoint));
      return reply({ ok: true });
    }

    return reply({ error: 'not found' }, 404);
  },

  // Cron mỗi phút: chỉ gửi push khi kì mới nhất là hoa và chưa báo kì đó.
  // iOS luôn hiện noti cho mỗi push nhận được, nên không được gửi push khi không có hoa
  async scheduled(event, env) {
    const draw = await fetchLatestDraw();
    if (!draw || draw.hoa === null) return;
    if (await env.SUBS.get(LAST_HOA_KEY) === draw.drawAt) return;
    await env.SUBS.put(LAST_HOA_KEY, draw.drawAt);

    const message = formatHoaMessage(draw);
    console.log(`hoa: ${message.body}`);
    const { keys } = await env.SUBS.list();
    await Promise.all(keys.filter(({ name }) => !name.startsWith('state:')).map(async ({ name }) => {
      const sub = JSON.parse(await env.SUBS.get(name));
      const res = await sendPush(sub, message, env);
      console.log(`push ${name.slice(0, 8)} -> ${res.status}`);
      if (res.status === 404 || res.status === 410) await env.SUBS.delete(name);
    }));
  }
};
