import { describe, expect, it } from 'vitest';

import { randomIntInclusive } from './rng';

describe('rng', () => {
  it('randomIntInclusive always returns values within range', () => {
    for (let index = 0; index < 2_000; index += 1) {
      const value = randomIntInclusive(1, 20);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(20);
    }
  });

  it('supports identical bounds', () => {
    expect(randomIntInclusive(7, 7)).toBe(7);
  });
});
