import { describe, expect, it, vi } from 'vitest';
import { fromBase64Url, toBase64Url } from './bytes';
import { buildInviteUrl, parseInviteFragment, parseJoinPath, takeInviteKeyFromLocation } from './invite';
import { generateRoomKeyBytes } from './roomKey';

describe('base64url', () => {
  it('round-trips every length', () => {
    for (let n = 0; n < 40; n++) {
      const bytes = crypto.getRandomValues(new Uint8Array(n));
      const text = toBase64Url(bytes);
      expect(text).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(fromBase64Url(text)).toEqual(bytes);
    }
  });

  it('rejects junk', () => {
    expect(fromBase64Url('abc=')).toBeNull();
    expect(fromBase64Url('ab+c')).toBeNull();
    expect(fromBase64Url('a')).toBeNull();
  });
});

describe('invite link', () => {
  it('puts the key only in the fragment', () => {
    const key = generateRoomKeyBytes();
    const url = new URL(buildInviteUrl('https://example.test', 'room-1', key));
    expect(url.pathname).toBe('/join/room-1');
    expect(url.search).toBe('');
    expect(url.href.split('#')[0]).not.toContain(toBase64Url(key));
    expect(parseInviteFragment(url.hash)).toEqual(key);
  });

  it('refuses to build links with a bad room id or key', () => {
    expect(() => buildInviteUrl('https://example.test', 'a/b', generateRoomKeyBytes())).toThrow('Invalid room id');
    expect(() => buildInviteUrl('https://example.test', 'room-1', new Uint8Array(16))).toThrow('wrong length');
  });

  it('accepts a fragment without the leading #', () => {
    const key = generateRoomKeyBytes();
    expect(parseInviteFragment('k1.' + toBase64Url(key))).toEqual(key);
  });

  it('rejects bad fragments', () => {
    expect(parseInviteFragment('')).toBeNull();
    expect(parseInviteFragment('#')).toBeNull();
    expect(parseInviteFragment('#' + toBase64Url(generateRoomKeyBytes()))).toBeNull(); // no prefix
    expect(parseInviteFragment('#k1.' + toBase64Url(new Uint8Array(16)))).toBeNull(); // short
    expect(parseInviteFragment('#k1.not*valid')).toBeNull();
  });

  it('parses join paths', () => {
    expect(parseJoinPath('/join/room-1')).toBe('room-1');
    expect(parseJoinPath('/join/room-1/')).toBe('room-1');
    expect(parseJoinPath('/join/')).toBeNull();
    expect(parseJoinPath('/join/a%7Cb')).toBeNull();
    expect(parseJoinPath('/other/room-1')).toBeNull();
  });

  it('removes the fragment from the address bar after reading it', () => {
    const key = generateRoomKeyBytes();
    const url = new URL(buildInviteUrl('https://example.test', 'room-1', key));
    const hist = { replaceState: vi.fn() };
    expect(takeInviteKeyFromLocation(url, hist)).toEqual(key);
    expect(hist.replaceState).toHaveBeenCalledWith(null, '', '/join/room-1');
  });

  it('removes an invalid fragment too', () => {
    const hist = { replaceState: vi.fn() };
    expect(takeInviteKeyFromLocation({ hash: '#junk', pathname: '/join/r', search: '' }, hist)).toBeNull();
    expect(hist.replaceState).toHaveBeenCalledOnce();
  });

  it('does nothing without a fragment', () => {
    const hist = { replaceState: vi.fn() };
    expect(takeInviteKeyFromLocation({ hash: '', pathname: '/join/r', search: '' }, hist)).toBeNull();
    expect(hist.replaceState).not.toHaveBeenCalled();
  });
});
