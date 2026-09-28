import { randomBytes, type Bytes } from './bytes';

export const ROOM_KEY_BYTES = 32; // AES-256

/**
 * Raw key material for a new room. The raw bytes are needed exactly twice: to put in the
 * invite link fragment and to wrap under the recovery phrase. Everywhere else, use the
 * non-extractable CryptoKey from importRoomKey.
 */
export function generateRoomKeyBytes(): Bytes {
  return randomBytes(ROOM_KEY_BYTES);
}

export async function importRoomKey(raw: Bytes): Promise<CryptoKey> {
  if (raw.length !== ROOM_KEY_BYTES) throw new Error('Room key has the wrong length');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
