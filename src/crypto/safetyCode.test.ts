import { describe, expect, it } from 'vitest';
import { generateRoomKeyBytes } from './roomKey';
import { SAFETY_CODE_LENGTH, SAFETY_EMOJI, safetyCode } from './safetyCode';

describe('safety code', () => {
  it('has 64 distinct single-code-point emoji', () => {
    expect(SAFETY_EMOJI).toHaveLength(64);
    expect(new Set(SAFETY_EMOJI).size).toBe(64);
    for (const e of SAFETY_EMOJI) expect(Array.from(e)).toHaveLength(1);
  });

  it('is the same for the same key on both phones', async () => {
    const key = generateRoomKeyBytes();
    const a = await safetyCode(key);
    expect(a).toHaveLength(SAFETY_CODE_LENGTH);
    expect(await safetyCode(key.slice())).toEqual(a);
  });

  it('differs for a swapped key', async () => {
    const key = generateRoomKeyBytes();
    const swapped = key.slice();
    swapped[0] = swapped[0]! ^ 0x80;
    expect(await safetyCode(swapped)).not.toEqual(await safetyCode(key));
  });

  it('matches a fixed vector (guards against accidental changes)', async () => {
    const zeros = new Uint8Array(32);
    expect(await safetyCode(zeros)).toMatchSnapshot();
  });
});
