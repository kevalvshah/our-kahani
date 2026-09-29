import { describe, expect, it } from 'vitest';
import { CATALOG, type CatalogTitle } from '../content/titles';
import { buildDeck, DECK_SIZE, GENRE_LABEL, kindFor, matchesFilter, poolSize } from './movieDeck';

describe('Movie Night deck', () => {
  it('maps the mood to a kind of title', () => {
    expect(kindFor('movie')).toBe('movie');
    expect(kindFor('series')).toBe('series');
    expect(kindFor('binge')).toBe('series');
    expect(kindFor('special')).toBe('special');
  });

  it('filters by kind, language and genre', () => {
    const t: CatalogTitle = { id: 'x', kind: 'movie', e: '🎬', t: 'X', year: 2000, lang: 'Hindi', genres: ['comedy', 'romance'] as CatalogTitle['genres'], hook: '' };
    expect(matchesFilter(t, { fmt: 'movie' })).toBe(true);
    expect(matchesFilter(t, { fmt: 'series' })).toBe(false);
    expect(matchesFilter(t, { fmt: 'movie', langs: ['English'] })).toBe(false);
    expect(matchesFilter(t, { fmt: 'movie', langs: ['Hindi'], genres: ['horror'] })).toBe(false);
    expect(matchesFilter(t, { fmt: 'movie', langs: ['Hindi'], genres: ['horror', 'romance'] })).toBe(true);
  });

  it('gives both phones the same deck for a round, and a different one next round', () => {
    const f = { fmt: 'movie' as const };
    const a = buildDeck(f, 3);
    expect(a).toHaveLength(DECK_SIZE);
    expect(buildDeck(f, 3).map((t) => t.id)).toEqual(a.map((t) => t.id));
    expect(buildDeck(f, 4).map((t) => t.id)).not.toEqual(a.map((t) => t.id));
    expect(a.every((t) => t.kind === 'movie')).toBe(true);
  });

  it('leaves out what you have already watched, and copes with small pools', () => {
    const f = { fmt: 'special' as const };
    const all = buildDeck(f, 1, [], CATALOG);
    const first = all[0]!.t;
    expect(buildDeck(f, 1, [first.toUpperCase()]).some((t) => t.t === first)).toBe(false);
    expect(poolSize(f)).toBeGreaterThanOrEqual(15);
    expect(buildDeck({ fmt: 'movie', langs: ['Other'], genres: ['anime'] }, 1)).toEqual([]);
  });

  it('labels every genre', () => {
    for (const t of CATALOG) for (const g of t.genres) expect(GENRE_LABEL[g]).toBeTruthy();
  });
});
