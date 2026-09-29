import { describe, expect, it } from 'vitest';
import { PACKS, SEASON, type Card } from './cards';
import { GENTLE_CARDS, GENTLE_DEPTHS } from './gentle';
import { SEASONS } from './seasons';
import * as together from './together';

const BANNED = [
  'beer', 'wine', 'whisky', 'whiskey', 'vodka', 'rum', 'alcohol', 'drunk',
  'chicken', 'mutton', 'fish', 'prawn', 'egg', 'eggs', 'beef', 'pork', 'meat',
  'dog', 'cat', 'puppy', 'kitten', 'pet',
  'ex-boyfriend', 'ex-girlfriend', 'ex',
  'suicide', 'self-harm', 'abuse',
];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
const BANNED_RE = BANNED.map((w) => ({ w, re: new RegExp(`\\b${escape(w)}\\b`, 'i') }));

const THERAPY_RE = /\b(trigger\w*|attachment|conflict\w*|vulnerab\w*|boundar\w*|trauma\w*|therap\w*)\b/i;

function cardText(card: Card): string[] {
  const out: string[] = [];
  if ('q' in card) out.push(card.q);
  if ('ph' in card) out.push(card.ph);
  if ('banner' in card && card.banner) out.push(card.banner);
  const opts = 'opts' in card ? card.opts : 'items' in card ? card.items : [];
  // Egg and non-veg dishes are allowed only as tagged options (shown when both people eat them);
  // they are checked by the food test below instead.
  for (const opt of opts) if (opt.diet !== 'egg' && opt.diet !== 'nonveg') out.push(opt.l, opt.sub ?? '');
  return out;
}

function allCards(): { where: string; card: Card }[] {
  return [
    ...Object.entries(SEASON).map(([day, s]) => ({ where: `Season 1 day ${day}`, card: s.card })),
    ...PACKS.flatMap((p) => p.cards.map((card, i) => ({ where: `${p.id} ${i + 1}`, card }))),
    ...SEASONS.flatMap((s) => s.cards.map((c, i) => ({ where: `${s.id} ${i + 1}`, card: c.card }))),
  ];
}

function everyText(card: Card): string[] {
  const opts = 'opts' in card ? card.opts : 'items' in card ? card.items : [];
  return ['q' in card ? card.q : '', 'ph' in card ? card.ph : '', ...opts.map((o) => o.l)];
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

describe('Season 1 (Pehli Baat)', () => {
  it('has exactly days 1 to 14', () => {
    expect(Object.keys(SEASON).map(Number)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
  });

  it('option ids are unique within each card', () => {
    for (const [n, { card }] of Object.entries(SEASON)) {
      const ids = optionIds(card);
      if (ids) expect(new Set(ids).size, `day ${n}`).toBe(ids.length);
    }
  });

  it('contains no banned words', () => {
    expect(bannedIn(Object.values(SEASON).flatMap((s) => [s.tag, ...cardText(s.card)]))).toEqual([]);
  });
});

describe('Seasons 2 to 5', () => {
  const COUNTS = { s2: 24, s3: 18, s4: 18, s5: 18 } as const;
  const ANSWERABLE = ['choice', 'pick', 'multi', 'nhie', 'line', 'bet'];

  it('are in order with the planned card counts', () => {
    expect(SEASONS.map((s) => s.id)).toEqual(['s2', 's3', 's4', 's5']);
    expect(SEASONS.map((s) => s.n)).toEqual([2, 3, 4, 5]);
    for (const s of SEASONS) expect(s.cards.length, s.id).toBeGreaterThanOrEqual(COUNTS[s.id]);
  });

  it('every card has one or two needs', () => {
    for (const s of SEASONS)
      s.cards.forEach((c, i) => {
        expect(c.needs.length, `${s.id} card ${i + 1}`).toBeGreaterThanOrEqual(1);
        expect(c.needs.length, `${s.id} card ${i + 1}`).toBeLessThanOrEqual(2);
        expect(new Set(c.needs).size).toBe(c.needs.length);
      });
  });

  it('option ids are unique within each card', () => {
    for (const s of SEASONS)
      s.cards.forEach(({ card }, i) => {
        const ids = optionIds(card);
        if (ids) expect(new Set(ids).size, `${s.id} card ${i + 1}`).toBe(ids.length);
      });
  });

  it('every Season 2 tick-any and this-or-that card has a pass option', () => {
    const s2 = SEASONS.find((s) => s.id === 's2')!;
    s2.cards.forEach(({ card }, i) => {
      if (card.type === 'multi' || card.type === 'choice') expect(card.opts.map((x) => x.id), `s2 card ${i + 1}`).toContain('pass');
    });
  });

  it('Season 2 opens with Then vs Now, six of them spread out (never two in a row), pointing at answerable Season 1 days', () => {
    const s2 = SEASONS.find((s) => s.id === 's2')!;
    expect(s2.cards[0]!.card.type).toBe('then');
    expect(s2.cards.filter((c) => c.card.type === 'then')).toHaveLength(6);
    for (const s of SEASONS)
      s.cards.forEach((c, i) => {
        if (i > 0) expect(c.card.type === 'then' && s.cards[i - 1]!.card.type === 'then', `${s.id} card ${i + 1}`).toBe(false);
      });
    for (const s of SEASONS)
      for (const { card } of s.cards)
        if (card.type === 'then') {
          const m = /^day:(\d+)$/.exec(card.from);
          expect(m, card.from).not.toBeNull();
          const day = SEASON[Number(m![1])];
          expect(day, card.from).toBeDefined();
          expect(ANSWERABLE, card.from).toContain(day!.card.type);
        }
  });

  it('stay playful: reflective cards (needs include talk) never come twice in a row, and are at most a third', () => {
    for (const s of SEASONS) {
      const talk = s.cards.map((c) => c.needs.includes('talk'));
      talk.forEach((t, i) => {
        if (i > 0) expect(t && talk[i - 1], `${s.id} cards ${i} and ${i + 1}`).toBe(false);
      });
      expect(talk.filter(Boolean).length * 3, s.id).toBeLessThanOrEqual(s.cards.length);
    }
  });

  it('use plain words, not therapy words', () => {
    const texts = SEASONS.flatMap((s) => [s.name, s.theme, s.blurb, ...s.cards.flatMap((c) => [c.tag, ...cardText(c.card)])]);
    expect(texts.filter((t) => THERAPY_RE.test(t))).toEqual([]);
  });

  it('contain no banned words', () => {
    const texts = SEASONS.flatMap((s) => [s.name, s.stage, s.theme, s.blurb, ...s.cards.flatMap((c) => [c.tag, ...cardText(c.card)])]);
    expect(bannedIn(texts)).toEqual([]);
  });
});

describe('Relationship tool lists', () => {
  const lists = Object.entries(together).filter(([, v]) => Array.isArray(v)) as [string, unknown[]][];

  it('item ids are unique within each list', () => {
    for (const [name, list] of lists) {
      const items = list.filter((x): x is [string, string, string] => Array.isArray(x));
      if (items.length) expect(new Set(items.map((x) => x[0])).size, name).toBe(items.length);
    }
  });

  it('use plain words, not therapy words', () => {
    const texts: string[] = [];
    for (const [, list] of lists)
      for (const x of list) {
        if (typeof x === 'string') texts.push(x);
        else if (Array.isArray(x)) texts.push(String(x[2]));
        else if (x && typeof x === 'object') texts.push(...Object.values(x).map(String));
      }
    expect(texts.filter((t) => THERAPY_RE.test(t))).toEqual([]);
  });

  it('NEED_MENU has the five needs', () => {
    expect(together.NEED_MENU.map((n) => n.id)).toEqual(['spark', 'talk', 'fun', 'plan', 'thanks']);
  });

  it('SOFT_REPLIES and REPAIRS have the planned lengths', () => {
    expect(together.SOFT_REPLIES).toHaveLength(5);
    expect(together.REPAIRS).toHaveLength(6);
    expect(together.WHEN_HINTS).toHaveLength(6);
    expect(together.SHUKRIYA_PROMPTS).toHaveLength(12);
    expect(together.HARMFUL_SIGNS).toHaveLength(7);
    expect(together.HARD_SIGNS).toHaveLength(7);
  });

  it('contain no banned words', () => {
    const texts: string[] = [];
    for (const [, list] of lists)
      for (const x of list) {
        if (typeof x === 'string') texts.push(x);
        else if (Array.isArray(x)) texts.push(String(x[2]));
        else if (x && typeof x === 'object') texts.push(...Object.values(x).map(String));
      }
    expect(bannedIn(texts)).toEqual([]);
  });
});

describe('inclusion', () => {
  const GENDERED = /\b(he|she|him|his|her|hers|husband|wife|boyfriend|girlfriend|bride|groom|hubby|wifey)\b/i;
  // Cards that assume a life someone may not have. Each one here was reviewed and kept on purpose;
  // a new one fails until it is reviewed and added.
  const ASSUMES = /\b(your (mum|mom|dad|mother|father|parents|in-laws|job|boss|office|salary|college|wedding)|back home)\b/i;
  const REVIEWED = new Set<string>([]);

  it('no card assumes a gender', () => {
    const hits = allCards().flatMap(({ where, card }) => everyText(card).filter((t) => GENDERED.test(t)).map((t) => `${where}: ${t}`));
    expect(hits).toEqual([]);
  });

  it('cards that assume parents, a job or a wedding are reviewed', () => {
    const hits = allCards().flatMap(({ where, card }) => everyText(card).filter((t) => ASSUMES.test(t) && !REVIEWED.has(t)).map((t) => `${where}: ${t}`));
    expect(hits).toEqual([]);
  });

  it('festivals of every faith appear, not just one', () => {
    const text = allCards().flatMap(({ card }) => everyText(card)).join(' ');
    const GROUPS: Record<string, RegExp> = {
      Hindu: /\b(diwali|holi|navratri|durga puja|ganesh|pongal|onam|lohri)\b/gi,
      Muslim: /\b(eid|ramadan|ramzan|iftar|chaand raat)\b/gi,
      Sikh: /\b(gurpurab|baisakhi|vaisakhi|langar)\b/gi,
      Christian: /\b(christmas|easter)\b/gi,
      Jain: /\b(paryushan|mahavir)\b/gi,
      Parsi: /\b(navroz|nowruz)\b/gi,
      Buddhist: /\b(buddha purnima|vesak)\b/gi,
    };
    for (const [faith, re] of Object.entries(GROUPS)) expect(text.match(re)?.length ?? 0, faith).toBeGreaterThanOrEqual(2);
  });

  it('egg and non-veg appear only as tagged options, with vegetarian choices beside them', () => {
    const FOOD = /\b(chicken|mutton|lamb|fish|prawns?|egg|eggs|omelette|beef|pork|meat|keema|kebab)\b/i;
    for (const { where, card } of allCards()) {
      const opts = 'opts' in card ? card.opts : [];
      for (const o of opts) if (FOOD.test(o.l)) expect(o.diet, `${where}: ${o.l}`).toMatch(/^(egg|nonveg)$/);
      if (opts.some((o) => o.diet === 'egg' || o.diet === 'nonveg')) expect(opts.filter((o) => !o.diet).length, where).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('variety', () => {
  it('playing straight through the seasons never gives one card type three times in a row', () => {
    const order = [...Object.values(SEASON).map((s) => s.card.type), ...SEASONS.flatMap((s) => s.cards.map((c) => c.card.type))];
    for (let i = 2; i < order.length; i++) expect(order[i] === order[i - 1] && order[i] === order[i - 2], `card ${i + 1}: ${order[i]}`).toBe(false);
  });
});
