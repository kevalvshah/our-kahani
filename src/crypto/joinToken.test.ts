import { describe, expect, it } from 'vitest';
import { toBase64Url } from './bytes';
import { joinToken, joinVerifier } from './joinToken';
import { generateRoomKeyBytes } from './roomKey';

describe('join token', () => {
  it('is the same for the same key on both phones and 32 bytes long', async () => {
    const key = generateRoomKeyBytes();
    const t = await joinToken(key);
    expect(t).toHaveLength(32);
    expect(await joinToken(key.slice())).toEqual(t);
  });

  it('differs for a different key, and never equals the key itself', async () => {
    const key = generateRoomKeyBytes();
    const other = key.slice();
    other[0] = other[0]! ^ 1;
    const t = await joinToken(key);
    expect(await joinToken(other)).not.toEqual(t);
    expect(t).not.toEqual(key);
    expect(toBase64Url(t)).not.toContain(toBase64Url(key).slice(0, 8));
  });

  it('gives the server a verifier that is the SHA-256 of the token', async () => {
    const t = await joinToken(generateRoomKeyBytes());
    const v = await joinVerifier(t);
    expect(v).toHaveLength(32);
    expect(v).toEqual(new Uint8Array(await crypto.subtle.digest('SHA-256', t)));
    expect(v).not.toEqual(t);
  });

  it('matches a fixed vector (guards against accidental changes)', async () => {
    const t = await joinToken(new Uint8Array(32));
    expect(toBase64Url(t)).toMatchSnapshot();
  });

  it('refuses keys of the wrong length', async () => {
    await expect(joinToken(new Uint8Array(16))).rejects.toThrow('wrong length');
  });
});
