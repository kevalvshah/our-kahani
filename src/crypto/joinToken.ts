import { utf8, type Bytes } from './bytes';
import { ROOM_KEY_BYTES } from './roomKey';

// Joining a room proves you hold its key without revealing it. The join token is derived from
// the room key with HKDF (one-way); the server stores only SHA-256(token) at creation and
// compares at join. Neither the token nor its hash can be turned back into the key.

const INFO = utf8('our-kahani/join/v1');
const SALT = new Uint8Array(32); // fixed zero salt: the input is already a uniformly random key

export async function joinToken(rawKey: Bytes): Promise<Bytes> {
  if (rawKey.length !== ROOM_KEY_BYTES) throw new Error('Room key has the wrong length');
  const ikm = await crypto.subtle.importKey('raw', rawKey, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: INFO }, ikm, 256);
  return new Uint8Array(bits);
}

export async function joinVerifier(token: Bytes): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', token));
}
