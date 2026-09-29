import { describe, expect, it } from 'vitest';
import { PACKS, SEASON } from '../content/cards';
import { K } from '../data/kinds';
import type { RoomData } from '../data/RoomData';
import type { DataRecord } from '../state/controller';
import { DAY_MS, SEASON_DAYS, type Room } from '../state/room';
import { doneByMe, entryFor, firstWaiting, nextCardFor,
  keepPlaying,
  firstPackCard, packProgress, seasonDone, unlockedDays } from './progress';

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
  it('moves to the next unfinished card in a pack', () => {
    const d = fake([ans('pack:garba:2', { pick: 'bold' })]);
    expect(nextCardFor(d, entryFor('pack:garba:1')!)).toBe('pack:garba:3');
    const last = PACKS.find((p) => p.id === 'garba')!.cards.length;
    // At the end of a pack, play carries on (never stops early).
    const after = nextCardFor(d, entryFor(`pack:garba:${last}`)!);
    expect(after).not.toBeNull();
    expect(after).not.toBe(`pack:garba:${last}`);
  });
  it('moves to the next waiting season card, not the same one', () => {
    const firstPack = `pack:${PACKS[0]!.id}:1`;
    expect(nextCardFor(fake([], 2), entryFor('day:1')!)).toBe('day:2');
    expect(nextCardFor(fake([ans('day:1', { pick: 'chai' })], 2), entryFor('day:1')!)).toBe('day:2');
    expect(nextCardFor(fake(allSeason()), entryFor('day:14')!)).toBe(firstPack);
  });
  it('keeps playing through the packs after today, and says so when there is nothing left', () => {
    const firstPack = `pack:${PACKS[0]!.id}:1`;
    const doneToday = fake(allSeason(), 1);
    expect(keepPlaying(doneToday)).toBe(firstPack);
    expect(keepPlaying(doneToday, firstPack)).toBeNull();
    expect(firstPackCard(doneToday)).toBe(firstPack);
    // Every pack card answered: nothing left to carry on to.
    const all = PACKS.flatMap((p) =>
      p.cards.map((c, i) => ans(`pack:${p.id}:${i + 1}`, { pick: 'a', picks: ['a'], text: 'a', rates: c.type === 'try' ? Object.fromEntries(c.items.map((it) => [it.id, 'keen'])) : {} })),
    );
    expect(firstPackCard(fake(all))).toBeNull();
    expect(keepPlaying(fake([...allSeason(), ...all]))).toBeNull();
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
