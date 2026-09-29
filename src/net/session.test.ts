import { describe, expect, it, vi } from 'vitest';
import { createSessionManager, SessionError } from './session';

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const token = (n: number) => ({ access_token: `a${n}`, refresh_token: `r${n}`, expires_in: 3600, user: { id: 'u1' } });

describe('anonymous session', () => {
  it('signs up anonymously with an empty body: no email, phone or name', async () => {
    const fetch = vi.fn(async () => reply(token(1)));
    const s = createSessionManager({ url: 'https://p', apiKey: 'k', fetch, storage: memory(), now: () => 1000 });
    expect(await s.accessToken()).toBe('a1');
    expect(s.userId()).toBe('u1');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://p/auth/v1/signup');
    expect(init.body).toBe('{}');
    expect(new Headers(init.headers).get('apikey')).toBe('k');
  });

  it('reuses a valid token, then refreshes before it expires', async () => {
    let t = 1000;
    const fetch = vi.fn().mockResolvedValueOnce(reply(token(1))).mockResolvedValueOnce(reply(token(2)));
    const storage = memory();
    const s = createSessionManager({ url: 'https://p', apiKey: 'k', fetch, storage, now: () => t });
    await s.accessToken();
    expect(await s.accessToken()).toBe('a1');
    expect(fetch).toHaveBeenCalledTimes(1);
    t += 3600 - 30; // inside the early-refresh window
    expect(await s.accessToken()).toBe('a2');
    expect((fetch.mock.calls[1] as unknown as [string])[0]).toContain('grant_type=refresh_token');
    expect(JSON.parse(storage.data.get('ok.session.v1')!).access_token).toBe('a2');
  });

  it('restores a saved session, and starts a new account if the refresh token is dead', async () => {
    const storage = memory();
    storage.setItem('ok.session.v1', JSON.stringify({ access_token: 'old', refresh_token: 'r0', expires_at: 0, user_id: 'u0' }));
    const fetch = vi.fn().mockResolvedValueOnce(reply({ error: 'bad' }, 400)).mockResolvedValueOnce(reply(token(3)));
    const s = createSessionManager({ url: 'https://p', apiKey: 'k', fetch, storage, now: () => 1000 });
    expect(s.userId()).toBe('u0');
    expect(await s.accessToken()).toBe('a3');
    expect((fetch.mock.calls[1] as unknown as [string])[0]).toContain('/signup');
  });

  it('shares one sign-in between concurrent callers', async () => {
    const fetch = vi.fn(async () => reply(token(1)));
    const s = createSessionManager({ url: 'https://p', apiKey: 'k', fetch, storage: memory(), now: () => 1000 });
    await Promise.all([s.accessToken(), s.accessToken(), s.accessToken()]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reports a failed sign-in, e.g. when anonymous sign-ins are disabled', async () => {
    const fetch = vi.fn(async () => reply({ error_code: 'anonymous_provider_disabled' }, 422));
    const s = createSessionManager({ url: 'https://p', apiKey: 'k', fetch, storage: memory(), now: () => 1000 });
    await expect(s.accessToken()).rejects.toBeInstanceOf(SessionError);
    const s2 = createSessionManager({ url: 'https://p', apiKey: 'k', fetch: vi.fn(async () => reply({})), now: () => 1 });
    await expect(s2.accessToken()).rejects.toThrow('Sign-in failed');
  });

  it('ignores corrupt or blocked storage, and signs out cleanly', async () => {
    const bad = memory();
    bad.setItem('ok.session.v1', '{not json');
    const s = createSessionManager({ url: 'https://p', apiKey: 'k', fetch: vi.fn(async () => reply({ ...token(1), expires_at: 99999 })), storage: bad, now: () => 1 });
    expect(s.userId()).toBeNull();
    await s.accessToken();
    s.signOut();
    expect(s.userId()).toBeNull();
    expect(bad.data.has('ok.session.v1')).toBe(false);

    const partial = memory();
    partial.setItem('ok.session.v1', JSON.stringify({ access_token: 'x' }));
    expect(createSessionManager({ url: 'https://p', apiKey: 'k', storage: partial }).userId()).toBeNull();

    const blocked = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    const s3 = createSessionManager({ url: 'https://p', apiKey: 'k', fetch: vi.fn(async () => reply(token(1))), storage: blocked, now: () => 1 });
    expect(await s3.accessToken()).toBe('a1');
    expect(() => s3.signOut()).not.toThrow();
  });

  it('uses the global fetch when none is given', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(token(1)));
    const s = createSessionManager({ url: 'https://p', apiKey: 'k' });
    expect(await s.accessToken()).toBe('a1');
    spy.mockRestore();
  });

  it('assumes an hour when the server does not say when the token expires', async () => {
    const fetch = vi.fn(async () => reply({ access_token: 'a', refresh_token: 'r', user: { id: 'u' } }));
    const storage = memory();
    const s = createSessionManager({ url: 'https://p', apiKey: 'k', fetch, storage, now: () => 1000 });
    await s.accessToken();
    expect(JSON.parse(storage.data.get('ok.session.v1')!).expires_at).toBe(4600);
  });
});
