import { describe, expect, it } from 'vitest';

import { deriveCharacter } from './deriveCharacter';
import { createEmptyCharacter } from '../model/character';

const getDecisionIds = (character: Awaited<ReturnType<typeof deriveCharacter>>['character']) => {
  return character.validation.pendingDecisions.map((decision) => decision.id);
};

describe('pending decisions from deriveCharacter', () => {
  it('shows subclass decision at the correct class level', async () => {
    const character = createEmptyCharacter();
    character.progression.classId = 'fighter';
    character.progression.level = 3;
    character.origin.raceId = 'lineage:custom';
    character.origin.backgroundId = 'acolyte';

    const result = await deriveCharacter(character);
    expect(getDecisionIds(result.character)).toContain('choose-subclass');
  });

  it('shows class skill decision when required picks are missing', async () => {
    const character = createEmptyCharacter();
    character.progression.classId = 'fighter';
    character.origin.raceId = 'lineage:custom';
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
    character.origin.raceId = 'lineage:custom';
    character.origin.backgroundId = 'acolyte';

    const result = await deriveCharacter(character);
    expect(result.character.spells.grantedSpells).toContain('burning-hands');
    expect(result.character.spells.grantedSpells).toContain('cure-wounds');
  });

  it('generates ASI/feat decisions from class progression', async () => {
    const character = createEmptyCharacter();
    character.progression.classId = 'fighter';
    character.progression.level = 4;
    character.origin.raceId = 'lineage:custom';
    character.origin.backgroundId = 'acolyte';

    const result = await deriveCharacter(character);
    const asiDecision = result.character.validation.pendingDecisions.find((decision) =>
      decision.id.startsWith('asi-opportunity-4')
    );
    expect(asiDecision).toBeTruthy();
    expect(asiDecision?.kind).toBe('chooseAsiOrFeat');
  });
});

