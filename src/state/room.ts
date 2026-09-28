// The room this device is in. Keys live on the device (src/crypto/keystore.ts); the server holds
// only ids, times and ciphertext.
export interface Room {
  id: string;
  role: 'creator' | 'invitee';
  key: CryptoKey;
  notesKey: CryptoKey;
  safetyCode: string[];
  /** The invite link, while the creator still has it (until the partner joins). */
  invite?: string;
  partnerJoined: boolean;
  /** False until the recovery words have been written down and the backup saved. */
  backedUp: boolean;
  startedAt: number;
  endsAt: number;
}

export const ROOM_DAYS = 28;
export const SEASON_DAYS = 14;
export const DAY_MS = 86_400_000;

export function dayOfSeason(room: Pick<Room, 'startedAt'>, now = Date.now()): number {
  const day = Math.floor((now - room.startedAt) / DAY_MS) + 1;
  return Math.min(Math.max(day, 1), SEASON_DAYS);
}

export function daysLeft(room: Pick<Room, 'startedAt'> & Partial<Pick<Room, 'endsAt'>>, now = Date.now()): number {
  const end = room.endsAt ?? room.startedAt + ROOM_DAYS * DAY_MS;
  // Rounded, so a phone clock a little behind the server's never shows 29 days.
  return Math.max(Math.round((end - now) / DAY_MS), 0);
}
