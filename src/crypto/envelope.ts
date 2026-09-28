import { concat, fromUtf8, randomBytes, utf8, type Bytes } from './bytes';
import { isValidId } from './ids';

// Envelope layout (stored as bytea): [version: 1 byte][iv: 12 bytes][ciphertext + 16-byte tag]
// AAD: room:<roomId>|record:<recordId>|type:<kind>|v<version>
// The AAD binds each ciphertext to its room, record and type, so a row copied to another
// room, record or kind fails to open. The version byte is covered by the AAD too.

export const ENVELOPE_VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = 1 + IV_BYTES;
const MAX_KIND = 32767; // records.kind is a smallint

export interface EnvelopeContext {
  roomId: string;
  recordId: string;
  kind: number;
}

/** Deliberately vague: callers show "could not open", never why. */
export class EnvelopeError extends Error {
  override name = 'EnvelopeError';
}

function aad(ctx: EnvelopeContext, version: number): Bytes {
  if (!isValidId(ctx.roomId) || !isValidId(ctx.recordId)) {
    throw new EnvelopeError('Invalid id');
  }
  if (!Number.isInteger(ctx.kind) || ctx.kind < 0 || ctx.kind > MAX_KIND) {
    throw new EnvelopeError('Invalid kind');
  }
  return utf8(`room:${ctx.roomId}|record:${ctx.recordId}|type:${ctx.kind}|v${version}`);
}

export async function seal(key: CryptoKey, ctx: EnvelopeContext, plaintext: Bytes): Promise<Bytes> {
  const additionalData = aad(ctx, ENVELOPE_VERSION);
  const iv = randomBytes(IV_BYTES); // fresh 96-bit IV every time
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData, tagLength: TAG_BYTES * 8 },
    key,
    plaintext,
  );
  return concat(Uint8Array.of(ENVELOPE_VERSION), iv, new Uint8Array(ct));
}

export async function open(key: CryptoKey, ctx: EnvelopeContext, envelope: Bytes): Promise<Bytes> {
  if (envelope.length < HEADER_BYTES + TAG_BYTES) throw new EnvelopeError('Could not open');
  const version = envelope[0];
  if (version !== ENVELOPE_VERSION) throw new EnvelopeError('Could not open');
  const additionalData = aad(ctx, version);
  const iv = envelope.slice(1, HEADER_BYTES);
  const ct = envelope.slice(HEADER_BYTES);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData, tagLength: TAG_BYTES * 8 },
      key,
      ct,
    );
    return new Uint8Array(pt);
  } catch {
    throw new EnvelopeError('Could not open');
  }
}

export function sealText(key: CryptoKey, ctx: EnvelopeContext, text: string): Promise<Bytes> {
  return seal(key, ctx, utf8(text));
}

export async function openText(key: CryptoKey, ctx: EnvelopeContext, envelope: Bytes): Promise<string> {
  const pt = await open(key, ctx, envelope);
  try {
    return fromUtf8(pt);
  } catch {
    throw new EnvelopeError('Could not open');
  }
}
