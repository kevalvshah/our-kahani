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
    ['P0004', 'room-full-data'],
    ['P0005', 'photo-limit'],
    ['P0006', 'room-ended'],
    ['P0007', 'not-found'],
    ['P0008', 'paused'],
    ['25006', 'read-only'],
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

  it('reads every record in the room, oldest first', async () => {
    const env = toBytea(new Uint8Array([9, 8]));
    const { a, calls } = api(() => json([{ id: 'x', room_id: 'r', author_id: 'u', kind: 200, ref: 's', envelope: env, created_at: 't' }]));
    const rows = await a.allRecords('r');
    expect(rows).toEqual([{ id: 'x', room_id: 'r', author_id: 'u', kind: 200, ref: 's', envelope: new Uint8Array([9, 8]), created_at: 't' }]);
    expect(calls[0]!.url).toContain('room_id=eq.r');
    expect(calls[0]!.url).toContain('order=created_at.asc');
    expect(calls[0]!.url).toContain('limit=5000');
    expect(await api(() => json(null)).a.allRecords('r')).toEqual([]);
    await expect(api(() => pgError('XX000')).a.allRecords('r')).rejects.toBeInstanceOf(ApiError);
  });

  it('deletes a record by id', async () => {
    const { a, calls } = api(() => new Response(null, { status: 204 }));
    await a.deleteRecord('x');
    expect(calls[0]!.init.method).toBe('DELETE');
    expect(calls[0]!.url).toContain('id=eq.x');
    await expect(api(() => pgError('XX000')).a.deleteRecord('x')).rejects.toBeInstanceOf(ApiError);
  });

  it('votes to keep the room and reads back only its own vote', async () => {
    const { a, calls } = api((url) => (url.includes('vote_keep') ? json(true) : json([{ cycle: 1 }])));
    expect(await a.voteKeep('r', true)).toBe(true);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ p_room: 'r', p_keep: true });
    expect(await a.myKeepVote('r')).toBe(true);
    expect(calls[1]!.url).toContain('/keep_votes');
    expect(calls[1]!.url).toContain('room_id=eq.r');

    const none = api((url) => (url.includes('vote_keep') ? json(false) : json([])));
    expect(await none.a.voteKeep('r', false)).toBe(false);
    expect(await none.a.myKeepVote('r')).toBe(false);
    const empty = api(() => json(null));
    expect(await empty.a.myKeepVote('r')).toBe(false);

    const failing = api(() => pgError('XX000'));
    await expect(failing.a.voteKeep('r', true)).rejects.toBeInstanceOf(ApiError);
    await expect(failing.a.myKeepVote('r')).rejects.toBeInstanceOf(ApiError);
  });

  it('saves a backup as ciphertext and a lookup token only', async () => {
    const { a, calls } = api(() => new Response(null, { status: 204 }));
    await a.saveBackup('r', new Uint8Array([1]), new Uint8Array([2, 3]));
    expect(calls[0]!.url).toBe('https://p/rest/v1/rpc/save_backup');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ p_room: 'r', p_token: '\\x01', p_envelope: '\\x0203' });
    await expect(api(() => pgError('XX000')).a.saveBackup('r', new Uint8Array(1), new Uint8Array(1))).rejects.toBeInstanceOf(ApiError);
  });

  it('recovers a room from the lookup token', async () => {
    const { a, calls } = api(() => json([{ room_id: 'r', role: 'invitee', envelope: '\\x0a0b' }]));
    expect(await a.recoverRoom(new Uint8Array([7]))).toEqual({ roomId: 'r', role: 'invitee', envelope: new Uint8Array([10, 11]) });
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ p_token: '\\x07' });
    await expect(api(() => json([])).a.recoverRoom(new Uint8Array(1))).rejects.toMatchObject({ code: 'not-found' });
    await expect(api(() => json(null)).a.recoverRoom(new Uint8Array(1))).rejects.toMatchObject({ code: 'not-found' });
    await expect(api(() => pgError('P0007')).a.recoverRoom(new Uint8Array(1))).rejects.toMatchObject({ code: 'not-found' });
  });

  it('uses the global fetch when none is given', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json('room-9'));
    const session = { accessToken: async () => 'tok', userId: () => null, signOut: () => {} };
    const a = createApi({ url: 'https://p', apiKey: 'k', session });
    expect(await a.createRoom(new Uint8Array(32))).toBe('room-9');
    spy.mockRestore();
  });
});
