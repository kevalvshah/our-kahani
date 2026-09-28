import { describe, expect, it } from 'vitest';
import { applyLook, DEFAULT_LOOK, loadLook, lookAttributes, sanitizeLook, saveLook } from './look';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe('look settings', () => {
  it('round-trips through storage', () => {
    const s = memoryStorage();
    saveLook({ ...DEFAULT_LOOK, theme: 'dark', accent: 'neel', text: 'large', motion: 'calm' }, s);
    expect(loadLook(s)).toEqual({ ...DEFAULT_LOOK, theme: 'dark', accent: 'neel', text: 'large', motion: 'calm' });
  });

  it('drops unknown keys and values, so storage cannot inject anything', () => {
    expect(sanitizeLook({ accent: 'url(evil)', text: 'huge', theme: 'dark', extra: '<script>' })).toEqual({
      ...DEFAULT_LOOK,
      theme: 'dark',
    });
    expect(sanitizeLook(null)).toEqual(DEFAULT_LOOK);
    expect(sanitizeLook('dark')).toEqual(DEFAULT_LOOK);
  });

  it('falls back to defaults on broken or blocked storage', () => {
    expect(loadLook({ getItem: () => '{not json' })).toEqual(DEFAULT_LOOK);
    expect(loadLook({ getItem: () => { throw new Error('blocked'); } })).toEqual(DEFAULT_LOOK);
    expect(loadLook({ getItem: () => null })).toEqual(DEFAULT_LOOK);
    expect(loadLook(undefined)).toEqual(DEFAULT_LOOK);
    expect(() => saveLook(DEFAULT_LOOK, { setItem: () => { throw new Error('full'); } })).not.toThrow();
    expect(() => saveLook(DEFAULT_LOOK, undefined)).not.toThrow();
  });

  it('uses the default storage when none is passed', () => {
    expect(loadLook()).toEqual(DEFAULT_LOOK);
    expect(() => saveLook(DEFAULT_LOOK)).not.toThrow();
  });

  it('leaves attributes off for defaults and phone-following settings', () => {
    expect(lookAttributes(DEFAULT_LOOK)).toEqual({
      'data-k-theme': null,
      'data-k-accent': null,
      'data-k-text': null,
      'data-k-motion': null,
      'data-k-texture': null,
      'data-k-emoji': null,
    });
    expect(
      lookAttributes({ theme: 'light', accent: 'kumkum', text: 'small', motion: 'playful', texture: 'plain', emoji: 'off' }),
    ).toEqual({
      'data-k-theme': 'light',
      'data-k-accent': 'kumkum',
      'data-k-text': 'small',
      'data-k-motion': 'playful',
      'data-k-texture': 'plain',
      'data-k-emoji': 'off',
    });
  });

  it('sets and clears attributes on the root', () => {
    const attrs = new Map<string, string>([['data-k-theme', 'dark']]);
    const root = {
      setAttribute: (n: string, v: string) => void attrs.set(n, v),
      removeAttribute: (n: string) => void attrs.delete(n),
    } as unknown as Element;
    applyLook({ ...DEFAULT_LOOK, accent: 'marigold' }, root);
    expect(Object.fromEntries(attrs)).toEqual({ 'data-k-accent': 'marigold' });
  });
});

describe('look settings with storage blocked entirely', () => {
  it('still works when reading localStorage itself throws', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(loadLook()).toEqual(DEFAULT_LOOK);
      expect(() => saveLook(DEFAULT_LOOK)).not.toThrow();
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});
