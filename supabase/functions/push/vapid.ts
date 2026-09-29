// Web Push with VAPID (RFC 8292), no payload. Plain WebCrypto so it runs in the Supabase Edge
// runtime (Deno) and in Node for tests. Without a payload there is nothing to encrypt: the push
// only wakes the service worker, which shows a fixed line.

const ALLOWED_PUSH_HOST = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]*push\.apple\.com|[a-z0-9.-]*\.notify\.windows\.com)$/;

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Only the browsers' own push services: never an arbitrary URL (no request forgery). */
export function isPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.port && ALLOWED_PUSH_HOST.test(u.hostname) && endpoint.length <= 1024;
  } catch {
    return false;
  }
}

export interface VapidKeys {
  publicKey: string; // uncompressed P-256 point, base64url (the browser's applicationServerKey)
  privateJwk: JsonWebKey;
}

export async function generateVapidKeys(): Promise<VapidKeys> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: b64url(raw), privateJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d } };
}

/** The Authorization header for one push service. */
export async function vapidHeader(endpoint: string, keys: VapidKeys, subject: string, now = Date.now()): Promise<string> {
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })),
  );
  const key = await crypto.subtle.importKey('jwk', { ...keys.privateJwk, ext: false }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // WebCrypto returns the raw r||s signature, which is exactly what ES256 JWTs use.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64url(sig)}, k=${keys.publicKey}`;
}

/** Sends one empty push. Returns the push service's status (404/410 mean the address is gone). */
export async function sendEmptyPush(endpoint: string, keys: VapidKeys, subject: string, doFetch: typeof fetch = fetch): Promise<number> {
  const res = await doFetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(endpoint, keys, subject),
      TTL: '86400',
      Urgency: 'normal',
      Topic: 'room',
      'Content-Length': '0',
    },
  });
  return res.status;
}
