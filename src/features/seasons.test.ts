import { describe, expect, it } from 'vitest';
import { SEASONS } from '../content/seasons';
import { findSeason, refsForNeed, seasonEntry, seasonOneRefs, seasonRef, seasonRefs } from './seasons';

describe('seasons', () => {
  it('builds refs and finds cards, and ignores anything else', () => {
    const s2 = SEASONS[0]!;
    expect(seasonRef(s2.id, 0)).toBe('season:s2:1');
    const e = seasonEntry('season:s2:1')!;
    expect(e.id).toBe('season:s2:1');
    expect(e.card).toBe(s2.cards[0]!.card);
    expect(e.tag).toContain(s2.name);
    expect(seasonEntry('season:s2:999')).toBeNull();
    expect(seasonEntry('season:s9:1')).toBeNull();
    expect(seasonEntry('day:1')).toBeNull();
    expect(findSeason('s3')?.id).toBe('s3');
    expect(findSeason('nope')).toBeUndefined();
  });

  it('lists every ref of a season, and Season 1 in order', () => {
    expect(seasonRefs(SEASONS[0]!)).toHaveLength(SEASONS[0]!.cards.length);
    expect(seasonOneRefs()[0]).toBe('day:1');
    expect(seasonOneRefs()).toHaveLength(14);
  });

  it('finds cards for a need across seasons, lightest season first', () => {
    const spark = refsForNeed('spark');
    expect(spark.length).toBeGreaterThan(0);
    for (const ref of spark) expect(seasonEntry(ref)).not.toBeNull();
    const talk = refsForNeed('talk');
    expect(talk.every((r) => r.startsWith('season:'))).toBe(true);
  });
});
