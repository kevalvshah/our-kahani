import { K } from '../data/kinds';
import type { AnswerStatus } from '../net/api';

// What the partner did since this person last looked, and what is waiting on them. Used for the
// toasts when the app opens and the counters on each tab, pack and game. Works on metadata and
// already-decrypted records only; nothing here leaves the device.

/** A place in the app with its own counter (route names). */
export type Area = 'today' | 'packs' | 'micro' | 'antakshari' | 'story' | 'photo' | 'movie' | 'gentle';

export interface Rec {
  kind: number;
  ref: string;
  mine: boolean;
  createdAt: number;
  data: unknown;
}

export interface Item {
  area: Area;
  text: string;
  count: number;
}

/** Which area a partner's record belongs to, and how to say it. */
const KINDS: Record<number, { area: Area; one: string; many?: string }> = {
  [K.PING]: { area: 'today', one: 'is thinking of you 💭' },
  [K.REACTION]: { area: 'today', one: 'sent you love on a card 💛', many: 'sent you love on {n} cards 💛' },
  [K.BONUS_CARD]: { area: 'today', one: 'made you a card 💌', many: 'made you {n} cards 💌' },
  [K.NOTICED]: { area: 'today', one: 'noticed something about you 🔎' },
  [K.BUG]: { area: 'today', one: 'filed a bug report 🐞' },
  [K.HASHTAG_SUGGESTION]: { area: 'today', one: 'suggested a name for your room' },
  [K.HASHTAG]: { area: 'today', one: 'locked your room’s name 🔒' },
  [K.MICRO]: { area: 'micro', one: 'is up for a micro-date 🎲' },
  [K.MICRO_NOTE]: { area: 'micro', one: 'shared something for your micro-date 🔗', many: 'shared {n} things for your micro-date 🔗' },
  [K.ANTAKSHARI]: { area: 'antakshari', one: 'added a song 🎵', many: 'added {n} songs 🎵' },
  [K.STORY_ASK]: { area: 'story', one: 'asked for a story 📖' },
  [K.STORY_TELL]: { area: 'story', one: 'told a story 📖' },
  [K.STORY_LINE]: { area: 'story', one: 'added to your story 📖', many: 'added {n} lines to your story 📖' },
  [K.STORY_CHAPTER]: { area: 'story', one: 'saved a story chapter 📖' },
  [K.PHOTO]: { area: 'photo', one: 'shared a photo 📷', many: 'shared {n} photos 📷' },
  [K.PHOTO_REACTION]: { area: 'photo', one: 'reacted to your photo' },
  [K.MOVIE_SETUP]: { area: 'movie', one: 'set up movie night 🍿' },
  [K.WATCHED]: { area: 'movie', one: 'marked something as watched 🍿' },
  [K.GENTLE_NOTE]: { area: 'gentle', one: 'shared a heads-up in Gentle Corner 💛' },
  [K.GENTLE_RESPONSE]: { area: 'gentle', one: 'replied in Gentle Corner 💛' },
  [K.GENTLE_REACT]: { area: 'gentle', one: 'reacted in Gentle Corner 💛' },
};

/** The partner's records since a time, grouped into short lines. */
export function newSince(records: Rec[], since: number, partner: string): Item[] {
  const groups = new Map<string, Item>();
  for (const r of records) {
    if (r.mine || r.createdAt <= since) continue;
    let area: Area;
    let one: string;
    let many: string | undefined;
    if (r.kind === K.GENTLE_OPT) {
      if (!(r.data as { on?: boolean } | null)?.on) continue;
      area = 'gentle';
      one = 'invited you to Gentle Corner 💛';
    } else {
      const k = KINDS[r.kind];
      if (!k) continue;
      ({ area, one, many } = k);
    }
    const key = `${r.kind}`;
    const g = groups.get(key) ?? { area, text: '', count: 0 };
    g.count++;
    g.text = `${partner} ${g.count > 1 && many ? many.replace('{n}', String(g.count)) : one}`;
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** Which area a card ref belongs to. */
export function areaOfRef(ref: string): Area | null {
  if (ref.startsWith('day:') || ref.startsWith('bonus:')) return 'today';
  if (ref.startsWith('pack:')) return 'packs';
  if (ref.startsWith('gentle:')) return 'gentle';
  if (ref.startsWith('movie:')) return 'movie';
  return null;
}

/** Cards the partner has answered and this person has not: their turn. */
export function waitingRefs(status: AnswerStatus[]): string[] {
  const mine = new Set(status.filter((s) => s.mine).map((s) => `${s.kind}|${s.ref}`));
  const out = new Set<string>();
  for (const s of status) if (!s.mine && s.kind < 50 && !mine.has(`${s.kind}|${s.ref}`)) out.add(s.ref);
  return [...out];
}

/** Waiting cards per area, and per pack id. */
export function waitingCounts(refs: string[]): { areas: Partial<Record<Area, number>>; packs: Record<string, number> } {
  const areas: Partial<Record<Area, number>> = {};
  const packs: Record<string, number> = {};
  for (const ref of refs) {
    const a = areaOfRef(ref);
    if (!a) continue;
    areas[a] = (areas[a] ?? 0) + 1;
    if (a === 'packs') {
      const id = ref.split(':')[1]!;
      packs[id] = (packs[id] ?? 0) + 1;
    }
  }
  return { areas, packs };
}

/** Toast lines for cards that became "your turn" since last time. */
export function newlyWaiting(now: string[], before: string[], partner: string): Item[] {
  const seen = new Set(before);
  const fresh = now.filter((r) => !seen.has(r));
  if (!fresh.length) return [];
  const byArea = waitingCounts(fresh).areas;
  return (Object.entries(byArea) as [Area, number][]).map(([area, n]) => ({
    area,
    count: n,
    text:
      area === 'gentle'
        ? `${partner} answered ${n === 1 ? 'a Gentle Corner card' : `${n} Gentle Corner cards`} · your turn 💛`
        : `${partner} answered ${n === 1 ? 'a card' : `${n} cards`} · your turn`,
  }));
}

/** Counter for each area: new things since the area was last opened, plus cards waiting there. */
export function badges(records: Rec[], seenAt: Partial<Record<Area, number>>, waiting: Partial<Record<Area, number>>, partner: string): Partial<Record<Area, number>> {
  const out: Partial<Record<Area, number>> = { ...waiting };
  for (const area of Object.keys(KIND_AREAS) as Area[]) {
    const n = newSince(records, seenAt[area] ?? 0, partner)
      .filter((i) => i.area === area)
      .reduce((a, i) => a + i.count, 0);
    if (n) out[area] = (out[area] ?? 0) + n;
  }
  return out;
}

const KIND_AREAS: Record<Area, true> = { today: true, packs: true, micro: true, antakshari: true, story: true, photo: true, movie: true, gentle: true };
