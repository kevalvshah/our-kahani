// Encrypted photos, served from R2 on the app's own origin (so the CSP needs no extra host).
//
//   GET|PUT|DELETE /media/o/<room>/<object>   the person's own Supabase token as Bearer
//   POST           /media/purge               deletes files of erased or ended rooms
//
// The bytes are ciphertext sealed on the phone with the room key; this code never sees a key.
// It holds no Supabase secret: membership is checked by calling media_allowed() with the
// person's own token, so row level security decides.
//
// Needs an R2 binding named MEDIA (bucket our-kahani-media) on the Pages project. Without it
// every call answers 503 and the app says photos are not switched on yet.

import { DEFAULT_SUPABASE_PUBLISHABLE_KEY, DEFAULT_SUPABASE_URL } from '../../src/net/defaults';

interface R2Object {
  body: ReadableStream;
}
interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ArrayBuffer): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
  list(opts: { prefix: string; limit?: number; cursor?: string }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
}
interface Env {
  MEDIA?: R2Bucket;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
}
interface Context {
  request: Request;
  env: Env;
  params: { path?: string[] };
}

const MAX_BYTES = 1_100_000; // 1 MB of photo plus the envelope
const MAX_OBJECTS_PER_ROOM = 40; // 20 photos (the server caps records), with room to replace
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function reply(status: number, body: BodyInit | null = null, type = 'text/plain') {
  return new Response(body, { status, headers: { ...HEADERS, 'Content-Type': type } });
}

function supabase(env: Env) {
  return {
    url: env.SUPABASE_URL || DEFAULT_SUPABASE_URL,
    key: env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  };
}

async function rpc(env: Env, fn: string, body: unknown, token?: string): Promise<Response> {
  const { url, key } = supabase(env);
  return fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${token ?? key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function allowed(env: Env, token: string, room: string): Promise<boolean> {
  const res = await rpc(env, 'media_allowed', { p_room: room }, token);
  return res.ok && (await res.json()) === true;
}

async function countObjects(bucket: R2Bucket, room: string): Promise<number> {
  const page = await bucket.list({ prefix: `${room}/`, limit: MAX_OBJECTS_PER_ROOM + 1 });
  return page.objects.length;
}

async function purgeRoom(bucket: R2Bucket, room: string): Promise<number> {
  let removed = 0;
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: `${room}/`, cursor });
    const keys = page.objects.map((o) => o.key);
    if (keys.length) await bucket.delete(keys);
    removed += keys.length;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return removed;
}

export async function onRequest({ request, env, params }: Context): Promise<Response> {
  const bucket = env.MEDIA;
  if (!bucket) return reply(503, 'Photos are not switched on yet.');
  const path = params.path ?? [];
  const method = request.method;

  if (path.length === 1 && path[0] === 'purge') {
    if (method !== 'POST') return reply(405);
    const res = await rpc(env, 'media_purge_list', {});
    if (!res.ok) return reply(502);
    const rooms = ((await res.json()) as string[]).filter((r) => UUID.test(r));
    let removed = 0;
    for (const room of rooms) removed += await purgeRoom(bucket, room);
    return reply(200, JSON.stringify({ rooms: rooms.length, removed }), 'application/json');
  }

  if (path.length !== 3 || path[0] !== 'o') return reply(404);
  const [, room, obj] = path as [string, string, string];
  if (!UUID.test(room) || !UUID.test(obj)) return reply(404);

  const token = /^Bearer (.+)$/.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!token) return reply(401);
  if (!(await allowed(env, token, room))) return reply(403);
  const key = `${room}/${obj}`;

  switch (method) {
    case 'GET': {
      const found = await bucket.get(key);
      return found ? reply(200, found.body, 'application/octet-stream') : reply(404);
    }
    case 'PUT': {
      const declared = Number(request.headers.get('Content-Length') ?? '0');
      if (declared > MAX_BYTES) return reply(413);
      const body = await request.arrayBuffer();
      if (body.byteLength === 0) return reply(400);
      if (body.byteLength > MAX_BYTES) return reply(413);
      if ((await countObjects(bucket, room)) >= MAX_OBJECTS_PER_ROOM) return reply(409, 'This room has reached its photo limit.');
      await bucket.put(key, body);
      return reply(204);
    }
    case 'DELETE':
      await bucket.delete(key);
      return reply(204);
    default:
      return reply(405);
  }
}
