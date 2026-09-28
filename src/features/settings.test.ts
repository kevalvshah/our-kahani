import { describe, expect, it } from 'vitest';
import { currentSettings, DEFAULT_SETTINGS, waitsForPartner } from './settings';

describe('room settings', () => {
  it('defaults to the invited person answering first', () => {
    expect(currentSettings([])).toEqual(DEFAULT_SETTINGS);
  });
  it('takes the latest change from either person', () => {
    expect(currentSettings([{ data: { inviteeFirst: false }, createdAt: 2 }, { data: { inviteeFirst: true }, createdAt: 1 }]).inviteeFirst).toBe(false);
    expect(currentSettings([{ data: { inviteeFirst: false }, createdAt: 1 }, { data: { inviteeFirst: true }, createdAt: 2 }]).inviteeFirst).toBe(true);
  });
  it('only holds the creator back, until the partner answers', () => {
    const on = { inviteeFirst: true };
    expect(waitsForPartner(on, 'creator', 'choice', false, false)).toBe(true);
    expect(waitsForPartner(on, 'creator', 'choice', false, true)).toBe(false);
    expect(waitsForPartner(on, 'creator', 'choice', true, false)).toBe(false);
    expect(waitsForPartner(on, 'invitee', 'choice', false, false)).toBe(false);
    expect(waitsForPartner(on, 'creator', 'bet', false, false)).toBe(false);
    expect(waitsForPartner({ inviteeFirst: false }, 'creator', 'choice', false, false)).toBe(false);
  });
});
