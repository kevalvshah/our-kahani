import { concat, fromBase64Url, fromUtf8, randomBytes, toBase64Url, utf8, type Bytes } from './bytes';
import { open, seal } from './envelope';
import { ROOM_KEY_BYTES } from './roomKey';
import { WORDLIST } from './wordlist';

// The 12-word recovery phrase (standard BIP39 English, 128 bits + 4-bit checksum). From the
// words, HKDF derives two unrelated keys:
//   - a lookup token: the server stores only its SHA-256, to find the backup;
//   - a wrap key: encrypts the backup (room key + private-notes key) on the phone.
// The server can hand the backup back, never open it. The words themselves never leave the
// phone and are never stored.

export const PHRASE_WORDS = 12;
const ENTROPY_BYTES = 16;
const SALT = new Uint8Array(32);

async function sha256(bytes: Bytes): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

export async function entropyToWords(entropy: Bytes): Promise<string[]> {
  if (entropy.length !== ENTROPY_BYTES) throw new Error('Entropy must be 16 bytes');
  const checksum = (await sha256(entropy))[0]! >> 4; // first 4 bits
  let bits = '';
  for (const b of entropy) bits += b.toString(2).padStart(8, '0');
  bits += checksum.toString(2).padStart(4, '0');
  const words: string[] = [];
  for (let i = 0; i < PHRASE_WORDS; i++) words.push(WORDLIST[parseInt(bits.slice(i * 11, i * 11 + 11), 2)]!);
  return words;
}

export async function newPhrase(): Promise<{ words: string[]; entropy: Bytes }> {
  const entropy = randomBytes(ENTROPY_BYTES);
  return { words: await entropyToWords(entropy), entropy };
}

export class PhraseError extends Error {
  override name = 'PhraseError';
}

/** Parses what a person typed: any spacing or case. Throws with a plain message if it is wrong. */
export async function wordsToEntropy(input: string): Promise<Bytes> {
  const words = input.toLowerCase().trim().split(/[\s,]+/).filter(Boolean);
  if (words.length !== PHRASE_WORDS) throw new PhraseError(`That is ${words.length} words; it should be 12.`);
  let bits = '';
  for (const w of words) {
    const i = WORDLIST.indexOf(w);
    if (i < 0) throw new PhraseError(`“${w}” is not one of the recovery words. Check the spelling.`);
    bits += i.toString(2).padStart(11, '0');
  }
  const entropy = new Uint8Array(ENTROPY_BYTES);
  for (let i = 0; i < ENTROPY_BYTES; i++) entropy[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  const checksum = parseInt(bits.slice(128), 2);
  if ((await sha256(entropy))[0]! >> 4 !== checksum) {
    throw new PhraseError('Those words do not fit together. Check their order and spelling.');
  }
  return entropy;
}

async function hkdf(entropy: Bytes, info: string): Promise<Bytes> {
  const ikm = await crypto.subtle.importKey('raw', entropy, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: utf8(info) }, ikm, 256));
}

export function lookupToken(entropy: Bytes): Promise<Bytes> {
  return hkdf(entropy, 'our-kahani/recovery/lookup/v1');
}

async function wrapKey(entropy: Bytes): Promise<CryptoKey> {
  const raw = await hkdf(entropy, 'our-kahani/recovery/wrap/v1');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export interface Backup {
  roomKey: Bytes;
  notesKey: Bytes;
}

const backupCtx = (roomId: string) => ({ roomId, recordId: 'backup', kind: 0 });

/** Plaintext padded to a fixed size so every backup is the same length. */
export async function sealBackup(entropy: Bytes, roomId: string, backup: Backup): Promise<Bytes> {
  const json = utf8(JSON.stringify({ v: 1, room: toBase64Url(backup.roomKey), notes: toBase64Url(backup.notesKey) }));
  const padded = concat(json, new Uint8Array(160 - json.length).fill(0x20));
  return seal(await wrapKey(entropy), backupCtx(roomId), padded);
}

export async function openBackup(entropy: Bytes, roomId: string, envelope: Bytes): Promise<Backup> {
  const data = JSON.parse(fromUtf8(await open(await wrapKey(entropy), backupCtx(roomId), envelope))) as {
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
