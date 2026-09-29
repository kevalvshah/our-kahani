import { fromUtf8, randomBytes, toBase64Url, fromBase64Url, utf8, type Bytes } from './bytes';
import { open, seal } from './envelope';
import { hashtagSalt, PhraseError } from './recovery';
import { ROOM_KEY_BYTES } from './roomKey';

// Partner rescue: when one person has lost both their device and their phrase, the other (whose
// phone still has the room key) makes a one-time rescue code. From the code and the hashtag,
// HKDF derives a lookup token (the server stores only its SHA-256) and a key that seals the room
// key. The server keeps that sealed copy for 24 hours and hands it out once; it can never open
// it. The code is 80 random bits, so it cannot be guessed, online or offline.

export const RESCUE_CODE_BYTES = 10;
// Crockford base32: no I, L, O or U, so a code read aloud or typed is hard to get wrong.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function formatRescueCode(bytes: Bytes): string {
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out.match(/.{1,4}/g)!.join('-');
}

export function newRescueCode(): { code: string; bytes: Bytes } {
  const bytes = randomBytes(RESCUE_CODE_BYTES);
  return { code: formatRescueCode(bytes), bytes };
}

/** What a person typed: any case, spaces or dashes; O, I and L read as 0, 1 and 1. */
export function parseRescueCode(input: string): Bytes {
  const clean = input
    .toUpperCase()
    .replace(/[\s-]+/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (clean.length !== 16) throw new PhraseError('A rescue code has 16 letters and numbers, like ABCD-EFGH-JKMN-PQRS.');
  let bits = '';
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) throw new PhraseError(`“${ch}” is not in a rescue code. Check what your person sent.`);
    bits += v.toString(2).padStart(5, '0');
  }
  const out = new Uint8Array(RESCUE_CODE_BYTES);
  for (let i = 0; i < RESCUE_CODE_BYTES; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return out;
}

async function hkdf(code: Bytes, hashtag: string, info: string): Promise<Bytes> {
  const tag = hashtagSalt(hashtag);
  if (!tag) throw new PhraseError('Type your room’s hashtag.');
  const salt = new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(`our-kahani/rescue/v1|${tag}`)));
  const ikm = await crypto.subtle.importKey('raw', code, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: utf8(info) }, ikm, 256));
}

export function rescueLookup(code: Bytes, hashtag: string): Promise<Bytes> {
  return hkdf(code, hashtag, 'our-kahani/rescue/lookup/v1');
}

async function rescueKey(code: Bytes, hashtag: string): Promise<CryptoKey> {
  const raw = await hkdf(code, hashtag, 'our-kahani/rescue/wrap/v1');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

const rescueCtx = (roomId: string) => ({ roomId, recordId: 'rescue', kind: 0 });

export async function sealRescue(code: Bytes, hashtag: string, roomId: string, roomKey: Bytes): Promise<Bytes> {
  return seal(await rescueKey(code, hashtag), rescueCtx(roomId), utf8(JSON.stringify({ v: 1, room: toBase64Url(roomKey) })));
}

export async function openRescue(code: Bytes, hashtag: string, roomId: string, envelope: Bytes): Promise<Bytes> {
  const data = JSON.parse(fromUtf8(await open(await rescueKey(code, hashtag), rescueCtx(roomId), envelope))) as { v?: number; room?: string };
  const roomKey = data.room ? fromBase64Url(data.room) : null;
  if (data.v !== 1 || roomKey?.length !== ROOM_KEY_BYTES) throw new PhraseError('This rescue code could not be read.');
  return roomKey;
}
