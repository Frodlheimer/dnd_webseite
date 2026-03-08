import { describe, expect, it } from 'vitest';

import { computeLegacyRaceBonuses } from './bonuses';

describe('pointBuy bonuses', () => {
  it('applies half-elf bonuses with valid selections', () => {
    const result = computeLegacyRaceBonuses({
      raceId: 'HALF_ELF',
      halfElfPlusOneAbilities: ['DEX', 'CON'],
      humanVariantPlusOneAbilities: ['DEX', 'CON'],
      humanVariantFeatId: undefined,
      humanVariantFeatAbility: undefined,
      customBonuses: []
    });

    expect(result.errors).toHaveLength(0);
    expect(result.bonuses.CHA).toBe(2);
    expect(result.bonuses.DEX).toBe(1);
    expect(result.bonuses.CON).toBe(1);
  });

  it('rejects half-elf selections that include Charisma', () => {
    const result = computeLegacyRaceBonuses({
      raceId: 'HALF_ELF',
      halfElfPlusOneAbilities: ['CHA', 'DEX'],
      humanVariantPlusOneAbilities: ['DEX', 'CON'],
      humanVariantFeatId: undefined,
      humanVariantFeatAbility: undefined,
      customBonuses: []
    });

    expect(result.errors.some((entry) => entry.includes('other than Charisma'))).toBe(true);
  });

  it('applies human variant bonuses to two selected abilities', () => {
    const result = computeLegacyRaceBonuses({
      raceId: 'HUMAN_VARIANT',
      halfElfPlusOneAbilities: ['DEX', 'CON'],
      humanVariantPlusOneAbilities: ['STR', 'WIS'],
      humanVariantFeatId: undefined,
      humanVariantFeatAbility: undefined,
      customBonuses: []
    });

    expect(result.errors).toHaveLength(0);
    expect(result.bonuses.STR).toBe(1);
    expect(result.bonuses.WIS).toBe(1);
  });
});
