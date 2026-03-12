import { describe, expect, it } from 'vitest';

import { deriveCharacter } from './deriveCharacter';
import { createEmptyCharacter } from '../model/character';

const buildBaseCharacter = () => {
  const character = createEmptyCharacter();
  character.meta.name = 'Test Hero';
  return character;
};

describe('deriveCharacter', () => {
  it('derives ability scores from point buy + background bonuses + ASI', async () => {
    const character = buildBaseCharacter();
    character.progression.classId = 'fighter';
    character.progression.level = 4;
    character.origin.mode = 'SRD_5_2_BACKGROUND';
    character.origin.backgroundBonusAssignments = {
      str: 2,
      con: 1
    };
    character.abilities.pointBuyBase = {
      str: 15,
      dex: 12,
      con: 13,
      int: 8,
      wis: 10,
      cha: 8
    };
    character.featsAndAsi.opportunities = [
      {
        level: 4,
        choice: {
          kind: 'ASI',
          increases: {
            str: 2
          }
        }
      }
    ];

    const result = await deriveCharacter(character);
    expect(result.character.derived.abilityFinal.str).toBe(19);
    expect(result.character.derived.abilityFinal.con).toBe(14);
    expect(result.character.derived.abilityMods.str).toBe(4);
    expect(result.character.derived.proficiencyBonus).toBe(2);
  });

  it('applies legacy race bonuses in legacy mode', async () => {
    const character = buildBaseCharacter();
    character.progression.classId = 'fighter';
    character.origin.mode = 'LEGACY_RACE';
    character.origin.raceId = 'srd:race-human';
    character.abilities.pointBuyBase = {
      str: 8,
      dex: 8,
      con: 8,
      int: 8,
      wis: 8,
      cha: 8
    };

    const result = await deriveCharacter(character);
    expect(result.character.derived.abilityFinal.str).toBe(9);
    expect(result.character.derived.abilityFinal.dex).toBe(9);
    expect(result.character.derived.abilityFinal.con).toBe(9);
    expect(result.character.derived.abilityFinal.int).toBe(9);
    expect(result.character.derived.abilityFinal.wis).toBe(9);
    expect(result.character.derived.abilityFinal.cha).toBe(9);
  });

  it('derives proficiency bonus by level progression', async () => {
    const character = buildBaseCharacter();
    character.progression.classId = 'fighter';
    character.progression.level = 9;

    const result = await deriveCharacter(character);
    expect(result.character.derived.proficiencyBonus).toBe(4);
  });

  it('applies feat +1 bonuses when feat supports ability increase', async () => {
    const character = buildBaseCharacter();
    character.progression.classId = 'fighter';
    character.progression.level = 4;
    character.abilities.pointBuyBase = {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10
    };
    character.featsAndAsi.opportunities = [
      {
        level: 4,
        choice: {
          kind: 'FEAT',
          featId: 'actor'
        }
      }
    ];

    const result = await deriveCharacter(character);
    expect(result.character.derived.abilityFinal.cha).toBe(11);
  });

  it('looks up spell slots and prepared spell limits for prepared casters', async () => {
    const character = buildBaseCharacter();
    character.progression.classId = 'wizard';
    character.progression.level = 5;
    character.origin.mode = 'SRD_5_2_BACKGROUND';
    character.origin.backgroundBonusAssignments = { int: 2 };
    character.abilities.pointBuyBase.int = 15;
    character.spells.selectedCantrips = ['acid-splash'];
    character.spells.selectedKnownSpells = ['magic-missile', 'mage-armor'];

    const result = await deriveCharacter(character);
    expect(result.character.derived.spellSlots).not.toBeNull();
    expect(result.character.derived.spellSlots?.[0]).toBe(4);
    expect(result.character.derived.spellSlots?.[1]).toBe(3);
    expect(result.character.derived.spellSlots?.[2]).toBe(2);
    expect(result.runtime.spellLimits.preparedMax).toBeGreaterThan(0);
  });
});

