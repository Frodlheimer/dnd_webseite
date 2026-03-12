import { describe, expect, it } from 'vitest';

import {
  invalidateForBackgroundChange,
  invalidateForClassChange,
  invalidateForRaceChange
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
    character.origin.raceId = 'lineage:custom';
    character.origin.selectedLanguages = ['Common', 'Elvish'];
    character.origin.selectedToolProficiencies = ['Thieves tools'];
    character.origin.legacyRaceBonusAssignments = { str: 1 };

    const next = invalidateForRaceChange(character, 'lineage:human');
    expect(next.origin.raceId).toBe('lineage:human');
    expect(next.origin.selectedLanguages).toHaveLength(0);
    expect(next.origin.selectedToolProficiencies).toHaveLength(0);
    expect(Object.keys(next.origin.legacyRaceBonusAssignments ?? {})).toHaveLength(0);
  });

  it('changing background clears dependent language/tool choices', () => {
    const character = createEmptyCharacter();
    character.origin.backgroundId = 'acolyte';
    character.origin.selectedLanguages = ['Common'];
    character.origin.selectedToolProficiencies = ['Calligrapher tools'];
    character.origin.backgroundBonusAssignments = { wis: 2 };

    const next = invalidateForBackgroundChange(character, 'soldier');
    expect(next.origin.backgroundId).toBe('soldier');
    expect(next.origin.selectedLanguages).toHaveLength(0);
    expect(next.origin.selectedToolProficiencies).toHaveLength(0);
    expect(next.origin.backgroundBonusAssignments).toEqual({});
  });
});

