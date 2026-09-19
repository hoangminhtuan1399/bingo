import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });

const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]);

console.log('VAPID_PUBLIC_KEY (dán vào wrangler.toml):');
console.log(raw.toString('base64url'));
console.log('\nVAPID_PRIVATE_JWK (đặt bằng: wrangler secret put VAPID_PRIVATE_JWK):');
console.log(JSON.stringify(priv));
