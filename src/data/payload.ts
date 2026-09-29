import { fromUtf8, utf8, type Bytes } from '../crypto/bytes';
import { open, seal, type EnvelopeContext } from '../crypto/envelope';

// Every record's plaintext is JSON padded to a fixed bucket before encryption, so the size the
// server sees says nothing about what was written (a "yes" and a "no" look identical).

const BUCKETS = [64, 256, 1024, 4096, 12288] as const;

export function padJson(value: unknown): Bytes {
  const body = utf8(JSON.stringify(value));
  const size = BUCKETS.find((b) => b >= body.length);
  if (size === undefined) throw new Error('Too long to save');
  const out = new Uint8Array(size).fill(0x20); // trailing spaces; JSON.parse ignores them
  out.set(body);
  return out;
}

export async function sealJson(key: CryptoKey, ctx: EnvelopeContext, value: unknown): Promise<Bytes> {
  return seal(key, ctx, padJson(value));
}

export async function openJson<T>(key: CryptoKey, ctx: EnvelopeContext, envelope: Bytes): Promise<T> {
  return JSON.parse(fromUtf8(await open(key, ctx, envelope))) as T;
}
