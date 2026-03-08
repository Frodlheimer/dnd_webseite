import { describe, expect, it } from 'vitest';

import { createAbilityMap, type AsChoice } from './types';
import { computeFinalScores } from './rules';
import { buildPointBuyGuidance } from './guidance';

describe('pointBuy guidance', () => {
  it('adds class-specific warnings for unusual class priorities', () => {
    const base = {
      STR: 10,
      DEX: 14,
      CON: 14,
      INT: 10,
      WIS: 10,
      CHA: 10
    };
    const final = computeFinalScores(base, createAbilityMap(0), []);
    const hints = buildPointBuyGuidance({
      classId: 'barbarian',
      baseScores: base,
      pointRemaining: 0,
      finalComputation: final,
      classSelected: true,
      bonusMode: 'SRD_BACKGROUND',
      legacyRaceSelected: true,
      asiOpportunityCount: 0,
      unresolvedImprovementSlots: 0,
      multiclassEnabled: false,
      multiclassPrimaryClassId: 'barbarian',
      multiclassSecondaryClassId: ''
    });

    expect(hints.some((hint) => hint.id === 'class-barbarian-str')).toBe(true);
  });

  it('provides odd-score efficiency hints', () => {
    const base = {
      STR: 13,
      DEX: 14,
      CON: 14,
      INT: 10,
      WIS: 10,
      CHA: 8
    };
    const final = computeFinalScores(base, createAbilityMap(0), []);
    const hints = buildPointBuyGuidance({
      classId: 'fighter',
      baseScores: base,
      pointRemaining: 0,
      finalComputation: final,
      classSelected: true,
      bonusMode: 'SRD_BACKGROUND',
      legacyRaceSelected: true,
      asiOpportunityCount: 0,
      unresolvedImprovementSlots: 0,
      multiclassEnabled: false,
      multiclassPrimaryClassId: 'fighter',
      multiclassSecondaryClassId: ''
    });

    expect(hints.some((hint) => hint.id === 'efficiency-odd-STR')).toBe(true);
  });

  it('reports final-cap overflows with source context', () => {
    const base = {
      STR: 19,
      DEX: 8,
      CON: 8,
      INT: 8,
      WIS: 8,
      CHA: 8
    };
    const bonus = createAbilityMap(0);
    bonus.STR = 2;
    const choices: AsChoice[] = [
      { kind: 'ASI', plus2: 'STR' },
      { kind: 'FEAT_PLUS1', ability: 'STR' }
    ];
    const final = computeFinalScores(base, bonus, choices);
    const hints = buildPointBuyGuidance({
      classId: 'fighter',
      baseScores: base,
      pointRemaining: 0,
      finalComputation: final,
      classSelected: true,
      bonusMode: 'SRD_BACKGROUND',
      legacyRaceSelected: true,
      asiOpportunityCount: 0,
      unresolvedImprovementSlots: 0,
      multiclassEnabled: false,
      multiclassPrimaryClassId: 'fighter',
      multiclassSecondaryClassId: ''
    });

    expect(hints.some((hint) => hint.id === 'cap-STR')).toBe(true);
  });

  it('does not warn about odd score when final score is even after bonuses', () => {
    const base = {
      STR: 15,
      DEX: 14,
      CON: 14,
      INT: 10,
      WIS: 10,
      CHA: 8
    };
    const bonus = createAbilityMap(0);
    bonus.STR = 1;
    const final = computeFinalScores(base, bonus, []);
    const hints = buildPointBuyGuidance({
      classId: 'fighter',
      baseScores: base,
      pointRemaining: 0,
      finalComputation: final,
      classSelected: true,
      bonusMode: 'SRD_BACKGROUND',
      legacyRaceSelected: true,
      asiOpportunityCount: 0,
      unresolvedImprovementSlots: 0,
      multiclassEnabled: false,
      multiclassPrimaryClassId: 'fighter',
      multiclassSecondaryClassId: ''
    });

    expect(hints.some((hint) => hint.id === 'efficiency-odd-STR')).toBe(false);
  });

  it('adds setup warnings for missing class, race, and unresolved ASI/Feat choices', () => {
    const base = {
      STR: 10,
      DEX: 10,
      CON: 10,
      INT: 10,
      WIS: 10,
      CHA: 10
    };
    const final = computeFinalScores(base, createAbilityMap(0), []);
    const hints = buildPointBuyGuidance({
      classId: '',
      baseScores: base,
      pointRemaining: 0,
      finalComputation: final,
      classSelected: false,
      bonusMode: 'LEGACY_RACE',
      legacyRaceSelected: false,
      asiOpportunityCount: 2,
      unresolvedImprovementSlots: 2,
      multiclassEnabled: false,
      multiclassPrimaryClassId: '',
      multiclassSecondaryClassId: ''
    });

    expect(hints.some((hint) => hint.id === 'setup-class-missing')).toBe(true);
    expect(hints.some((hint) => hint.id === 'setup-race-missing')).toBe(true);
    expect(hints.some((hint) => hint.id === 'setup-asi-feat-missing')).toBe(true);
  });

  it('adds multiclass requirement warning when class requirements are not met', () => {
    const base = {
      STR: 8,
      DEX: 10,
      CON: 12,
      INT: 10,
      WIS: 12,
      CHA: 10
    };
    const final = computeFinalScores(base, createAbilityMap(0), []);
    const hints = buildPointBuyGuidance({
      classId: 'cleric',
      baseScores: base,
      pointRemaining: 0,
      finalComputation: final,
      classSelected: true,
      bonusMode: 'SRD_BACKGROUND',
      legacyRaceSelected: true,
      asiOpportunityCount: 0,
      unresolvedImprovementSlots: 0,
      multiclassEnabled: true,
      multiclassPrimaryClassId: 'cleric',
      multiclassSecondaryClassId: 'wizard'
    });

    expect(hints.some((hint) => hint.id === 'multiclass-primary-requirement')).toBe(true);
  });

  it('adds constitution guidance when constitution is below typical range', () => {
    const base = {
      STR: 10,
      DEX: 14,
      CON: 10,
      INT: 10,
      WIS: 10,
      CHA: 10
    };
    const final = computeFinalScores(base, createAbilityMap(0), []);
    const hints = buildPointBuyGuidance({
      classId: 'fighter',
      baseScores: base,
      pointRemaining: 0,
      finalComputation: final,
      classSelected: true,
      bonusMode: 'SRD_BACKGROUND',
      legacyRaceSelected: true,
      asiOpportunityCount: 0,
      unresolvedImprovementSlots: 0,
      multiclassEnabled: false,
      multiclassPrimaryClassId: 'fighter',
      multiclassSecondaryClassId: ''
    });

    expect(hints.some((hint) => hint.id === 'efficiency-con-low')).toBe(true);
  });
});
