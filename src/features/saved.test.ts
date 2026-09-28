import { describe, expect, it } from 'vitest';
import { daysUntil, matchesSearch, untilText, upcomingSaved, type SavedItem } from './saved';

const now = new Date(2026, 4, 10, 15, 30); // 10 May 2026, afternoon, local time

const item = (over: Partial<SavedItem> = {}): SavedItem => ({
  kind: 'card',
  src: 'Day 1 · This or that',
  q: 'Chai or coffee?',
  theirs: 'Chai',
  mine: 'Coffee',
  label: 'food',
  note: '',
  date: '',
  t: 1,
  ...over,
});

describe('daysUntil', () => {
  it('counts whole days from today, ignoring the time of day', () => {
    expect(daysUntil('2026-05-10', now)).toBe(0);
    expect(daysUntil('2026-05-11', now)).toBe(1);
    expect(daysUntil('2026-05-24', now)).toBe(14);
    expect(daysUntil('2026-05-01', now)).toBe(-9);
  });
  it('ignores anything that is not a yyyy-mm-dd date', () => {
    expect(daysUntil('', now)).toBeNull();
    expect(daysUntil('10/05/2026', now)).toBeNull();
    expect(daysUntil('2026-13-45', now)).toBeNull();
  });
  it('defaults to now', () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(daysUntil(ymd)).toBe(0);
  });
});

describe('untilText', () => {
  it('reads naturally', () => {
    expect(untilText('2026-05-10', now)).toBe('today');
    expect(untilText('2026-05-11', now)).toBe('tomorrow');
    expect(untilText('2026-05-15', now)).toBe('in 5 days');
    expect(untilText('2026-05-01', now)).toBe('');
    expect(untilText('soon', now)).toBe('');
    expect(untilText('nope')).toBe('');
  });
});

describe('upcomingSaved', () => {
  it('returns the nearest date in the next two weeks', () => {
    const items = [
      item({ q: 'past', date: '2026-05-01' }),
      item({ q: 'far', date: '2026-06-30' }),
      item({ q: 'later', date: '2026-05-20' }),
      item({ q: 'soon', date: '2026-05-12' }),
      item({ q: 'none' }),
      item({ q: 'edge', date: '2026-05-24' }),
    ];
    expect(upcomingSaved(items, now)?.q).toBe('soon');
    expect(upcomingSaved([items[0]!, items[1]!, items[4]!], now)).toBeUndefined();
    expect(upcomingSaved([items[5]!], now)?.q).toBe('edge');
    expect(upcomingSaved([])).toBeUndefined();
  });
});

describe('matchesSearch', () => {
  const x = item({ note: 'Masala chai with ginger', theirs: 'Chai' });
  it('matches every field and the label name, ignoring case and spacing', () => {
    expect(matchesSearch(x, '', 'Food')).toBe(true);
    expect(matchesSearch(x, '   ', 'Food')).toBe(true);
    expect(matchesSearch(x, ' GINGER ', 'Food')).toBe(true);
    expect(matchesSearch(x, 'coffee', 'Food')).toBe(true);
    expect(matchesSearch(x, 'this or that', 'Food')).toBe(true);
    expect(matchesSearch(x, 'food', 'Food')).toBe(true);
    expect(matchesSearch(x, 'pakora', 'Food')).toBe(false);
  });
});
