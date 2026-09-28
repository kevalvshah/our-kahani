import { describe, expect, it } from 'vitest';
import { voiceType } from './voice';

describe('voiceType', () => {
  it('prefers Opus, then AAC (Safari)', () => {
    expect(voiceType({ isTypeSupported: () => true })).toBe('audio/webm;codecs=opus');
    expect(voiceType({ isTypeSupported: (t) => t.startsWith('audio/mp4') })).toBe('audio/mp4;codecs=mp4a.40.2');
  });
  it('is empty when the browser cannot record', () => {
    expect(voiceType({ isTypeSupported: () => false })).toBe('');
    expect(voiceType(undefined)).toBe('');
  });
});
