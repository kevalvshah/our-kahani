import { describe, expect, it } from 'vitest';
import { PATHS, routeFromPath } from './router';

describe('routes', () => {
  it('maps every path back to its screen', () => {
    for (const [route, path] of Object.entries(PATHS)) expect(routeFromPath(path)).toBe(route);
  });

  it('handles trailing slashes, joins and unknown paths', () => {
    expect(routeFromPath('/packs/')).toBe('packs');
    expect(routeFromPath('/join/abc')).toBe('join');
    expect(routeFromPath('/nope')).toBe('today');
    expect(routeFromPath('')).toBe('today');
  });
});
