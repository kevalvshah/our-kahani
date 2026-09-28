// The room this device is in. The key lives on the device (src/crypto/keystore.ts); the server
// holds only ids, times and ciphertext.
export interface Room {
  id: string;
  role: 'creator' | 'invitee';
  key: CryptoKey;
  safetyCode: string[];
  /** The invite link, while the creator still has it (until the partner joins). */
  invite?: string;
  partnerJoined: boolean;
  startedAt: number;
  endsAt: number;
}

export const ROOM_DAYS = 28;
export const SEASON_DAYS = 14;

export function dayOfSeason(room: Pick<Room, 'startedAt'>, now = Date.now()): number {
  const day = Math.floor((now - room.startedAt) / 86_400_000) + 1;
  return Math.min(Math.max(day, 1), SEASON_DAYS);
}

export function daysLeft(room: Pick<Room, 'startedAt'> & Partial<Pick<Room, 'endsAt'>>, now = Date.now()): number {
  const end = room.endsAt ?? room.startedAt + ROOM_DAYS * 86_400_000;
  return Math.max(Math.ceil((end - now) / 86_400_000), 0);
}
