import { describe, expect, it } from 'vitest';
import { utf8 } from './bytes';
import { ENVELOPE_VERSION, EnvelopeError, open, openText, seal, sealText, type EnvelopeContext } from './envelope';
import { generateRoomKeyBytes, importRoomKey } from './roomKey';

const ctx: EnvelopeContext = { roomId: 'room-a', recordId: 'rec-1', kind: 1 };
const text = 'Chai or coffee? Chai, always. 🌸 चाय';

async function newKey() {
  return importRoomKey(generateRoomKeyBytes());
}

describe('envelope', () => {
  it('opens with the right key', async () => {
    const key = await newKey();
    const env = await sealText(key, ctx, text);
    expect(await openText(key, ctx, env)).toBe(text);
  });

  it('fails with the wrong key', async () => {
    const env = await sealText(await newKey(), ctx, text);
    await expect(openText(await newKey(), ctx, env)).rejects.toBeInstanceOf(EnvelopeError);
  });

  it('fails when any byte is tampered with', async () => {
    const key = await newKey();
    const env = await sealText(key, ctx, text);
    for (let i = 1; i < env.length; i++) {
      const bad = env.slice();
      bad[i] = bad[i]! ^ 0x01;
      await expect(open(key, ctx, bad)).rejects.toBeInstanceOf(EnvelopeError);
    }
  });

  it('fails when truncated', async () => {
    const key = await newKey();
    const env = await sealText(key, ctx, text);
    await expect(open(key, ctx, env.slice(0, env.length - 1))).rejects.toBeInstanceOf(EnvelopeError);
    await expect(open(key, ctx, env.slice(0, 20))).rejects.toBeInstanceOf(EnvelopeError);
    await expect(open(key, ctx, new Uint8Array(0))).rejects.toBeInstanceOf(EnvelopeError);
  });

  it.each([
    ['room', { ...ctx, roomId: 'room-b' }],
    ['record', { ...ctx, recordId: 'rec-2' }],
    ['type', { ...ctx, kind: 2 }],
  ])('fails when moved to another %s (AAD swap)', async (_, moved) => {
    const key = await newKey();
    const env = await sealText(key, ctx, text);
    await expect(open(key, moved, env)).rejects.toBeInstanceOf(EnvelopeError);
  });

  it('gives different ciphertext for the same text', async () => {
    const key = await newKey();
    const a = await sealText(key, ctx, text);
    const b = await sealText(key, ctx, text);
    expect(a).not.toEqual(b);
    expect(a.slice(1, 13)).not.toEqual(b.slice(1, 13)); // fresh IV
  });

  it('writes a versioned header and does not contain the plaintext', async () => {
    const key = await newKey();
    const env = await seal(key, ctx, utf8(text));
    expect(env[0]).toBe(ENVELOPE_VERSION);
    expect(env.length).toBe(1 + 12 + utf8(text).length + 16);
    expect(new TextDecoder('latin1').decode(env)).not.toContain('Chai');
  });

  it('rejects unknown versions', async () => {
    const key = await newKey();
    const env = await sealText(key, ctx, text);
    env[0] = 2;
    await expect(open(key, ctx, env)).rejects.toBeInstanceOf(EnvelopeError);
  });

  it.each([
    { ...ctx, roomId: 'a|record:x' },
    { ...ctx, recordId: '' },
    { ...ctx, kind: -1 },
    { ...ctx, kind: 1.5 },
    { ...ctx, kind: 40000 },
  ])('rejects unsafe context %o', async (bad) => {
    const key = await newKey();
    await expect(sealText(key, bad, text)).rejects.toBeInstanceOf(EnvelopeError);
  });

  it('fails when the plaintext is not valid UTF-8 text', async () => {
    const key = await newKey();
    const env = await seal(key, ctx, Uint8Array.of(0xff, 0xfe));
    await expect(openText(key, ctx, env)).rejects.toBeInstanceOf(EnvelopeError);
    expect(await open(key, ctx, env)).toEqual(Uint8Array.of(0xff, 0xfe));
  });

  it('rejects unsafe context when opening too', async () => {
    const key = await newKey();
    const env = await sealText(key, ctx, text);
    await expect(open(key, { ...ctx, roomId: 'a|b' }, env)).rejects.toBeInstanceOf(EnvelopeError);
  });

  it('refuses room keys of the wrong length', async () => {
    await expect(importRoomKey(new Uint8Array(16))).rejects.toThrow('wrong length');
  });

  it('uses non-extractable keys', async () => {
    const key = await newKey();
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });
});
