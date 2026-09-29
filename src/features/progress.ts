import { PACKS, packRef, SEASON, dayRef, type CardEntry } from '../content/cards';
import { K } from '../data/kinds';
import type { RoomData } from '../data/RoomData';
import { SEASON_DAYS } from '../state/room';
import type { Answer, BonusCard } from './cardLogic';
import { entryFor, isAnswered } from './cardLogic';
import { SEASONS } from '../content/seasons';
import { seasonOneRefs, seasonRefs } from './seasons';

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

/** Every season card is open from the start: couples go at their own pace. */
export function unlockedDays(_d?: RoomData): number[] {
  return Array.from({ length: SEASON_DAYS }, (_, i) => i + 1).filter((n) => SEASON[n]);
}

/** The first card waiting on this person: season days so far, then extra cards from the partner. */
export function firstWaiting(d: RoomData, skip?: string): string | null {
  for (const n of unlockedDays(d)) if (dayRef(n) !== skip && !doneByMe(d, dayRef(n))) return dayRef(n);
  for (const b of d.list(K.BONUS_CARD)) if (b.ref !== skip && !b.mine && !doneByMe(d, b.ref)) return b.ref;
  return null;
}

/** The first unanswered card in the packs, in pack order: for playing on after today's card. */
export function firstPackCard(d: RoomData): string | null {
  for (const p of PACKS) for (let i = 0; i < p.cards.length; i++) if (!doneByMe(d, packRef(p.id, i))) return packRef(p.id, i);
  return null;
}

/** The first unanswered card in Seasons 2-5, in order. */
export function firstSeasonCard(d: RoomData, skip?: string): string | null {
  for (const s of SEASONS) for (const ref of seasonRefs(s)) if (ref !== skip && !doneByMe(d, ref)) return ref;
  return null;
}

/** A small stable hash, so each room gets its own pack order (the same on both phones). */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The next pack card, mixed: packs take turns (least played first, in an order shuffled per
 * room), and the next card avoids the pack and the card type just played whenever it can.
 */
export function mixedPackCard(d: RoomData, after?: string): string | null {
  const last = after ? entryFor(after) : null;
  const order = [...PACKS].sort((a, b) => hash(d.room.id + a.id) - hash(d.room.id + b.id));
  // Least-played packs first, so every pack gets a turn; the room's order breaks ties.
  const waiting = order
    .flatMap((p) => {
      const i = p.cards.findIndex((_, n) => packRef(p.id, n) !== after && !doneByMe(d, packRef(p.id, n)));
      const played = p.cards.filter((_, n) => doneByMe(d, packRef(p.id, n))).length;
      return i < 0 ? [] : [{ pack: p.id, ref: packRef(p.id, i), type: p.cards[i]!.type, played }];
    })
    .sort((a, b) => a.played - b.played);
  const fresh = waiting.find((w) => w.pack !== last?.pack && w.type !== last?.card.type);
  return (fresh ?? waiting.find((w) => w.pack !== last?.pack) ?? waiting[0])?.ref ?? null;
}

/** What to play next: Season 1, then Seasons 2-5, then the packs, mixed. Never stops early. */
export function keepPlaying(d: RoomData, after?: string): string | null {
  return firstWaiting(d, after) ?? firstSeasonCard(d, after) ?? mixedPackCard(d, after);
}

/** Progress in a season (Season 2-5 id, or 's1' for Pehli Baat). */
export function seasonProgress(d: RoomData, id: string): { done: number; total: number } {
  const refs = id === 's1' ? seasonOneRefs() : (() => {
    const s = SEASONS.find((x) => x.id === id);
    return s ? seasonRefs(s) : [];
  })();
  return { done: refs.filter((r) => doneByMe(d, r)).length, total: refs.length };
}

/** The next card after this one: whatever Keep playing offers next (packs mixed, never one type in a row). */
export function nextCardFor(d: RoomData, entry: CardEntry): string | null {
  return keepPlaying(d, entry.id);
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
