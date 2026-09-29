import { describe, expect, it } from 'vitest';
import { GENTLE_CARDS } from '../content/gentle';
import { deckFor, gentleEntry, gentleRef, sharedDepth } from './gentleDeck';

describe('Gentle Corner deck', () => {
  it('goes only as deep as the lower of the two choices', () => {
    expect(sharedDepth('deep', 'personal')).toBe('personal');
    expect(sharedDepth('emotional', 'deep')).toBe('emotional');
    expect(sharedDepth(undefined, 'deep')).toBe('light');
    expect(sharedDepth('deep', undefined)).toBe('light');
  });

  it('shows lighter cards first and nothing deeper than the shared depth', () => {
    const light = deckFor('light');
    expect(light.length).toBeGreaterThanOrEqual(12);
    expect(light.every((c) => c.depth === 'light')).toBe(true);
    const deep = deckFor('deep');
    expect(deep).toHaveLength(GENTLE_CARDS.length);
    expect(deckFor('personal').some((c) => c.depth === 'emotional')).toBe(false);
  });

  it('turns a gentle ref into a card entry, and ignores anything else', () => {
    const first = GENTLE_CARDS[0]!;
    const e = gentleEntry(gentleRef(first.id))!;
    expect(e.id).toBe(`gentle:${first.id}`);
    expect(e.tag).toMatch(/Gentle Corner · /);
    expect(e.card).toBe(first.card);
    expect(gentleEntry('gentle:nope')).toBeNull();
    expect(gentleEntry('day:1')).toBeNull();
  });
});
