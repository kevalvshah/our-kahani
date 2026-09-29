import type { SessionManager } from './session';

// Optional notifications. The server only ever learns a push address for a device; a push has
// no payload, and the phone shows one fixed line. See supabase/functions/push.

type Fetch = typeof fetch;

export function createPush(opts: { url: string; apiKey: string; session: Pick<SessionManager, 'accessToken'>; fetch?: Fetch }) {
  const doFetch: Fetch = opts.fetch ?? ((...a) => fetch(...a));

  async function post(path: string, body: unknown): Promise<Response> {
    const res = await doFetch(`${opts.url}${path}`, {
      method: 'POST',
      headers: { apikey: opts.apiKey, Authorization: `Bearer ${await opts.session.accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`push ${res.status}`);
    return res;
  }

  return {
    /** The server's public VAPID key (base64url), for PushManager.subscribe. */
    async publicKey(): Promise<string> {
      const { publicKey } = (await (await post('/functions/v1/push', { action: 'key' })).json()) as { publicKey?: string };
      if (!publicKey) throw new Error('push key missing');
      return publicKey;
    },
    async subscribe(roomId: string, endpoint: string): Promise<void> {
      await post('/rest/v1/rpc/push_subscribe', { p_room: roomId, p_endpoint: endpoint });
    },
    async unsubscribe(endpoint: string): Promise<void> {
      await post('/rest/v1/rpc/push_unsubscribe', { p_endpoint: endpoint });
    },
    /** Nudges the partner's devices. Best effort, never throws; the server limits how often. */
    notify(roomId: string): void {
      void post('/functions/v1/push', { action: 'notify', room: roomId }).catch(() => undefined);
    },
  };
}

export type Push = ReturnType<typeof createPush>;

/** base64url -> bytes, for applicationServerKey. */
export function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
