import { describe, expect, it } from 'vitest';

import {
  invalidateForBackgroundChange,
  invalidateForClassChange,
  invalidateForRaceChange,
  invalidateForRulesetChange
} from './choiceResolution';
import { createEmptyCharacter } from '../model/character';

describe('choice invalidation helpers', () => {
  it('changing class invalidates subclass, spell picks, and feature choices', () => {
    const character = createEmptyCharacter();
    character.progression.classId = 'wizard';
    character.progression.subclassId = 'wizard--school-of-evocation';
    character.spells.selectedCantrips = ['acid-splash'];
    character.spells.selectedKnownSpells = ['mage-armor'];
    character.features.selectedChoices = {
      'class:fighting-style': 'defense',
      'feature:test': 'value'
    };

    const next = invalidateForClassChange(character, 'fighter');
    expect(next.progression.classId).toBe('fighter');
    expect(next.progression.subclassId).toBeNull();
    expect(next.spells.selectedCantrips).toHaveLength(0);
    expect(next.spells.selectedKnownSpells).toHaveLength(0);
    expect(Object.keys(next.features.selectedChoices)).toHaveLength(0);
  });

  it('changing race clears origin-dependent language/tool picks and legacy assignments', () => {
    const character = createEmptyCharacter();
    character.origin.raceId = 'human';
    character.origin.selectedRaceLanguages = ['Common', 'Elvish'];
    character.origin.selectedRaceToolProficiencies = ['Thieves tools'];
    character.origin.selectedBackgroundLanguages = ['Dwarvish'];
    character.origin.selectedBackgroundToolProficiencies = ['Calligrapher tools'];
    character.origin.legacyRaceBonusAssignments = { str: 1 };

    const next = invalidateForRaceChange(character, 'dwarf');
    expect(next.origin.raceId).toBe('dwarf');
    expect(next.origin.selectedRaceLanguages).toHaveLength(0);
    expect(next.origin.selectedRaceToolProficiencies).toHaveLength(0);
    expect(next.origin.selectedBackgroundLanguages).toEqual(['Dwarvish']);
    expect(next.origin.selectedBackgroundToolProficiencies).toEqual(['Calligrapher tools']);
    expect(Object.keys(next.origin.legacyRaceBonusAssignments ?? {})).toHaveLength(0);
  });

  it('changing background clears dependent language/tool choices', () => {
    const character = createEmptyCharacter();
    character.ruleset = 'DND55_2024';
    character.origin.mode = 'SRD_5_2_BACKGROUND';
    character.origin.backgroundId = 'acolyte';
    character.origin.selectedBackgroundLanguages = ['Common'];
    character.origin.selectedBackgroundToolProficiencies = ['Calligrapher tools'];
    character.origin.selectedRaceLanguages = ['Elvish'];
    character.origin.selectedRaceToolProficiencies = ['Smith tools'];
    character.origin.backgroundBonusAssignments = { wis: 2 };

    const next = invalidateForBackgroundChange(character, 'soldier');
    expect(next.origin.backgroundId).toBe('soldier');
    expect(next.origin.selectedBackgroundLanguages).toHaveLength(0);
    expect(next.origin.selectedBackgroundToolProficiencies).toHaveLength(0);
    expect(next.origin.selectedRaceLanguages).toEqual(['Elvish']);
    expect(next.origin.selectedRaceToolProficiencies).toEqual(['Smith tools']);
    expect(next.origin.backgroundBonusAssignments).toEqual({});
  });

  it('changing ruleset clears origin selections and retargets the builder mode', () => {
    const character = createEmptyCharacter();
    character.origin.raceId = 'dwarf';
    character.origin.subraceId = 'hill-dwarf';
    character.origin.backgroundId = 'soldier';
    character.origin.selectedRaceLanguages = ['Dwarvish'];
    character.origin.selectedBackgroundLanguages = ['Common'];

    const next = invalidateForRulesetChange(character, 'DND55_2024');
    expect(next.ruleset).toBe('DND55_2024');
    expect(next.origin.mode).toBe('SRD_5_2_BACKGROUND');
    expect(next.origin.raceId).toBeNull();
    expect(next.origin.subraceId).toBeNull();
    expect(next.origin.backgroundId).toBeNull();
    expect(next.origin.selectedRaceLanguages).toHaveLength(0);
    expect(next.origin.selectedBackgroundLanguages).toHaveLength(0);
  });
});
