import { describe, expect, it } from 'vitest';
import { PACKS, type Card } from './cards';
import { GENTLE_CARDS, GENTLE_DEPTHS } from './gentle';

const BANNED = [
  'beer', 'wine', 'whisky', 'whiskey', 'vodka', 'rum', 'alcohol', 'drunk',
  'chicken', 'mutton', 'fish', 'prawn', 'egg', 'eggs', 'beef', 'pork', 'meat',
  'dog', 'cat', 'puppy', 'kitten', 'pet',
  'ex-boyfriend', 'ex-girlfriend', 'ex',
  'suicide', 'self-harm', 'abuse',
];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
const BANNED_RE = BANNED.map((w) => ({ w, re: new RegExp(`\\b${escape(w)}\\b`, 'i') }));

function cardText(card: Card): string[] {
  const out: string[] = [];
  if ('q' in card) out.push(card.q);
  if ('ph' in card) out.push(card.ph);
  if ('banner' in card && card.banner) out.push(card.banner);
  const opts = 'opts' in card ? card.opts : 'items' in card ? card.items : [];
  for (const opt of opts) out.push(opt.l, opt.sub ?? '');
  return out;
}

function optionIds(card: Card): string[] | null {
  if ('opts' in card) return card.opts.map((x) => x.id);
  if ('items' in card) return card.items.map((x) => x.id);
  return null;
}

function bannedIn(texts: string[]): string[] {
  const hits: string[] = [];
  for (const t of texts) for (const { w, re } of BANNED_RE) if (re.test(t)) hits.push(`"${w}" in "${t}"`);
  return hits;
}

describe('official packs', () => {
  it.each(PACKS.map((p) => [p.id, p] as const))('%s has at least 12 cards', (_id, p) => {
    expect(p.cards.length).toBeGreaterThanOrEqual(12);
  });

  it('pack ids are unique', () => {
    expect(new Set(PACKS.map((p) => p.id)).size).toBe(PACKS.length);
  });

  it('option ids are unique within each card', () => {
    for (const p of PACKS)
      p.cards.forEach((c, i) => {
        const ids = optionIds(c);
        if (ids) expect(new Set(ids).size, `${p.id} card ${i + 1}`).toBe(ids.length);
      });
  });

  it('guess answers point at a real option', () => {
    for (const p of PACKS)
      for (const c of p.cards) if (c.type === 'guess') expect(c.opts.map((x) => x.id)).toContain(c.ans);
  });

  it('contain no banned words', () => {
    const texts = PACKS.flatMap((p) => [p.name, p.blurb, ...p.cards.flatMap(cardText)]);
    expect(bannedIn(texts)).toEqual([]);
  });
});

describe('Gentle Corner deck', () => {
  it('lists the four depths, light first', () => {
    expect(GENTLE_DEPTHS.map((d) => d.id)).toEqual(['light', 'personal', 'emotional', 'deep']);
  });

  it.each(GENTLE_DEPTHS.map((d) => [d.id] as const))('%s has at least 12 cards', (depth) => {
    expect(GENTLE_CARDS.filter((c) => c.depth === depth).length).toBeGreaterThanOrEqual(12);
  });

  it('card ids are unique', () => {
    expect(new Set(GENTLE_CARDS.map((c) => c.id)).size).toBe(GENTLE_CARDS.length);
  });

  it('option ids are unique within each card', () => {
    for (const { id, card } of GENTLE_CARDS) {
      const ids = optionIds(card);
      if (ids) expect(new Set(ids).size, id).toBe(ids.length);
    }
  });

  it('every tick-any and this-or-that card offers a pass option', () => {
    for (const { id, card } of GENTLE_CARDS)
      if (card.type === 'multi' || card.type === 'choice') expect(card.opts.map((x) => x.id), id).toContain('pass');
  });

  it('keeps never-have-I-ever to the light and personal depths', () => {
    for (const { id, depth, card } of GENTLE_CARDS)
      if (card.type === 'nhie') expect(['light', 'personal'], id).toContain(depth);
  });

  it('contains no banned words', () => {
    const texts = [
      ...GENTLE_DEPTHS.flatMap((d) => [d.l, d.sub]),
      ...GENTLE_CARDS.flatMap((c) => cardText(c.card)),
    ];
    expect(bannedIn(texts)).toEqual([]);
  });

  it('the banned-word check uses word boundaries', () => {
    expect(bannedIn(['I expect exciting things', 'a catalogue of pets and carpets'])).toEqual([]);
    expect(bannedIn(['my ex', 'Egg fried rice'])).toHaveLength(2);
  });
});
