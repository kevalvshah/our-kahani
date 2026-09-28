import { describe, expect, it } from 'vitest';
import { toBase64Url, utf8 } from './bytes';
import { EnvelopeError, seal } from './envelope';
import {
  entropyToWords,
  lookupToken,
  newPhrase,
  openBackup,
  PhraseError,
  sealBackup,
  wordsToEntropy,
} from './recovery';
import { generateRoomKeyBytes } from './roomKey';
import { WORDLIST } from './wordlist';

const hex = (h: string) => Uint8Array.from(h.match(/../g)!.map((b) => parseInt(b, 16)));

// Official BIP39 English test vectors (trezor/python-mnemonic vectors.json).
const VECTORS: [string, string][] = [
  ['00000000000000000000000000000000', 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'],
  ['7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f', 'legal winner thank year wave sausage worth useful legal winner thank yellow'],
  ['80808080808080808080808080808080', 'letter advice cage absurd amount doctor acoustic avoid letter advice cage above'],
  ['ffffffffffffffffffffffffffffffff', 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong'],
  ['9e885d952ad362caeb4efe34a8e91bd2', 'ozone drill grab fiber curtain grace pudding thank cruise elder eight picnic'],
];

describe('wordlist', () => {
  it('is the 2048-word BIP39 English list', async () => {
    expect(WORDLIST).toHaveLength(2048);
    expect(new Set(WORDLIST).size).toBe(2048);
    const file = new TextEncoder().encode(WORDLIST.join('\n') + '\n');
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', file))].map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(digest).toBe('2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda');
  });
});

describe('recovery phrase', () => {
  it.each(VECTORS)('matches the BIP39 vector for %s', async (entropy, words) => {
    expect((await entropyToWords(hex(entropy))).join(' ')).toBe(words);
    expect(await wordsToEntropy(words)).toEqual(hex(entropy));
  });

  it('makes a new random 12-word phrase that reads back', async () => {
    const a = await newPhrase();
    const b = await newPhrase();
    expect(a.words).toHaveLength(12);
    expect(a.words.join(' ')).not.toBe(b.words.join(' '));
    expect(await wordsToEntropy(a.words.join(' '))).toEqual(a.entropy);
  });

  it('forgives case, commas and spacing', async () => {
    const [entropy, words] = VECTORS[1]!;
    expect(await wordsToEntropy(`  ${words.toUpperCase().replace(/ /g, ', ')}\n`)).toEqual(hex(entropy));
  });

  it('explains what is wrong', async () => {
    await expect(wordsToEntropy('abandon about')).rejects.toThrow('2 words');
    await expect(wordsToEntropy(VECTORS[0]![1].replace('about', 'aboot'))).rejects.toThrow('“aboot”');
    // Real words in the wrong order fail the checksum (it catches most, not all, mix-ups).
    await expect(wordsToEntropy(Array(12).fill('abandon').join(' '))).rejects.toBeInstanceOf(PhraseError);
    await expect(wordsToEntropy(Array(12).fill('zoo').join(' '))).rejects.toThrow('do not fit together');
    await expect(entropyToWords(new Uint8Array(8))).rejects.toThrow('16 bytes');
  });

  it('derives a lookup token that is stable and reveals nothing of the words', async () => {
    const e = hex(VECTORS[4]![0]);
    const t = await lookupToken(e);
    expect(t).toHaveLength(32);
    expect(await lookupToken(e.slice())).toEqual(t);
    expect(await lookupToken(hex(VECTORS[1]![0]))).not.toEqual(t);
  });

  it('seals a backup that only the same words and room can open, always the same size', async () => {
    const { entropy } = await newPhrase();
    const backup = { roomKey: generateRoomKeyBytes(), notesKey: generateRoomKeyBytes() };
    const env = await sealBackup(entropy, 'room-1', backup);
    expect(await openBackup(entropy, 'room-1', env)).toEqual(backup);
    expect(env.length).toBe((await sealBackup(entropy, 'room-1', backup)).length);

    const other = await newPhrase();
    await expect(openBackup(other.entropy, 'room-1', env)).rejects.toBeInstanceOf(EnvelopeError);
    await expect(openBackup(entropy, 'room-2', env)).rejects.toBeInstanceOf(EnvelopeError);
  });

  it('rejects a backup with the wrong shape', async () => {
    const { entropy } = await newPhrase();
    const env = await sealBackup(entropy, 'room-1', { roomKey: new Uint8Array(16), notesKey: generateRoomKeyBytes() });
    await expect(openBackup(entropy, 'room-1', env)).rejects.toThrow('could not be read');
  });

  // Seals arbitrary JSON the way sealBackup does (same HKDF wrap key), to test malformed backups.
  async function sealRaw(entropy: Uint8Array<ArrayBuffer>, roomId: string, body: unknown) {
    const ikm = await crypto.subtle.importKey('raw', entropy, 'HKDF', false, ['deriveBits']);
    const raw = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: utf8('our-kahani/recovery/wrap/v1') }, ikm, 256);
    const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt']);
    return seal(key, { roomId, recordId: 'backup', kind: 0 }, utf8(JSON.stringify(body)));
  }

  it('rejects backups with missing, unreadable or wrong-version keys', async () => {
    const { entropy } = await newPhrase();
    const good = toBase64Url(generateRoomKeyBytes());
    // Sanity check: the helper produces a backup that opens.
    expect((await openBackup(entropy, 'r', await sealRaw(entropy, 'r', { v: 1, room: good, notes: good }))).roomKey).toHaveLength(32);
    for (const body of [
      { v: 1, notes: good },
      { v: 1, room: good },
      { v: 1, room: '', notes: good },
      { v: 1, room: good, notes: '!!not base64!!' },
      { v: 2, room: good, notes: good },
      {},
    ]) {
      await expect(openBackup(entropy, 'r', await sealRaw(entropy, 'r', body))).rejects.toBeInstanceOf(PhraseError);
    }
  });
});
