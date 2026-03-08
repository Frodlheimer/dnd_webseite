import { describe, expect, it } from 'vitest';

import { rollDice } from './roll';

describe('rollDice', () => {
  it('returns correct number of rolls and totals', () => {
    const result = rollDice(
      [
        { sides: 6, qty: 3 },
        { sides: 20, qty: 2 }
      ],
      4
    );

    expect(result.rolls).toHaveLength(5);
    expect(result.specs).toEqual([
      { sides: 6, qty: 3 },
      { sides: 20, qty: 2 }
    ]);

    for (const die of result.rolls) {
      expect(die.value).toBeGreaterThanOrEqual(1);
      expect(die.value).toBeLessThanOrEqual(die.sides);
    }

    const computedTotal = result.rolls.reduce((sum, die) => sum + die.value, 0);
    expect(result.total).toBe(computedTotal);
    expect(result.totalWithModifier).toBe(computedTotal + 4);
  });

  it('drops zero-quantity specs', () => {
    const result = rollDice([
      { sides: 4, qty: 0 },
      { sides: 8, qty: 2 }
    ]);

    expect(result.specs).toEqual([{ sides: 8, qty: 2 }]);
    expect(result.rolls).toHaveLength(2);
  });
});
