import { describe, expect, it } from 'vitest';
import { K } from '../data/kinds';
import { areaOfRef, badges, newlyWaiting, newSince, waitingCounts, waitingRefs, type Rec } from './activity';

const rec = (kind: number, createdAt: number, mine = false, data: unknown = {}, ref = 'r'): Rec => ({ kind, ref, mine, createdAt, data });

describe('activity', () => {
  it('groups the partner’s new records into short lines, ignoring mine and old ones', () => {
    const items = newSince(
      [rec(K.PHOTO, 5), rec(K.PHOTO, 6), rec(K.PHOTO, 7, true), rec(K.PHOTO, 1), rec(K.PING, 8), rec(K.PROFILE, 9), rec(K.SAVED, 9)],
      2,
      'Ravi',
    );
    expect(items).toEqual([
      { area: 'photo', count: 2, text: 'Ravi shared 2 photos 📷' },
      { area: 'today', count: 1, text: 'Ravi is thinking of you 💭' },
    ]);
    expect(newSince([rec(K.NOTICED, 5), rec(K.NOTICED, 6)], 0, 'Ravi')[0]!.text).toBe('Ravi noticed something about you 🔎');
  });

  it('turns a Gentle Corner opt-in into an invite, but not an opt-out', () => {
    expect(newSince([rec(K.GENTLE_OPT, 5, false, { on: true })], 0, 'Ravi')).toEqual([{ area: 'gentle', count: 1, text: 'Ravi invited you to Gentle Corner 💛' }]);
    expect(newSince([rec(K.GENTLE_OPT, 5, false, { on: false }), rec(K.GENTLE_OPT, 6, false, null)], 0, 'Ravi')).toEqual([]);
  });

  it('finds cards the partner answered that are waiting on me', () => {
    const status = [
      { kind: 1, ref: 'day:1', mine: false },
      { kind: 1, ref: 'day:1', mine: true },
      { kind: 1, ref: 'day:2', mine: false },
      { kind: 1, ref: 'pack:warm:3', mine: false },
      { kind: 1, ref: 'gentle:g-light-1', mine: false },
      { kind: 2, ref: 'movie:1', mine: false },
      { kind: 50, ref: 'capsule', mine: false },
    ];
    const refs = waitingRefs(status);
    expect(refs.sort()).toEqual(['day:2', 'gentle:g-light-1', 'movie:1', 'pack:warm:3']);
    expect(waitingCounts([...refs, 'other'])).toEqual({ areas: { today: 1, packs: 1, gentle: 1, movie: 1 }, packs: { warm: 1 } });
  });

  it('maps refs to areas', () => {
    expect(areaOfRef('bonus:x')).toBe('today');
    expect(areaOfRef('pack:warm:1')).toBe('packs');
    expect(areaOfRef('movie:3')).toBe('movie');
    expect(areaOfRef('song:1')).toBeNull();
  });

  it('says which cards became my turn since last time', () => {
    expect(newlyWaiting(['day:1', 'day:2', 'gentle:g'], ['day:1'], 'Ravi')).toEqual([
      { area: 'today', count: 1, text: 'Ravi answered a card · your turn' },
      { area: 'gentle', count: 1, text: 'Ravi answered a Gentle Corner card · your turn 💛' },
    ]);
    expect(newlyWaiting(['pack:a:1', 'pack:a:2', 'gentle:a', 'gentle:b'], [], 'Ravi').map((i) => i.text)).toEqual([
      'Ravi answered 2 cards · your turn',
      'Ravi answered 2 Gentle Corner cards · your turn 💛',
    ]);
    expect(newlyWaiting(['day:1'], ['day:1'], 'Ravi')).toEqual([]);
  });

  it('counts new things per area since that area was opened, plus waiting cards', () => {
    const records = [rec(K.PHOTO, 5), rec(K.ANTAKSHARI, 6), rec(K.ANTAKSHARI, 7)];
    expect(badges(records, { photo: 10, antakshari: 6 }, { today: 2 }, 'Ravi')).toEqual({ today: 2, antakshari: 1 });
    expect(badges(records, {}, {}, 'Ravi')).toEqual({ photo: 1, antakshari: 2 });
  });
});
