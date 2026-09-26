const encoder = new TextEncoder();

function b64u(input) {
  const bytes = typeof input === 'string' ? encoder.encode(input) : new Uint8Array(input);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(text) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
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

// Push rỗng: service worker tự gọi API khi nhận được
async function sendPush(subscription, env) {
  return fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint, env),
      TTL: '300',
      Urgency: 'high'
    }
  });
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

    if (url.pathname === '/subscribe' && request.method === 'POST') {
      const sub = await request.json();
      if (!sub || !sub.endpoint) return reply({ error: 'invalid subscription' }, 400);
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

  async scheduled(event, env) {
    // Không gọi API ở đây: Vietlott chặn IP ngoài Việt Nam mà cron chạy ở Singapore.
    // Push rỗng, service worker trên máy người dùng tự gọi API rồi chỉ hiện noti khi có hoa
    const { keys } = await env.SUBS.list();
    await Promise.all(keys.map(async ({ name }) => {
      const sub = JSON.parse(await env.SUBS.get(name));
      const res = await sendPush(sub, env);
      console.log(`push ${name.slice(0, 8)} -> ${res.status}`);
      if (res.status === 404 || res.status === 410) await env.SUBS.delete(name);
    }));
  }
};
