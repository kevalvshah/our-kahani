// Supabase Edge Function "push": optional notifications that never carry content.
//
//   POST {"action":"key"}                 -> {"publicKey"} (made on first use, kept in the database)
//   POST {"action":"notify","room":<id>}  -> nudges the partner's devices, at most every 10 minutes
//
// Called with the person's own Supabase token. Which devices to nudge is decided by
// push_targets() under that token, so the database's membership rules apply. The signing key
// is read with the service role and never leaves this function.

import { generateVapidKeys, isPushEndpoint, sendEmptyPush, type VapidKeys } from './vapid.ts';

const SUBJECT = 'https://kahani.unicodegroup.com';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function rpc(fn: string, body: unknown, token: string, apikey: string) {
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${fn} failed: ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function keys(): Promise<VapidKeys> {
  let row = (await rpc('push_secret', {}, SERVICE, SERVICE)) as { public_key: string; private_jwk: JsonWebKey } | null;
  if (!row) {
    const made = await generateVapidKeys();
    await rpc('push_init', { p_public: made.publicKey, p_private: made.privateJwk }, SERVICE, SERVICE);
    row = await rpc('push_secret', {}, SERVICE, SERVICE); // first write wins if two ran at once
  }
  return { publicKey: row!.public_key, privateJwk: row!.private_jwk };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'method' });
  const token = /^Bearer (.+)$/.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!token) return reply(401, { error: 'auth' });

  let body: { action?: string; room?: string };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'body' });
  }

  try {
    if (body.action === 'key') return reply(200, { publicKey: (await keys()).publicKey });

    if (body.action === 'notify') {
      if (!body.room || !UUID.test(body.room)) return reply(400, { error: 'room' });
      const targets = ((await rpc('push_targets', { p_room: body.room }, token, ANON)) as string[] | null) ?? [];
      if (!targets.length) return reply(200, { targets: 0, sent: 0 });
      const k = await keys();
      let sent = 0;
      await Promise.all(
        targets.filter(isPushEndpoint).map(async (endpoint) => {
          try {
            const status = await sendEmptyPush(endpoint, k, SUBJECT);
            if (status === 404 || status === 410) await rpc('push_forget', { p_endpoint: endpoint }, SERVICE, SERVICE);
            else if (status < 300) sent++;
          } catch {
            // One unreachable push service does not stop the others.
          }
        }),
      );
      return reply(200, { targets: targets.length, sent });
    }
    return reply(400, { error: 'action' });
  } catch {
    return reply(500, { error: 'server' });
  }
});
