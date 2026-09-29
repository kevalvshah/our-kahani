import { describe, expect, it } from 'vitest';
import { PACKS, SEASON } from '../content/cards';
import { SEASONS } from '../content/seasons';
import { K } from '../data/kinds';
import type { RoomData } from '../data/RoomData';
import type { DataRecord } from '../state/controller';
import { DAY_MS, SEASON_DAYS, type Room } from '../state/room';
import { doneByMe, entryFor, firstWaiting, nextCardFor,
  keepPlaying,
  firstPackCard,
  firstSeasonCard,
  seasonProgress, packProgress, seasonDone, unlockedDays } from './progress';

const NOW = Date.now();

function fake(records: Omit<DataRecord, 'id' | 'createdAt'>[], day = 1): RoomData {
  const recs = records.map((r, i) => ({ ...r, id: `id${i}`, createdAt: i }));
  const room = { id: 'r', startedAt: NOW - (day - 1) * DAY_MS - 1000, endsAt: NOW + DAY_MS } as Room;
  const find = (kind: number, ref: string, mine: boolean) => recs.find((r) => r.kind === kind && r.ref === ref && r.mine === mine);
  return {
    room,
    records: recs,
    mine: (kind: number, ref: string) => find(kind, ref, true),
    theirs: (kind: number, ref: string) => find(kind, ref, false),
    list: (kind: number) => recs.filter((r) => r.kind === kind),
  } as unknown as RoomData;
}

const ans = (ref: string, data: unknown, mine = true) => ({ kind: K.ANSWER, ref, mine, data });

describe('doneByMe', () => {
  it('uses the answer for answer cards', () => {
    expect(doneByMe(fake([ans('day:1', { pick: 'chai' })]), 'day:1')).toBe(true);
    expect(doneByMe(fake([ans('day:1', { pick: 'chai' }, false)]), 'day:1')).toBe(false);
    expect(doneByMe(fake([ans('day:1', {})]), 'day:1')).toBe(false);
  });
  it('uses the noticed and bug records for those cards', () => {
    expect(doneByMe(fake([]), 'day:5')).toBe(false);
    expect(doneByMe(fake([{ kind: K.NOTICED, ref: 'day:5', mine: true, data: {} }]), 'day:5')).toBe(true);
    expect(doneByMe(fake([]), 'day:7')).toBe(false);
    expect(doneByMe(fake([{ kind: K.BUG, ref: 'day:7', mine: true, data: {} }]), 'day:7')).toBe(true);
  });
  it('finds bonus cards in room data, and is false for unknown refs', () => {
    const bonus = { kind: K.BONUS_CARD, ref: 'bonus:1', mine: false, data: { kind: 'nhie', q: 'q' } };
    expect(doneByMe(fake([bonus]), 'bonus:1')).toBe(false);
    expect(doneByMe(fake([bonus, ans('bonus:1', { pick: 'have' })]), 'bonus:1')).toBe(true);
    expect(doneByMe(fake([]), 'bonus:missing')).toBe(false);
    expect(doneByMe(fake([]), 'nope')).toBe(false);
  });
});

/** Every season card done by me (answers, plus the noticed and bug cards). */
function allSeason() {
  return Object.entries(SEASON).map(([n, s]) =>
    s.card.type === 'noticed'
      ? { kind: K.NOTICED, ref: `day:${n}`, mine: true, data: {} }
      : s.card.type === 'bug'
        ? { kind: K.BUG, ref: `day:${n}`, mine: true, data: {} }
        : ans(`day:${n}`, { pick: 'a', picks: ['a'], text: 'a', rates: s.card.type === 'try' ? Object.fromEntries(s.card.items.map((it) => [it.id, 'keen'])) : {} }),
  );
}

/** Every card in Seasons 2-5 answered. */
function allLater() {
  return SEASONS.flatMap((s) =>
    s.cards.map((c, i) => ans(`season:${s.id}:${i + 1}`, { pick: 'a', picks: ['a'], text: 'a', rates: c.card.type === 'try' ? Object.fromEntries(c.card.items.map((it) => [it.id, 'keen'])) : {} })),
  );
}

describe('unlockedDays', () => {
  it('opens every season card from the start: couples go at their own pace', () => {
    const all = Array.from({ length: SEASON_DAYS }, (_, i) => i + 1);
    expect(unlockedDays(fake([], 1))).toEqual(all);
    expect(unlockedDays()).toEqual(all);
  });
});

describe('firstWaiting', () => {
  it('is the first unlocked day not yet done', () => {
    expect(firstWaiting(fake([], 3))).toBe('day:1');
    expect(firstWaiting(fake([ans('day:1', { pick: 'chai' })], 3))).toBe('day:2');
  });
  it('then bonus cards from the partner, never my own', () => {
    const d1 = ans('day:1', { pick: 'chai' });
    const mineBonus = { kind: K.BONUS_CARD, ref: 'bonus:m', mine: true, data: { kind: 'nhie', q: 'q' } };
    const theirBonus = { kind: K.BONUS_CARD, ref: 'bonus:t', mine: false, data: { kind: 'choice', q: 'q' } };
    expect(firstWaiting(fake([d1, mineBonus, theirBonus], 1))).toBe('day:2');
    const season = allSeason();
    expect(firstWaiting(fake([...season, mineBonus, theirBonus], 1))).toBe('bonus:t');
    expect(firstWaiting(fake([...season, mineBonus, theirBonus, ans('bonus:t', { pick: 'a' })], 1))).toBeNull();
  });
});

describe('nextCardFor', () => {
  it('from a pack card, Season 1 still comes first', () => {
    const d = fake([ans('pack:garba:2', { pick: 'bold' })]);
    expect(nextCardFor(d, entryFor('pack:garba:1')!)).toBe('day:1');
  });
  it('moves to the next waiting season card, not the same one', () => {
    expect(nextCardFor(fake([], 2), entryFor('day:1')!)).toBe('day:2');
    expect(nextCardFor(fake([ans('day:1', { pick: 'chai' })], 2), entryFor('day:1')!)).toBe('day:2');
    expect(nextCardFor(fake(allSeason()), entryFor('day:14')!)).toBe('season:s2:1');
    expect(nextCardFor(fake([...allSeason(), ...allLater()]), entryFor('day:14')!)).toMatch(/^pack:/);
  });
  it('after the seasons, packs are mixed: never the same pack twice, never one type three times in a row', () => {
    const records = [...allSeason(), ...allLater()];
    const played: string[] = [];
    let after: string | undefined;
    for (let i = 0; i < 40; i++) {
      const next = keepPlaying(fake(records), after);
      expect(next).toMatch(/^pack:/);
      played.push(next!);
      records.push(ans(next!, { pick: 'a', picks: ['a'], text: 'a' }));
      after = next!;
    }
    const packs = played.map((r) => r.split(':')[1]);
    const types = played.map((r) => entryFor(r)!.card.type);
    for (let i = 1; i < played.length; i++) expect(packs[i], `step ${i}`).not.toBe(packs[i - 1]);
    for (let i = 2; i < played.length; i++) expect(types[i] === types[i - 1] && types[i] === types[i - 2], `step ${i}: ${types[i]}`).toBe(false);
    expect(new Set(packs).size).toBeGreaterThanOrEqual(10);
  });
  it('the mix is the same on both phones, and different between rooms', () => {
    const records = [...allSeason(), ...allLater()];
    const a = keepPlaying(fake(records));
    expect(keepPlaying(fake(records))).toBe(a);
    const other = { ...fake(records), room: { ...fake(records).room, id: 'another-room' } } as RoomData;
    const firsts = new Set(['r', 'another-room', 'x1', 'x2', 'x3'].map((id) => keepPlaying({ ...other, room: { ...other.room, id } } as RoomData)));
    expect(firsts.size).toBeGreaterThan(1);
  });
  it('keeps playing through the packs, and says so when there is nothing left', () => {
    const doneToday = fake([...allSeason(), ...allLater()], 1);
    expect(keepPlaying(fake(allSeason(), 1))).toBe('season:s2:1');
    expect(firstSeasonCard(fake(allSeason(), 1), 'season:s2:1')).toBe('season:s2:2');
    expect(firstPackCard(doneToday)).toBe(`pack:${PACKS[0]!.id}:1`);
    // Every pack card answered: nothing left to carry on to.
    const all = PACKS.flatMap((p) =>
      p.cards.map((c, i) => ans(`pack:${p.id}:${i + 1}`, { pick: 'a', picks: ['a'], text: 'a', rates: c.type === 'try' ? Object.fromEntries(c.items.map((it) => [it.id, 'keen'])) : {} })),
    );
    expect(firstPackCard(fake(all))).toBeNull();
    expect(keepPlaying(fake([...allSeason(), ...allLater(), ...all]))).toBeNull();
    // One card left in one pack: offered even straight after a card from that pack.
    const lastOne = all.filter((r) => r.ref !== 'pack:garba:2');
    expect(keepPlaying(fake([...allSeason(), ...allLater(), ...lastOne]), 'pack:garba:1')).toBe('pack:garba:2');
    expect(firstSeasonCard(doneToday)).toBeNull();
    expect(seasonProgress(doneToday, 's1')).toEqual({ done: SEASON_DAYS, total: SEASON_DAYS });
    expect(seasonProgress(fake([]), 's2')).toEqual({ done: 0, total: SEASONS[0]!.cards.length });
    expect(seasonProgress(fake([]), 'nope')).toEqual({ done: 0, total: 0 });
  });
});

describe('packProgress and seasonDone', () => {
  it('counts what is done', () => {
    const d = fake([ans('pack:garba:1', { pick: 'garba' }), ans('pack:garba:4', { picks: ['food'] }), ans('day:1', { pick: 'chai' }), ans('day:3', { skip: true })]);
    expect(packProgress(d, 'garba')).toEqual({ done: 2, total: PACKS.find((p) => p.id === 'garba')!.cards.length });
    expect(packProgress(d, 'nope')).toEqual({ done: 0, total: 0 });
    expect(seasonDone(d)).toBe(2);
    expect(Object.keys(SEASON)).toHaveLength(SEASON_DAYS);
  });
});
