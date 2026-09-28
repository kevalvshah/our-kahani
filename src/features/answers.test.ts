import { describe, expect, it } from 'vitest';
import { EnvelopeError } from '../crypto/envelope';
import { generateRoomKeyBytes, importRoomKey } from '../crypto/roomKey';
import { TODAY_CARD } from '../packs/official';
import { openChoice, pad, sealChoice } from './answers';

const ctx = { roomId: 'room-1', recordId: 'rec-1' };

describe('sealed answers', () => {
  it('round-trips a choice', async () => {
    const key = await importRoomKey(generateRoomKeyBytes());
    const env = await sealChoice(key, ctx, 'words');
    expect(await openChoice(key, ctx, env)).toBe('words');
  });

  it('every option encrypts to the same length, so size never reveals the pick', async () => {
    const key = await importRoomKey(generateRoomKeyBytes());
    const lengths = new Set(
      await Promise.all(TODAY_CARD.options.map(async (o) => (await sealChoice(key, ctx, o.id)).length)),
    );
    expect(lengths.size).toBe(1);
  });

  it('does not contain the choice in the clear', async () => {
    const key = await importRoomKey(generateRoomKeyBytes());
    const env = await sealChoice(key, ctx, 'words');
    expect(new TextDecoder('latin1').decode(env)).not.toContain('words');
  });

  it('is bound to its record: moving it to another record fails', async () => {
    const key = await importRoomKey(generateRoomKeyBytes());
    const env = await sealChoice(key, ctx, 'hugs');
    await expect(openChoice(key, { ...ctx, recordId: 'rec-2' }, env)).rejects.toBeInstanceOf(EnvelopeError);
  });

  it('pads to fixed buckets and refuses anything too long', () => {
    expect(pad('{}')).toHaveLength(64);
    expect(pad('x'.repeat(65))).toHaveLength(256);
    expect(() => pad('x'.repeat(5000))).toThrow('too long');
  });

  it('rejects an unknown format', async () => {
    const key = await importRoomKey(generateRoomKeyBytes());
    const { seal } = await import('../crypto/envelope');
    const env = await seal(key, { ...ctx, kind: 1 }, pad('{"v":2}'));
    await expect(openChoice(key, ctx, env)).rejects.toThrow('Unknown answer format');
  });
});
