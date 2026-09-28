import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMedia, MAX_MEDIA_BYTES, MEDIA_URL, MediaError } from './media';
import type { SessionManager } from './session';

const session = { accessToken: async () => 'tok' } as unknown as SessionManager;

function stubFetch(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond(url, init);
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('media store client', () => {
  it('is off in tests and dev unless a URL is set', () => {
    expect(MEDIA_URL).toBe('');
    expect(createMedia(session).enabled()).toBe(false);
    expect(createMedia(session, 'https://m').enabled()).toBe(true);
  });

  it('uses the configured URL, or the same-origin /media in production', async () => {
    vi.stubEnv('VITE_MEDIA_URL', 'https://media.example');
    vi.resetModules();
    expect((await import('./media')).MEDIA_URL).toBe('https://media.example');
    vi.stubEnv('VITE_MEDIA_URL', undefined);
    vi.stubEnv('PROD', true);
    vi.resetModules();
    expect((await import('./media')).MEDIA_URL).toBe('/media');
  });

  it('refuses every call when switched off, without touching the network', async () => {
    const calls = stubFetch(() => new Response(null));
    const m = createMedia(session, '');
    await expect(m.put('r', 'o', new Uint8Array(1))).rejects.toThrow('not switched on yet');
    await expect(m.get('r', 'o')).rejects.toBeInstanceOf(MediaError);
    await expect(m.remove('r', 'o')).rejects.toBeInstanceOf(MediaError);
    m.purge();
    expect(calls).toHaveLength(0);
  });

  it('uploads ciphertext with the access token to an escaped path', async () => {
    const calls = stubFetch(() => new Response(null, { status: 204 }));
    const m = createMedia(session, 'https://m/media');
    const bytes = new Uint8Array([1, 2, 3]);
    await m.put('room/1', 'obj 2', bytes);
    const { url, init } = calls[0]!;
    expect(url).toBe('https://m/media/o/room%2F1/obj%202');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(bytes);
    const h = new Headers(init.headers);
    expect(h.get('Authorization')).toBe('Bearer tok');
    expect(h.get('Content-Type')).toBe('application/octet-stream');
  });

  it('refuses files over the size cap before uploading', async () => {
    const calls = stubFetch(() => new Response(null, { status: 204 }));
    const m = createMedia(session, 'https://m');
    await expect(m.put('r', 'o', new Uint8Array(MAX_MEDIA_BYTES + 1))).rejects.toThrow('That file is too big.');
    expect(calls).toHaveLength(0);
    await m.put('r', 'o', new Uint8Array(MAX_MEDIA_BYTES));
    expect(calls).toHaveLength(1);
  });

  it('downloads bytes and deletes objects', async () => {
    const calls = stubFetch((_url, init) => (init.method === 'GET' ? new Response(new Uint8Array([9, 8, 7])) : new Response(null, { status: 204 })));
    const m = createMedia(session, 'https://m');
    expect(await m.get('r', 'o')).toEqual(new Uint8Array([9, 8, 7]));
    await m.remove('r', 'o');
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ['GET', 'https://m/o/r/o'],
      ['DELETE', 'https://m/o/r/o'],
    ]);
  });

  it.each([
    [413, 'That file is too big.'],
    [409, 'This room has reached its photo limit.'],
    [503, 'Photos are not switched on yet.'],
    [404, 'Photos are not switched on yet.'],
    [401, 'Could not reach the photo store.'],
    [500, 'Could not reach the photo store.'],
  ])('explains status %i plainly', async (status, message) => {
    stubFetch(() => new Response(null, { status }));
    const m = createMedia(session, 'https://m');
    const err = await m.get('r', 'o').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MediaError);
    expect(err).toMatchObject({ name: 'MediaError', message });
  });

  it('asks the store to purge erased rooms, ignoring failures', async () => {
    const calls = stubFetch(() => Promise.reject(new TypeError('offline')));
    const m = createMedia(session, 'https://m');
    expect(() => m.purge()).not.toThrow();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual([{ url: 'https://m/purge', init: { method: 'POST' } }]);
  });
});
