import { describe, expect, it } from 'vitest';

import { computeFinalScores, calculatePointBuy, POINT_BUY_COST_TABLE } from './rules';
import { createAbilityMap, type AsChoice } from './types';

describe('pointBuy rules', () => {
  it('uses the exact SRD point-buy cost table', () => {
    expect(POINT_BUY_COST_TABLE).toEqual({
      8: 0,
      9: 1,
      10: 2,
      11: 3,
      12: 4,
      13: 5,
      14: 7,
      15: 9
    });
  });

  it('calculates spent and remaining points correctly', () => {
    const computation = calculatePointBuy({
      STR: 15,
      DEX: 14,
      CON: 13,
      INT: 12,
      WIS: 10,
      CHA: 8
    });

    expect(computation.spent).toBe(27);
    expect(computation.remaining).toBe(0);
    expect(computation.isValid).toBe(true);
  });

  it('validates base score range and final score cap', () => {
    const invalidBase = calculatePointBuy({
      STR: 16,
      DEX: 8,
      CON: 8,
      INT: 8,
      WIS: 8,
      CHA: 8
    });

    expect(invalidBase.isValid).toBe(false);
    expect(invalidBase.errors.some((entry) => entry.includes('between 8 and 15'))).toBe(true);

    const bonusMap = createAbilityMap(0);
    bonusMap.STR = 2;

    const choices: AsChoice[] = [
      { kind: 'ASI', plus2: 'STR' },
      { kind: 'FEAT_PLUS1', ability: 'STR' }
    ];

    const final = computeFinalScores(
      {
        STR: 19,
        DEX: 8,
        CON: 8,
        INT: 8,
        WIS: 8,
        CHA: 8
      },
      bonusMap,
      choices
    );

    expect(final.byAbility.STR.final).toBe(20);
    expect(final.errors.some((entry) => entry.includes('clamped'))).toBe(true);
  });
});
