import { CATALOG, type CatalogTitle, type Genre, type TitleKind, type TitleLang } from '../content/titles';

// Movie Night decks. Both phones must swipe the same titles in the same order, so the deck is
// built from the shared setup alone: filter, then shuffle with the round as the seed.

export const DECK_SIZE = 20;

export interface DeckFilter {
  fmt: 'movie' | 'series' | 'binge' | 'special';
  langs?: TitleLang[];
  genres?: Genre[];
}

export function kindFor(fmt: DeckFilter['fmt']): TitleKind {
  return fmt === 'movie' ? 'movie' : fmt === 'special' ? 'special' : 'series';
}

/** Small deterministic PRNG (mulberry32): the same seed gives the same order on both phones. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function matchesFilter(t: CatalogTitle, f: DeckFilter): boolean {
  if (t.kind !== kindFor(f.fmt)) return false;
  if (f.langs?.length && !f.langs.includes(t.lang)) return false;
  if (f.genres?.length && !t.genres.some((g) => f.genres!.includes(g))) return false;
  return true;
}

/** The round's deck: titles matching the filter, minus ones already watched, in a shared order. */
export function buildDeck(f: DeckFilter, round: number, watched: string[] = [], catalog: CatalogTitle[] = CATALOG, size = DECK_SIZE): CatalogTitle[] {
  const seen = new Set(watched.map((w) => w.toLowerCase()));
  const pool = catalog.filter((t) => matchesFilter(t, f) && !seen.has(t.t.toLowerCase()));
  const r = rng(round * 7919 + pool.length);
  const out = pool.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out.slice(0, size);
}

export const PICKS = 5;

/** Old rounds saved swipes ({votes}); new ones save up to five picks. */
export function picksOf(v: { picks?: string[]; votes?: Record<string, boolean> } | undefined): string[] {
  if (!v) return [];
  if (v.picks) return v.picks.slice(0, PICKS);
  return Object.entries(v.votes ?? {}).filter(([, yes]) => yes).map(([id]) => id);
}

/** Titles both picked first, then the rest of each person's picks. */
export function comparePicks(mine: string[], theirs: string[]) {
  const both = mine.filter((id) => theirs.includes(id));
  return { both, onlyMine: mine.filter((id) => !both.includes(id)), onlyTheirs: theirs.filter((id) => !both.includes(id)) };
}

/** How many titles a filter would offer (to show before starting). */
export function poolSize(f: DeckFilter, catalog: CatalogTitle[] = CATALOG): number {
  return catalog.filter((t) => matchesFilter(t, f)).length;
}

export const GENRE_LABEL: Record<Genre, string> = {
  romance: '💕 Romance',
  comedy: '😂 Comedy',
  drama: '🎭 Drama',
  family: '👨‍👩‍👧 Family',
  thriller: '🔪 Thriller',
  horror: '👻 Horror',
  scifi: '🚀 Sci-fi',
  fantasy: '🧙 Fantasy',
  spy: '🕵️ Spy',
  action: '💥 Action',
  crime: '🚔 Crime',
  mystery: '🔎 Mystery',
  animation: '🎨 Animation',
  documentary: '🎥 Documentary',
  sports: '🏏 Sports',
  music: '🎶 Music',
  standup: '🎤 Stand-up',
  reality: '📺 Reality',
  anime: '🌸 Anime',
  historical: '🏛️ Historical',
};
