import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../functions/media/[[path]]';

// The Pages Function in front of R2: it must only ever store ciphertext for members of an open room.

const ROOM = '11111111-1111-4111-8111-111111111111';
const OBJ = '22222222-2222-4222-8222-222222222222';

function fakeBucket() {
  const store = new Map<string, ArrayBuffer>();
  return {
    store,
    get: async (k: string) => (store.has(k) ? { body: new Blob([store.get(k)!]).stream() } : null),
    put: async (k: string, v: ArrayBuffer) => void store.set(k, v),
    delete: async (k: string | string[]) => void (Array.isArray(k) ? k : [k]).forEach((x) => store.delete(x)),
    list: async ({ prefix }: { prefix: string }) => ({ objects: [...store.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }),
  };
}

function backend(allowed: boolean, purge: string[] = []) {
  const calls: { url: string; auth: string | null }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, auth: new Headers(init.headers).get('Authorization') });
    return new Response(JSON.stringify(url.endsWith('media_allowed') ? allowed : purge), { status: 200 });
  });
  return calls;
}

function call(bucket: ReturnType<typeof fakeBucket> | undefined, method: string, path: string[], init: RequestInit = {}, token: string | null = 'tok') {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return onRequest({ request: new Request(`https://app.test/media/${path.join('/')}`, { method, ...init, headers }), env: { MEDIA: bucket }, params: { path } });
}

afterEach(() => vi.unstubAllGlobals());

describe('media function', () => {
  it('answers 503 until the R2 binding exists', async () => {
    expect((await call(undefined, 'GET', ['o', ROOM, OBJ])).status).toBe(503);
  });

  it('stores and returns bytes for a member, checking with their own token', async () => {
    const calls = backend(true);
    const b = fakeBucket();
    expect((await call(b, 'PUT', ['o', ROOM, OBJ], { body: new Uint8Array([1, 2, 3]) })).status).toBe(204);
    const got = await call(b, 'GET', ['o', ROOM, OBJ]);
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(got.headers.get('Cache-Control')).toBe('no-store');
    expect(calls[0]!.auth).toBe('Bearer tok');
    expect((await call(b, 'DELETE', ['o', ROOM, OBJ])).status).toBe(204);
    expect(b.store.size).toBe(0);
    expect((await call(b, 'GET', ['o', ROOM, OBJ])).status).toBe(404);
  });

  it('refuses non-members, missing tokens and bad paths', async () => {
    backend(false);
    const b = fakeBucket();
    expect((await call(b, 'GET', ['o', ROOM, OBJ])).status).toBe(403);
    expect((await call(b, 'GET', ['o', ROOM, OBJ], {}, null)).status).toBe(401);
    expect((await call(b, 'GET', ['o', '..', OBJ])).status).toBe(404);
    expect((await call(b, 'GET', ['x'])).status).toBe(404);
  });

  it('limits size, empty bodies, object count and methods', async () => {
    backend(true);
    const b = fakeBucket();
    expect((await call(b, 'PUT', ['o', ROOM, OBJ], { body: new Uint8Array(1_200_000) })).status).toBe(413);
    expect((await call(b, 'PUT', ['o', ROOM, OBJ], { body: new Uint8Array(0) })).status).toBe(400);
    for (let i = 0; i < 40; i++) b.store.set(`${ROOM}/${i}`, new ArrayBuffer(1));
    expect((await call(b, 'PUT', ['o', ROOM, OBJ], { body: new Uint8Array(1) })).status).toBe(409);
    expect((await call(b, 'PATCH', ['o', ROOM, OBJ])).status).toBe(405);
  });

  it('purges every file of erased rooms and nothing else', async () => {
    backend(true, [ROOM, 'not-a-uuid']);
    const b = fakeBucket();
    b.store.set(`${ROOM}/a`, new ArrayBuffer(1));
    b.store.set(`${ROOM}/b`, new ArrayBuffer(1));
    b.store.set(`${OBJ}/c`, new ArrayBuffer(1));
    const res = await call(b, 'POST', ['purge'], {}, null);
    expect(await res.json()).toEqual({ rooms: 1, removed: 2 });
    expect([...b.store.keys()]).toEqual([`${OBJ}/c`]);
    expect((await call(b, 'GET', ['purge'])).status).toBe(405);
  });
});
