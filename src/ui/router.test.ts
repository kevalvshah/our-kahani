import { describe, expect, it } from 'vitest';
import { cardPath, packPath, PATHS, routeFromPath } from './router';

describe('routes', () => {
  it('maps every path back to its screen', () => {
    for (const [route, path] of Object.entries(PATHS)) expect(routeFromPath(path).name).toBe(route);
  });

  it('handles trailing slashes, joins and unknown paths', () => {
    expect(routeFromPath('/packs/').name).toBe('packs');
    expect(routeFromPath('/join/abc').name).toBe('join');
    expect(routeFromPath('/nope').name).toBe('today');
    expect(routeFromPath('').name).toBe('today');
  });

  it('round-trips card refs and pack ids', () => {
    for (const ref of ['day:3', 'pack:warm:2', 'bonus:1f2e3d4c-aaaa-bbbb-cccc-000000000000']) {
      expect(routeFromPath(cardPath(ref))).toEqual({ name: 'card', ref });
    }
    expect(routeFromPath(packPath('warm'))).toEqual({ name: 'pack', id: 'warm' });
  });

  it('rejects card refs that are not plain ids', () => {
    expect(routeFromPath('/card/%3Cscript%3E').name).toBe('today');
  });
});
