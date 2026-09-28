import { describe, expect, it } from 'vitest';
import { dayOfSeason, daysLeft, type Room } from './room';

const DAY = 86_400_000;
const room = { startedAt: 0 } as Room;

describe('room days', () => {
  it('counts the season from day 1 and stops at 14', () => {
    expect(dayOfSeason(room, 0)).toBe(1);
    expect(dayOfSeason(room, DAY - 1)).toBe(1);
    expect(dayOfSeason(room, DAY)).toBe(2);
    expect(dayOfSeason(room, 40 * DAY)).toBe(14);
    expect(dayOfSeason(room, -DAY)).toBe(1);
  });

  it('counts down 28 days and never goes negative', () => {
    expect(daysLeft(room, 0)).toBe(28);
    expect(daysLeft(room, 9 * DAY)).toBe(19);
    expect(daysLeft(room, 60 * DAY)).toBe(0);
  });
});
