import { describe, expect, it, vi } from 'vitest';
import { createPush, keyBytes } from './push';

function fake(status = 200, json: unknown = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(json), { status });
  }) as typeof fetch;
  return { calls, push: createPush({ url: 'https://db.test', apiKey: 'pk', session: { accessToken: async () => 'tok' }, fetch: f }) };
}

describe('push client', () => {
  it('asks the function for the public key with the person’s own token', async () => {
    const { calls, push } = fake(200, { publicKey: 'BAB' });
    expect(await push.publicKey()).toBe('BAB');
    expect(calls[0]!.url).toBe('https://db.test/functions/v1/push');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ action: 'key' });
    const h = new Headers(calls[0]!.init.headers);
    expect(h.get('Authorization')).toBe('Bearer tok');
    expect(h.get('apikey')).toBe('pk');
  });

  it('fails clearly when there is no key or the call fails', async () => {
    await expect(fake(200, {}).push.publicKey()).rejects.toThrow('push key missing');
    await expect(fake(500).push.publicKey()).rejects.toThrow('push 500');
  });

  it('sends only the room id and the push address when subscribing', async () => {
    const { calls, push } = fake();
    await push.subscribe('room-1', 'https://fcm.googleapis.com/x');
    await push.unsubscribe('https://fcm.googleapis.com/x');
    expect(calls.map((c) => [c.url, JSON.parse(c.init.body as string)])).toEqual([
      ['https://db.test/rest/v1/rpc/push_subscribe', { p_room: 'room-1', p_endpoint: 'https://fcm.googleapis.com/x' }],
      ['https://db.test/rest/v1/rpc/push_unsubscribe', { p_endpoint: 'https://fcm.googleapis.com/x' }],
    ]);
  });

  it('notify is fire-and-forget and swallows failures', async () => {
    const { calls, push } = fake(500);
    expect(() => push.notify('room-1')).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ action: 'notify', room: 'room-1' });
  });

  it('uses the global fetch by default', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ publicKey: 'K' })));
    const push = createPush({ url: 'https://db.test', apiKey: 'pk', session: { accessToken: async () => 'tok' } });
    expect(await push.publicKey()).toBe('K');
    vi.unstubAllGlobals();
  });

  it('decodes base64url keys', () => {
    expect([...keyBytes('-_8')]).toEqual([251, 255]);
    expect([...keyBytes('AQID')]).toEqual([1, 2, 3]);
  });
});
