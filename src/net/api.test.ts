import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApi, fromBytea, toBytea } from './api';

describe('bytea encoding', () => {
  it('round-trips bytes as \\x hex', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(40));
    const text = toBytea(bytes);
    expect(text).toMatch(/^\\x[0-9a-f]{80}$/);
    expect(fromBytea(text)).toEqual(bytes);
    expect(fromBytea('\\x')).toEqual(new Uint8Array(0));
  });

  it('rejects anything else', () => {
    expect(() => fromBytea('abc')).toThrow();
    expect(() => fromBytea('\\x0')).toThrow();
    expect(() => fromBytea('\\xzz')).toThrow();
  });
});

function api(responder: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const session = { accessToken: vi.fn(async () => 'tok'), userId: () => 'u1', signOut: () => {} };
  const a = createApi({
    url: 'https://p',
    apiKey: 'k',
    session,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init: init ?? {} });
      return responder(url, init ?? {});
    }) as typeof fetch,
  });
  return { a, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const pgError = (code: string, message = 'x') => json({ code, message, details: null, hint: null }, 400);

describe('api', () => {
  it('sends the access token and only ids and ciphertext', async () => {
    const { a, calls } = api(() => json('room-1'));
    const id = await a.createRoom(new Uint8Array(32));
    expect(id).toBe('room-1');
    const { url, init } = calls[0]!;
    expect(url).toBe('https://p/rest/v1/rpc/create_room');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
    expect(new Headers(init.headers).get('apikey')).toBe('k');
    expect(JSON.parse(String(init.body))).toEqual({ p_verifier: toBytea(new Uint8Array(32)) });
  });

  it.each([
    ['P0002', 'invalid-invite'],
    ['P0003', 'room-full'],
    ['P0001', 'too-many-rooms'],
    ['XX000', 'other'],
  ])('maps database error %s to %s', async (code, meaning) => {
    const { a } = api(() => pgError(code));
    await expect(a.joinRoom('r', new Uint8Array(32))).rejects.toMatchObject({ code: meaning });
  });

  it('reports being offline', async () => {
    const session = { accessToken: async () => 'tok', userId: () => null, signOut: () => {} };
    const a = createApi({ url: 'https://p', apiKey: 'k', session, fetch: (async () => { throw new TypeError('network'); }) as typeof fetch });
    await expect(a.answers('r')).rejects.toMatchObject({ code: 'offline' });
    await expect(a.answers('r')).rejects.toBeInstanceOf(ApiError);
  });

  it('decodes records and filters by room, kind and ref', async () => {
    const env = toBytea(new Uint8Array([1, 2, 3]));
    const { a, calls } = api(() =>
      json([{ id: 'x', room_id: 'r', author_id: 'u', kind: 1, ref: 'warm.1', envelope: env, created_at: 't' }]),
    );
    const rows = await a.records('r', 1, 'warm.1');
    expect(rows[0]!.envelope).toEqual(new Uint8Array([1, 2, 3]));
    expect(calls[0]!.url).toContain('room_id=eq.r');
    expect(calls[0]!.url).toContain('kind=eq.1');
    expect(calls[0]!.url).toContain('ref=eq.warm.1');
  });

  it('treats a locked answer as not updated', async () => {
    const { a } = api(() => pgError('42501', 'new row violates row-level security policy'));
    expect(await a.updateRecord('x', new Uint8Array(40))).toBe(false);
    const ok = api(() => json([{ id: 'x' }]));
    expect(await ok.a.updateRecord('x', new Uint8Array(40))).toBe(true);
    const other = api(() => pgError('XX000'));
    await expect(other.a.updateRecord('x', new Uint8Array(40))).rejects.toBeInstanceOf(ApiError);
  });

  it('covers the remaining calls', async () => {
    const { a, calls } = api((url) => {
      if (url.includes('/rooms')) return json({ id: 'r', created_at: 't', ends_at: 't', invite_expires_at: 't', members: [] });
      if (url.includes('room_answers')) return json([{ kind: 1, ref: 'warm.1', mine: false }]);
      if (url.includes('join_room')) return json('invitee');
      return new Response(null, { status: 204 });
    });
    expect((await a.getRoom('r'))?.id).toBe('r');
    expect(await a.answers('r')).toEqual([{ kind: 1, ref: 'warm.1', mine: false }]);
    expect(await a.joinRoom('r', new Uint8Array(32))).toBe('invitee');
    await a.insertRecord({ id: 'x', roomId: 'r', kind: 1, ref: 'warm.1', envelope: new Uint8Array(40) });
    await a.eraseRoom('r');
    expect(calls.map((c) => c.init.method)).toContain('POST');

    const empty = api((url) => (url.includes('/rooms') ? json(null) : json(null)));
    expect(await empty.a.getRoom('r')).toBeNull();
    expect(await empty.a.answers('r')).toEqual([]);
    expect(await empty.a.records('r', 1, 'x')).toEqual([]);
    expect(await empty.a.updateRecord('x', new Uint8Array(40))).toBe(false);

    const failing = api(() => pgError('XX000', ''));
    await expect(failing.a.getRoom('r')).rejects.toThrow('Something went wrong');
    await expect(failing.a.records('r', 1, 'x')).rejects.toBeInstanceOf(ApiError);
    await expect(failing.a.insertRecord({ id: 'x', roomId: 'r', kind: 1, ref: 'x', envelope: new Uint8Array(1) })).rejects.toBeInstanceOf(ApiError);
    await expect(failing.a.eraseRoom('r')).rejects.toBeInstanceOf(ApiError);
    await expect(failing.a.createRoom(new Uint8Array(32))).rejects.toBeInstanceOf(ApiError);
  });

  it('uses the global fetch when none is given', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json('room-9'));
    const session = { accessToken: async () => 'tok', userId: () => null, signOut: () => {} };
    const a = createApi({ url: 'https://p', apiKey: 'k', session });
    expect(await a.createRoom(new Uint8Array(32))).toBe('room-9');
    spy.mockRestore();
  });
});
