import { fromBase64Url, toBase64Url, type Bytes } from './bytes';
import { isValidId } from './ids';
import { ROOM_KEY_BYTES } from './roomKey';

// Invite: https://<host>/join/<roomId>#k1.<base64url room key>
// Browsers never send the fragment to servers. Never log a full invite URL.

const FRAGMENT_PREFIX = 'k1.';
const JOIN_PATH = /^\/join\/([^/]+)\/?$/;

export function buildInviteUrl(origin: string, roomId: string, rawKey: Bytes): string {
  if (!isValidId(roomId)) throw new Error('Invalid room id');
  if (rawKey.length !== ROOM_KEY_BYTES) throw new Error('Room key has the wrong length');
  return `${origin}/join/${roomId}#${FRAGMENT_PREFIX}${toBase64Url(rawKey)}`;
}

export function parseJoinPath(pathname: string): string | null {
  const id = JOIN_PATH.exec(pathname)?.[1];
  return id !== undefined && isValidId(id) ? id : null;
}

export function parseInviteFragment(hash: string): Bytes | null {
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!body.startsWith(FRAGMENT_PREFIX)) return null;
  const key = fromBase64Url(body.slice(FRAGMENT_PREFIX.length));
  return key !== null && key.length === ROOM_KEY_BYTES ? key : null;
}

/**
 * Reads the key from the fragment, then removes the fragment from the address bar and
 * history entry, whether or not it was valid. Call only after the in-app browser check.
 */
export function takeInviteKeyFromLocation(
  loc: Pick<Location, 'hash' | 'pathname' | 'search'>,
  hist: Pick<History, 'replaceState'>,
): Bytes | null {
  if (!loc.hash) return null;
  const key = parseInviteFragment(loc.hash);
  hist.replaceState(null, '', loc.pathname + loc.search);
  return key;
}
