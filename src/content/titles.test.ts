import { describe, expect, it } from 'vitest';
import { CATALOG, type Genre, type TitleKind } from './titles';

// Same banned-word list and word-boundary matching as content.test.ts.
const BANNED = [
  'beer', 'wine', 'whisky', 'whiskey', 'vodka', 'rum', 'alcohol', 'drunk',
  'chicken', 'mutton', 'fish', 'prawn', 'egg', 'eggs', 'beef', 'pork', 'meat',
  'dog', 'cat', 'puppy', 'kitten', 'pet',
  'ex-boyfriend', 'ex-girlfriend', 'ex',
  'suicide', 'self-harm', 'abuse',
];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\-]/g, '\$&');
const BANNED_RE = BANNED.map((w) => ({ w, re: new RegExp(`\b${escape(w)}\b`, 'i') }));

const KINDS: TitleKind[] = ['movie', 'series', 'special'];
const GENRES: Genre[] = [
  'romance', 'comedy', 'drama', 'family', 'thriller', 'horror', 'scifi', 'fantasy', 'spy', 'action', 'crime',
  'mystery', 'animation', 'documentary', 'sports', 'music', 'standup', 'reality', 'anime', 'historical',
];

describe('Movie Night catalogue', () => {
  it('has unique, well-formed ids', () => {
    const ids = CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(KINDS)('has at least one %s', (kind) => {
    expect(CATALOG.some((t) => t.kind === kind)).toBe(true);
  });

  it.each(GENRES)('uses genre %s at least 3 times', (genre) => {
    expect(CATALOG.filter((t) => t.genres.includes(genre)).length).toBeGreaterThanOrEqual(3);
  });

  it('is English and Hindi heavy, with plenty of comedy specials', () => {
    expect(CATALOG.filter((t) => t.lang === 'English').length).toBeGreaterThanOrEqual(80);
    expect(CATALOG.filter((t) => t.lang === 'Hindi').length).toBeGreaterThanOrEqual(60);
    expect(CATALOG.filter((t) => t.kind === 'special').length).toBeGreaterThanOrEqual(15);
  });

  it('keeps hooks short and free of banned words', () => {
    const hits: string[] = [];
    for (const t of CATALOG) {
      expect(t.hook.length, t.id).toBeLessThanOrEqual(80);
      expect(t.hook.trim().length, t.id).toBeGreaterThan(0);
      for (const { w, re } of BANNED_RE) if (re.test(t.hook)) hits.push(`${t.id}: "${w}"`);
    }
    expect(hits).toEqual([]);
  });

  it('has sensible years, an emoji and at least one genre', () => {
    for (const t of CATALOG) {
      expect(t.year, t.id).toBeGreaterThanOrEqual(1950);
      expect(t.year, t.id).toBeLessThanOrEqual(2026);
      expect(t.e.length, t.id).toBeGreaterThan(0);
      expect(t.genres.length, t.id).toBeGreaterThan(0);
      expect(new Set(t.genres).size, t.id).toBe(t.genres.length);
    }
  });
});
