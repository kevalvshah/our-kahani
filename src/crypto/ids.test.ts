import { describe, expect, it } from 'vitest';
import { isValidId, newId } from './ids';

describe('ids', () => {
  it('makes unique, valid ids', () => {
    const ids = new Set(Array.from({ length: 100 }, newId));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(isValidId(id)).toBe(true);
  });

  it.each(['', 'a|b', 'a:b', 'a/b', 'a b', 'é', 'x'.repeat(65)])('rejects %j', (id) => {
    expect(isValidId(id)).toBe(false);
  });
});
