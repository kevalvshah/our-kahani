import { describe, expect, it } from 'vitest';
import { PAUSE_MS, pauseLeft, SAFETY_NOTE, weekKey } from './together';

describe('together helpers', () => {
  it('gives ISO weeks, including across the year boundary', () => {
    expect(weekKey(Date.UTC(2026, 8, 28))).toBe('2026-W40');
    expect(weekKey(Date.UTC(2026, 8, 29))).toBe('2026-W40');
    expect(weekKey(Date.UTC(2026, 9, 5))).toBe('2026-W41');
    expect(weekKey(Date.UTC(2021, 0, 1))).toBe('2020-W53');
    expect(weekKey(Date.UTC(2024, 11, 30))).toBe('2025-W01');
  });
  it('counts down a pause in whole minutes', () => {
    const now = 1_000_000;
    expect(pauseLeft(undefined, now)).toBe(0);
    expect(pauseLeft(now - 1, now)).toBe(0);
    expect(pauseLeft(now + PAUSE_MS, now)).toBe(20);
    expect(pauseLeft(now + 61_000, now)).toBe(2);
  });
  it('says plainly that leaving harm is not failing', () => {
    expect(SAFETY_NOTE).toMatch(/leaving is not failing/);
  });
});
