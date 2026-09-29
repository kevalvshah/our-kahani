import { describe, expect, it } from 'vitest';
import { regionFromLocale, safetyFooter, safetyFooterFor } from './safetyFooter';

describe('safety footer', () => {
  it.each([
    [['en-GB'], 'United Kingdom', 'Samaritans 116 123, any time'],
    [['en-US'], 'United States', '988 Suicide & Crisis Lifeline, call or text'],
    [['fr-CA'], 'Canada', '988 Suicide Crisis Helpline, call or text'],
    [['en-AU'], 'Australia', 'Lifeline 13 11 14, any time'],
    [['en_GB'], 'United Kingdom', '999 for emergencies'],
    [['hi', 'en-GB'], 'United Kingdom', '999 for emergencies'],
  ])('%j shows only the verified numbers for %s', (langs, country, line) => {
    const f = safetyFooter(langs);
    expect(f.country).toBe(country);
    expect(f.lines).toContain(line);
  });

  it.each([[['en-IN']], [['en']], [['hi']], [[]], [['en-ZA', 'en-GB']], [['xx-!!']]])(
    '%j falls back to the local emergency number and findahelpline (no guessed numbers)',
    (langs) => {
      expect(safetyFooter(langs)).toEqual({ country: null, lines: [] });
    },
  );

  it('reads regions from language tags', () => {
    expect(regionFromLocale('en-GB')).toBe('GB');
    expect(regionFromLocale('en-UK')).toBe('GB');
    expect(regionFromLocale('zh-Hant-TW')).toBe('TW');
    expect(regionFromLocale('not a tag')).toBeNull();
    expect(regionFromLocale('und')).toBeNull();
  });

  it('prefers the country chosen in the profile', () => {
    expect(safetyFooterFor('AU', ['en-GB']).country).toBe('Australia');
    expect(safetyFooterFor('IN', ['en-GB'])).toEqual({ country: null, lines: [] });
    expect(safetyFooterFor(undefined, ['en-GB']).country).toBe('United Kingdom');
  });
});
