import { concat, fromBase64Url, fromUtf8, utf8, toBase64Url, type Bytes } from './bytes';
import { open, seal } from './envelope';
import { ROOM_KEY_BYTES } from './roomKey';

// Getting back into a room on a new device: the room's hashtag plus a phrase each person picks
// for themselves. PBKDF2 (600,000 rounds of SHA-256, salted with the hashtag) turns them into a
// secret, and HKDF derives two unrelated keys from that:
//   - a lookup token: the server stores only its SHA-256, to find the backup;
//   - a wrap key: encrypts the backup (room key + private-notes key) on the phone.
// The server can hand the backup back, never open it. The phrase never leaves the phone and is
// never stored. Because a person chooses it, its strength matters: whoever holds the database
// could try guesses offline, so we ask for four or more words and make every guess slow.

export const PBKDF2_ROUNDS = 600_000;
export const MIN_WORDS = 4;
const MIN_LETTERS = 16;
const SALT = new Uint8Array(32);

export class PhraseError extends Error {
  override name = 'PhraseError';
}

/** Any spacing or case, the same everywhere: "  Mango  LASSI " → "mango lassi". */
export function normalisePhrase(input: string): string {
  return input.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean).join(' ');
}

/** "#ChaiAurCoffee" → "chaiaurcoffee" (the hashtag is part of the salt, so case must not matter). */
export function hashtagSalt(hashtag: string): string {
  return hashtag.normalize('NFKC').replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '').toLowerCase();
}

/**
 * A plain-words reason the phrase is too easy to guess, or null when it is fine.
 * `avoid` are words that must not make up the phrase on their own (names, the hashtag).
 */
export function phraseProblem(input: string, avoid: string[] = []): string | null {
  const phrase = normalisePhrase(input);
  const words = phrase ? phrase.split(' ') : [];
  if (words.length < MIN_WORDS) return `Use at least ${MIN_WORDS} words, like “mango lassi on sundays”.`;
  if (phrase.replace(/[^\p{L}\p{N}]/gu, '').length < MIN_LETTERS) return 'A little longer, please: a few real words, not letters.';
  if (new Set(words).size < MIN_WORDS - 1) return 'Use different words, not the same one again and again.';
  const avoided = new Set(avoid.flatMap((a) => normalisePhrase(a.replace(/^#+/, '')).split(' ')).filter(Boolean));
  if (words.filter((w) => !avoided.has(w)).length < MIN_WORDS - 1) return 'Pick words that are not just your names or the hashtag.';
  return null;
}

/** The secret behind the lookup token and wrap key. Slow on purpose (about a second on a phone). */
export async function phraseSecret(hashtag: string, input: string, rounds = PBKDF2_ROUNDS): Promise<Bytes> {
  const tag = hashtagSalt(hashtag);
  if (!tag) throw new PhraseError('Type your room’s hashtag.');
  const phrase = normalisePhrase(input);
  if (!phrase) throw new PhraseError('Type your phrase.');
  const base = await crypto.subtle.importKey('raw', utf8(phrase), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: utf8(`our-kahani/room-phrase/v1|${tag}`), iterations: rounds },
    base,
    256,
  );
  return new Uint8Array(bits);
}

async function hkdf(secret: Bytes, info: string): Promise<Bytes> {
  const ikm = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: utf8(info) }, ikm, 256));
}

export function lookupToken(secret: Bytes): Promise<Bytes> {
  return hkdf(secret, 'our-kahani/recovery/lookup/v1');
}

async function wrapKey(secret: Bytes): Promise<CryptoKey> {
  const raw = await hkdf(secret, 'our-kahani/recovery/wrap/v1');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export interface Backup {
  roomKey: Bytes;
  notesKey: Bytes;
}

const backupCtx = (roomId: string) => ({ roomId, recordId: 'backup', kind: 0 });

/** Plaintext padded to a fixed size so every backup is the same length. */
export async function sealBackup(secret: Bytes, roomId: string, backup: Backup): Promise<Bytes> {
  const json = utf8(JSON.stringify({ v: 1, room: toBase64Url(backup.roomKey), notes: toBase64Url(backup.notesKey) }));
  const padded = concat(json, new Uint8Array(160 - json.length).fill(0x20));
  return seal(await wrapKey(secret), backupCtx(roomId), padded);
}

export async function openBackup(secret: Bytes, roomId: string, envelope: Bytes): Promise<Backup> {
  const data = JSON.parse(fromUtf8(await open(await wrapKey(secret), backupCtx(roomId), envelope))) as {
    v?: number;
    room?: string;
    notes?: string;
  };
  const roomKey = data.room ? fromBase64Url(data.room) : null;
  const notesKey = data.notes ? fromBase64Url(data.notes) : null;
  if (data.v !== 1 || roomKey?.length !== ROOM_KEY_BYTES || notesKey?.length !== ROOM_KEY_BYTES) {
    throw new PhraseError('This backup could not be read.');
  }
  return { roomKey, notesKey };
}
