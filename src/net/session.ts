// Anonymous sign-in. No email, phone number or name is ever sent: the account is just a random
// id that lets row level security tell the two people in a room apart. Two small REST calls on
// Supabase Auth, so the full auth library (25 KB) is not needed.

export interface Session {
  access_token: string;
  refresh_token: string;
  /** Seconds since the epoch. */
  expires_at: number;
  user_id: string;
}

type Fetch = typeof fetch;
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const STORAGE_KEY = 'ok.session.v1';
const EARLY_REFRESH_SECONDS = 60;

export class SessionError extends Error {
  override name = 'SessionError';
}

export function createSessionManager(opts: {
  url: string;
  apiKey: string;
  fetch?: Fetch;
  storage?: Store;
  now?: () => number;
}) {
  const doFetch: Fetch = opts.fetch ?? ((...a) => fetch(...a));
  const now = opts.now ?? (() => Date.now() / 1000);
  let current: Session | null = read();
  let inflight: Promise<Session> | null = null;

  function read(): Session | null {
    try {
      const raw = opts.storage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Partial<Session>;
      return typeof s.access_token === 'string' &&
        typeof s.refresh_token === 'string' &&
        typeof s.expires_at === 'number' &&
        typeof s.user_id === 'string'
        ? (s as Session)
        : null;
    } catch {
      return null;
    }
  }

  function write(s: Session | null) {
    current = s;
    try {
      if (s) opts.storage?.setItem(STORAGE_KEY, JSON.stringify(s));
      else opts.storage?.removeItem(STORAGE_KEY);
    } catch {
      // Storage blocked: the session still works for this visit.
    }
  }

  async function call(path: string, body: unknown): Promise<Session> {
    const res = await doFetch(`${opts.url}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: opts.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new SessionError(`Sign-in failed (${res.status})`);
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      expires_at?: number;
      user?: { id?: string };
    };
    if (!data.access_token || !data.refresh_token || !data.user?.id) throw new SessionError('Sign-in failed');
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at ?? Math.floor(now()) + (data.expires_in ?? 3600),
      user_id: data.user.id,
    };
  }

  async function refreshOrSignUp(): Promise<Session> {
    if (current) {
      try {
        return await call('token?grant_type=refresh_token', { refresh_token: current.refresh_token });
      } catch {
        // The refresh token was revoked or expired: fall through to a new anonymous account.
      }
    }
    return call('signup', {});
  }

  return {
    /** The current user's id, if signed in on this device. */
    userId(): string | null {
      return current?.user_id ?? null;
    },

    /** A valid access token, signing in anonymously or refreshing as needed. */
    async accessToken(): Promise<string> {
      if (current && current.expires_at - EARLY_REFRESH_SECONDS > now()) return current.access_token;
      inflight ??= refreshOrSignUp()
        .then((s) => {
          write(s);
          return s;
        })
        .finally(() => {
          inflight = null;
        });
      return (await inflight).access_token;
    },

    /** Forget this device's anonymous account (used after erasing the room). */
    signOut(): void {
      write(null);
    },
  };
}

export type SessionManager = ReturnType<typeof createSessionManager>;
