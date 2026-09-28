// The room this device is in, held in memory only. Nothing here is persisted yet: key storage
// on the device and the Supabase records arrive in the next Stage 1 step.
export interface Room {
  id: string;
  role: 'creator' | 'invitee';
  key: CryptoKey;
  safetyCode: string[];
  /** Only the creator holds the invite link (it contains the key). */
  invite?: string;
  startedAt: number;
}

export const ROOM_DAYS = 28;
export const SEASON_DAYS = 14;

export function dayOfSeason(room: Room, now = Date.now()): number {
  const day = Math.floor((now - room.startedAt) / 86_400_000) + 1;
  return Math.min(Math.max(day, 1), SEASON_DAYS);
}

export function daysLeft(room: Room, now = Date.now()): number {
  const left = ROOM_DAYS - Math.floor((now - room.startedAt) / 86_400_000);
  return Math.max(left, 0);
}
