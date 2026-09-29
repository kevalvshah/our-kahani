import { PACKS, packRef, SEASON, dayRef, type CardEntry } from '../content/cards';
import { K } from '../data/kinds';
import type { RoomData } from '../data/RoomData';
import { dayOfSeason, SEASON_DAYS } from '../state/room';
import type { Answer, BonusCard } from './cardLogic';
import { entryFor, isAnswered } from './cardLogic';

// What is done and what is next, for one person. Skipping is always fine: nothing here scores.

/** True when this person has done their part of the card. */
export function doneByMe(d: RoomData, ref: string): boolean {
  const bonus = d.list<BonusCard>(K.BONUS_CARD).find((r) => r.ref === ref)?.data;
  const entry = entryFor(ref, bonus);
  if (!entry) return false;
  const c = entry.card;
  if (c.type === 'noticed') return !!d.mine(K.NOTICED, ref);
  if (c.type === 'bug') return !!d.mine(K.BUG, ref);
  return isAnswered(c, d.mine<Answer>(K.ANSWER, ref)?.data);
}

export function unlockedDays(d: RoomData): number[] {
  const today = dayOfSeason(d.room);
  return Array.from({ length: SEASON_DAYS }, (_, i) => i + 1).filter((n) => n <= today && SEASON[n]);
}

/** The first card waiting on this person: season days so far, then extra cards from the partner. */
export function firstWaiting(d: RoomData): string | null {
  for (const n of unlockedDays(d)) if (!doneByMe(d, dayRef(n))) return dayRef(n);
  for (const b of d.list(K.BONUS_CARD)) if (!b.mine && !doneByMe(d, b.ref)) return b.ref;
  return null;
}

/** The next card after this one: next in the pack, or the next waiting season card. */
export function nextCardFor(d: RoomData, entry: CardEntry): string | null {
  if (entry.pack) {
    const pack = PACKS.find((p) => p.id === entry.pack)!;
    const idx = Number(entry.id.split(':')[2]) - 1;
    for (let i = idx + 1; i < pack.cards.length; i++) if (!doneByMe(d, packRef(pack.id, i))) return packRef(pack.id, i);
    return null;
  }
  const next = firstWaiting(d);
  return next && next !== entry.id ? next : null;
}

export function packProgress(d: RoomData, packId: string): { done: number; total: number } {
  const pack = PACKS.find((p) => p.id === packId);
  if (!pack) return { done: 0, total: 0 };
  return { done: pack.cards.filter((_, i) => doneByMe(d, packRef(packId, i))).length, total: pack.cards.length };
}

export function seasonDone(d: RoomData): number {
  return Array.from({ length: SEASON_DAYS }, (_, i) => i + 1).filter((n) => doneByMe(d, dayRef(n))).length;
}

export { entryFor };
