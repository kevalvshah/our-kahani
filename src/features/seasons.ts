import { SEASON, type CardEntry } from '../content/cards';
import { SEASONS, type Need, type Season, type SeasonId } from '../content/seasons';

// Seasons 2-5 (Season 1 is Pehli Baat, refs "day:N"). Every season is open from the start:
// couples go at their own pace. Refs are "season:<id>:<n>" (n from 1).

export const SEASON_PREFIX = 'season:';

export const seasonRef = (id: SeasonId, index: number) => `${SEASON_PREFIX}${id}:${index + 1}`;

export function findSeason(id: string): Season | undefined {
  return SEASONS.find((s) => s.id === id);
}

export function seasonEntry(ref: string): CardEntry | null {
  const m = /^season:(s[2-9]):(\d+)$/.exec(ref);
  if (!m) return null;
  const s = findSeason(m[1]!);
  const c = s?.cards[Number(m[2]) - 1];
  if (!s || !c) return null;
  return { id: ref, tag: `${s.e} ${s.name} · ${c.tag}`, card: c.card };
}

/** All refs of a season, in order. */
export function seasonRefs(s: Season): string[] {
  return s.cards.map((_, i) => seasonRef(s.id, i));
}

/** Season 1 refs, in order. */
export function seasonOneRefs(): string[] {
  return Object.keys(SEASON)
    .map(Number)
    .sort((a, b) => a - b)
    .map((n) => `day:${n}`);
}

/** Refs across every season for one need, lightest season first. */
export function refsForNeed(need: Need): string[] {
  return SEASONS.flatMap((s) => s.cards.flatMap((c, i) => (c.needs.includes(need) ? [seasonRef(s.id, i)] : [])));
}

export type { Need, Season, SeasonId };
