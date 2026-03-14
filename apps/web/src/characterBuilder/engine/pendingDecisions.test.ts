import { describe, expect, it } from 'vitest';

import { deriveCharacter } from './deriveCharacter';
import { createEmptyCharacter } from '../model/character';
import { installPublicFetchMock } from '../../test/mockPublicFetch';

installPublicFetchMock();

const getDecisionIds = (character: Awaited<ReturnType<typeof deriveCharacter>>['character']) => {
  return character.validation.pendingDecisions.map((decision) => decision.id);
};

describe('pending decisions from deriveCharacter', () => {
  it('shows subclass decision at the correct class level', async () => {
    const character = createEmptyCharacter();
    character.progression.classId = 'fighter';
    character.progression.level = 3;
    character.origin.raceId = 'human';
    character.origin.backgroundId = 'acolyte';

    const result = await deriveCharacter(character);
    expect(getDecisionIds(result.character)).toContain('choose-subclass');
  });

  it('shows class skill decision when required picks are missing', async () => {
    const character = createEmptyCharacter();
    character.progression.classId = 'fighter';
    character.origin.raceId = 'human';
    character.origin.backgroundId = 'acolyte';
    character.proficiencies.skills = [];

    const result = await deriveCharacter(character);
    expect(getDecisionIds(result.character)).toContain('choose-class-skills');
  });

  it('auto-adds granted subclass spells when available in rules data', async () => {
    const character = createEmptyCharacter();
    character.progression.classId = 'druid';
    character.progression.subclassId = 'druid--circle-of-wildfire';
    character.progression.level = 3;
    character.origin.raceId = 'human';
    character.origin.backgroundId = 'acolyte';

    const result = await deriveCharacter(character);
    expect(result.character.spells.grantedSpells).toContain('burning-hands');
    expect(result.character.spells.grantedSpells).toContain('cure-wounds');
  });

  it('generates ASI/feat decisions from class progression', async () => {
    const character = createEmptyCharacter();
    character.progression.classId = 'fighter';
    character.progression.level = 4;
    character.origin.raceId = 'human';
    character.origin.backgroundId = 'acolyte';

    const result = await deriveCharacter(character);
    const asiDecision = result.character.validation.pendingDecisions.find((decision) =>
      decision.id.startsWith('asi-opportunity-4')
    );
    expect(asiDecision).toBeTruthy();
    expect(asiDecision?.kind).toBe('chooseAsiOrFeat');
  });

  it('keeps ability scores incomplete while point-buy points remain unspent', async () => {
    const character = createEmptyCharacter();
    character.progression.classId = 'fighter';
    character.origin.raceId = 'human';
    character.origin.backgroundId = 'acolyte';

    const result = await deriveCharacter(character);
    expect(getDecisionIds(result.character)).toContain('complete-point-buy');
  });

  it('shows subrace choice when a selected race has subraces', async () => {
    const character = createEmptyCharacter();
    character.progression.classId = 'fighter';
    character.origin.raceId = 'dwarf';
    character.origin.backgroundId = 'soldier';

    const result = await deriveCharacter(character);
    expect(getDecisionIds(result.character)).toContain('choose-subrace');
  });

  it('shows race ability bonus choices when a race grants flexible bonuses', async () => {
    const character = createEmptyCharacter();
    character.progression.classId = 'fighter';
    character.origin.raceId = 'half-elf';
    character.origin.backgroundId = 'soldier';

    const result = await deriveCharacter(character);
    expect(getDecisionIds(result.character)).toContain('choose-race-ability-bonuses');
  });

  it('shows background language and tool choice decisions when a background grants them', async () => {
    const acolyte = createEmptyCharacter();
    acolyte.progression.classId = 'fighter';
    acolyte.origin.raceId = 'human';
    acolyte.origin.backgroundId = 'acolyte';

    const acolyteResult = await deriveCharacter(acolyte);
    expect(getDecisionIds(acolyteResult.character)).toContain('choose-background-languages');

    const criminal = createEmptyCharacter();
    criminal.progression.classId = 'fighter';
    criminal.origin.raceId = 'human';
    criminal.origin.backgroundId = 'criminal';

    const criminalResult = await deriveCharacter(criminal);
    expect(getDecisionIds(criminalResult.character)).toContain('choose-background-tools');
  });
});
