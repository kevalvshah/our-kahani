import { describe, expect, it } from 'vitest';
import { randomBytes, toBase64Url, utf8 } from './bytes';
import { EnvelopeError, seal } from './envelope';
import {
  hashtagSalt,
  lookupToken,
  MIN_WORDS,
  normalisePhrase,
  openBackup,
  PBKDF2_ROUNDS,
  phraseProblem,
  phraseSecret,
  PhraseError,
  sealBackup,
} from './recovery';
import { generateRoomKeyBytes } from './roomKey';

const hex = (h: string) => Uint8Array.from(h.match(/../g)!.map((b) => parseInt(b, 16)));
const newSecret = () => randomBytes(32);

describe('room phrase', () => {
  it('reads the same whatever the spacing, case or Unicode form', () => {
    expect(normalisePhrase('  Mango  LASSI	on Sundays ')).toBe('mango lassi on sundays');
    expect(normalisePhrase('ｍａｎｇｏ')).toBe('mango');
    expect(normalisePhrase('   ')).toBe('');
    expect(hashtagSalt('#ChaiAur_Coffee!')).toBe('chaiaur_coffee');
    expect(hashtagSalt('chaiaur_coffee')).toBe('chaiaur_coffee');
  });

  it('asks for four or more real, different words that are not just names or the hashtag', () => {
    expect(MIN_WORDS).toBe(4);
    expect(phraseProblem('mango lassi')).toMatch(/at least 4 words/);
    expect(phraseProblem('a b c d e')).toMatch(/longer/);
    expect(phraseProblem('mango mango mango mango')).toMatch(/different words/);
    expect(phraseProblem('asha ravi chaiaurcoffee asha', ['Asha', 'Ravi', '#ChaiAurCoffee'])).toMatch(/not just your names/);
    expect(phraseProblem('mango lassi on sunday mornings', ['Asha', 'Ravi', '#ChaiAurCoffee'])).toBeNull();
    expect(phraseProblem('asha loves rainy chai evenings', ['Asha'])).toBeNull();
  });

  it('uses 600,000 PBKDF2 rounds, salted with the hashtag', async () => {
    expect(PBKDF2_ROUNDS).toBe(600_000);
    // Reference: PBKDF2-HMAC-SHA256("mango lassi on sundays", "our-kahani/room-phrase/v1|chaiaurcoffee", 1, 32).
    const ref = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: utf8('our-kahani/room-phrase/v1|chaiaurcoffee'), iterations: 1 },
        await crypto.subtle.importKey('raw', utf8('mango lassi on sundays'), 'PBKDF2', false, ['deriveBits']),
        256,
      ),
    );
    expect(await phraseSecret('#ChaiAurCoffee', '  Mango Lassi  on SUNDAYS', 1)).toEqual(ref);
  });

  it('gives a different secret for another hashtag or phrase', async () => {
    const a = await phraseSecret('#chaiaurcoffee', 'mango lassi on sundays', 10);
    expect(await phraseSecret('#chaiaurcoffee', 'mango lassi on sundays', 10)).toEqual(a);
    expect(await phraseSecret('#chaiaurcoffe', 'mango lassi on sundays', 10)).not.toEqual(a);
    expect(await phraseSecret('#chaiaurcoffee', 'mango lassi on saturdays', 10)).not.toEqual(a);
  });

  it('explains a missing hashtag or phrase', async () => {
    await expect(phraseSecret('#', 'mango lassi on sundays', 1)).rejects.toThrow('hashtag');
    await expect(phraseSecret('#chai', '   ', 1)).rejects.toBeInstanceOf(PhraseError);
  });
});

describe('recovery backup', () => {
  it('derives a lookup token that is stable and reveals nothing of the phrase', async () => {
    const e = hex('9e885d952ad362caeb4efe34a8e91bd2');
    const t = await lookupToken(e);
    expect(t).toHaveLength(32);
    expect(await lookupToken(e.slice())).toEqual(t);
    expect(await lookupToken(hex('7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f'))).not.toEqual(t);
  });

  it('seals a backup that only the same secret and room can open, always the same size', async () => {
    const entropy = newSecret();
    const backup = { roomKey: generateRoomKeyBytes(), notesKey: generateRoomKeyBytes() };
    const env = await sealBackup(entropy, 'room-1', backup);
    expect(await openBackup(entropy, 'room-1', env)).toEqual(backup);
    expect(env.length).toBe((await sealBackup(entropy, 'room-1', backup)).length);

    const other = newSecret();
    await expect(openBackup(other, 'room-1', env)).rejects.toBeInstanceOf(EnvelopeError);
    await expect(openBackup(entropy, 'room-2', env)).rejects.toBeInstanceOf(EnvelopeError);
  });

  it('rejects a backup with the wrong shape', async () => {
    const entropy = newSecret();
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
    const entropy = newSecret();
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
