import { describe, expect, it } from 'vitest';
import { b64url, generateVapidKeys, isPushEndpoint, sendEmptyPush, vapidHeader } from '../../supabase/functions/push/vapid';

// The push sender (Supabase Edge Function): VAPID signing and the push-service allowlist.

const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

describe('VAPID web push', () => {
  it('only accepts the browsers’ own push services', () => {
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(isPushEndpoint('https://web.push.apple.com/abc')).toBe(true);
    expect(isPushEndpoint('https://wns2-db5p.notify.windows.com/w/?token=x')).toBe(true);
    expect(isPushEndpoint('http://fcm.googleapis.com/x')).toBe(false);
    expect(isPushEndpoint('https://fcm.googleapis.com:8443/x')).toBe(false);
    expect(isPushEndpoint('https://evil.example/fcm.googleapis.com/')).toBe(false);
    expect(isPushEndpoint('https://push.apple.com.evil.example/x')).toBe(false);
    expect(isPushEndpoint('not a url')).toBe(false);
    expect(isPushEndpoint(`https://fcm.googleapis.com/${'a'.repeat(1100)}`)).toBe(false);
  });

  it('makes a P-256 key pair the browser accepts as applicationServerKey', async () => {
    const k = await generateVapidKeys();
    const raw = fromB64url(k.publicKey);
    expect(raw).toHaveLength(65);
    expect(raw[0]).toBe(4);
    expect(k.privateJwk.d).toBeTruthy();
  });

  it('signs an ES256 token for the push service origin that verifies with the public key', async () => {
    const k = await generateVapidKeys();
    const now = Date.UTC(2026, 8, 28);
    const header = await vapidHeader('https://fcm.googleapis.com/fcm/send/abc', k, 'https://kahani.example', now);
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)!;
    expect(m[4]).toBe(k.publicKey);
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(m[2]!)));
    expect(claims).toEqual({ aud: 'https://fcm.googleapis.com', exp: now / 1000 + 12 * 3600, sub: 'https://kahani.example' });
    const pub = await crypto.subtle.importKey('raw', fromB64url(k.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, fromB64url(m[3]!), new TextEncoder().encode(`${m[1]}.${m[2]}`));
    expect(ok).toBe(true);
  });

  it('sends an empty push: no body, so nothing about the room travels', async () => {
    const k = await generateVapidKeys();
    let seen: RequestInit | undefined;
    const status = await sendEmptyPush('https://fcm.googleapis.com/fcm/send/abc', k, 'https://kahani.example', (async (_u: string, init: RequestInit) => {
      seen = init;
      return new Response(null, { status: 201 });
    }) as typeof fetch);
    expect(status).toBe(201);
    expect(seen!.body).toBeUndefined();
    expect(new Headers(seen!.headers).get('Content-Length')).toBe('0');
    expect(new Headers(seen!.headers).get('TTL')).toBe('86400');
  });

  it('encodes base64url without padding', () => {
    expect(b64url(new Uint8Array([251, 255]))).toBe('-_8');
  });
});
