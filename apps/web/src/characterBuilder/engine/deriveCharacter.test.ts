import { describe, expect, it } from 'vitest';

import { deriveCharacter } from './deriveCharacter';
import { createEmptyCharacter } from '../model/character';
import { installPublicFetchMock } from '../../test/mockPublicFetch';

installPublicFetchMock();

const buildBaseCharacter = () => {
  const character = createEmptyCharacter();
  character.meta.name = 'Test Hero';
  return character;
};

describe('deriveCharacter', () => {
  it('derives ability scores from point buy + race bonuses + ASI', async () => {
    const character = buildBaseCharacter();
    character.progression.classId = 'fighter';
    character.progression.level = 4;
    character.origin.raceId = 'human';
    character.origin.backgroundId = 'soldier';
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
    expect(result.character.derived.abilityFinal.str).toBe(18);
    expect(result.character.derived.abilityFinal.con).toBe(14);
    expect(result.character.derived.abilityMods.str).toBe(4);
    expect(result.character.derived.proficiencyBonus).toBe(2);
  });

  it('applies DnD5e race bonuses in the default ruleset', async () => {
    const character = buildBaseCharacter();
    character.progression.classId = 'fighter';
    character.origin.raceId = 'human';
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

  it('applies selectable legacy race bonuses from structured race data', async () => {
    const character = buildBaseCharacter();
    character.progression.classId = 'fighter';
    character.origin.raceId = 'half-elf';
    character.origin.backgroundId = 'soldier';
    character.abilities.pointBuyBase = {
      str: 8,
      dex: 10,
      con: 12,
      int: 8,
      wis: 8,
      cha: 10
    };
    character.origin.legacyRaceBonusAssignments = {
      dex: 1,
      con: 1
    };

    const result = await deriveCharacter(character);
    expect(result.character.derived.abilityFinal.cha).toBe(12);
    expect(result.character.derived.abilityFinal.dex).toBe(11);
    expect(result.character.derived.abilityFinal.con).toBe(13);
    expect(result.character.validation.pendingDecisions.map((decision) => decision.id)).not.toContain(
      'choose-race-ability-bonuses'
    );
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
    character.origin.raceId = 'human';
    character.origin.backgroundId = 'sage';
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

  it('applies structured background proficiencies, equipment, and feature text', async () => {
    const character = buildBaseCharacter();
    character.progression.classId = 'fighter';
    character.origin.raceId = 'human';
    character.origin.backgroundId = 'criminal';
    character.origin.selectedBackgroundToolProficiencies = ['Playing card set'];

    const result = await deriveCharacter(character);

    expect(result.character.proficiencies.skills).toEqual(
      expect.arrayContaining(['Deception', 'Stealth'])
    );
    expect(result.character.proficiencies.tools).toEqual(
      expect.arrayContaining(["Thieves' tools", 'Playing card set'])
    );
    expect(result.character.equipment.items.map((item) => item.name)).toEqual(
      expect.arrayContaining(['crowbar', 'set of dark common clothes including a hood'])
    );
    expect(result.character.derived.backgroundFeatureName).toBe('Criminal Contact');
    expect(result.character.derived.backgroundFeatureText).toContain('reliable and trustworthy contact');
    expect(
      result.character.features.autoGranted.some((feature) => feature.id === 'Criminal Contact')
    ).toBe(true);
  });

  it('marks DnD5.5 as unavailable in the guided builder flow', async () => {
    const character = buildBaseCharacter();
    character.ruleset = 'DND55_2024';

    const result = await deriveCharacter(character);
    expect(result.character.status).toBe('invalid');
    expect(result.character.validation.pendingDecisions).toHaveLength(0);
    expect(result.character.validation.errors.some((issue) => issue.section === 'Rule Set')).toBe(true);
  });
});
