import { describe, expect, it } from 'vitest';
import { toBase64Url, utf8 } from './bytes';
import { EnvelopeError, seal } from './envelope';
import { PhraseError } from './recovery';
import { formatRescueCode, newRescueCode, openRescue, parseRescueCode, rescueLookup, sealRescue } from './rescue';
import { generateRoomKeyBytes } from './roomKey';

describe('rescue code', () => {
  it('is 16 Crockford base32 characters in four groups, and reads back', () => {
    const { code, bytes } = newRescueCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    expect(parseRescueCode(code)).toEqual(bytes);
    expect(newRescueCode().code).not.toBe(code);
    expect(formatRescueCode(new Uint8Array(10))).toBe('0000-0000-0000-0000');
    expect(formatRescueCode(new Uint8Array(10).fill(255))).toBe('ZZZZ-ZZZZ-ZZZZ-ZZZZ');
  });

  it('forgives case, spaces, dashes and look-alike letters', () => {
    const { code, bytes } = newRescueCode();
    expect(parseRescueCode(` ${code.toLowerCase().replace(/-/g, ' ')} `)).toEqual(bytes);
    expect(parseRescueCode('oooo-iiii-llll-0000')).toEqual(parseRescueCode('0000-1111-1111-0000'));
  });

  it('explains a wrong length or character', () => {
    expect(() => parseRescueCode('ABCD-EFGH')).toThrow(PhraseError);
    expect(() => parseRescueCode('ABCD-EFGH-JKMN-PQRU')).toThrow('“U”');
  });

  it('seals the room key so only the same code, hashtag and room can open it', async () => {
    const { bytes } = newRescueCode();
    const key = generateRoomKeyBytes();
    const env = await sealRescue(bytes, '#ChaiAurCoffee', 'room-1', key);
    expect(await openRescue(bytes, 'chaiaurcoffee', 'room-1', env)).toEqual(key);
    await expect(openRescue(newRescueCode().bytes, '#ChaiAurCoffee', 'room-1', env)).rejects.toBeInstanceOf(EnvelopeError);
    await expect(openRescue(bytes, '#Other', 'room-1', env)).rejects.toBeInstanceOf(EnvelopeError);
    await expect(openRescue(bytes, '#ChaiAurCoffee', 'room-2', env)).rejects.toBeInstanceOf(EnvelopeError);
  });

  it('derives a lookup tied to code and hashtag, unrelated to the sealing key', async () => {
    const { bytes } = newRescueCode();
    const a = await rescueLookup(bytes, '#ChaiAurCoffee');
    expect(a).toHaveLength(32);
    expect(await rescueLookup(bytes, 'chaiaurcoffee')).toEqual(a);
    expect(await rescueLookup(bytes, '#Other')).not.toEqual(a);
    await expect(rescueLookup(bytes, '#')).rejects.toThrow('hashtag');
  });

  it('rejects a sealed value with the wrong shape', async () => {
    const { bytes } = newRescueCode();
    const env = await sealRescue(bytes, '#t', 'r', new Uint8Array(16));
    await expect(openRescue(bytes, '#t', 'r', env)).rejects.toThrow('could not be read');
    // Same wrap key, other bodies.
    const salt = new Uint8Array(await crypto.subtle.digest('SHA-256', utf8('our-kahani/rescue/v1|t')));
    const ikm = await crypto.subtle.importKey('raw', bytes, 'HKDF', false, ['deriveBits']);
    const raw = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: utf8('our-kahani/rescue/wrap/v1') }, ikm, 256);
    const k = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt']);
    for (const body of [{}, { v: 2, room: toBase64Url(generateRoomKeyBytes()) }]) {
      const e = await seal(k, { roomId: 'r', recordId: 'rescue', kind: 0 }, utf8(JSON.stringify(body)));
      await expect(openRescue(bytes, '#t', 'r', e)).rejects.toBeInstanceOf(PhraseError);
    }
  });
});
