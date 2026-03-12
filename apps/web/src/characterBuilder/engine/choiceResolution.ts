import type { CharacterRecord } from '../model/character';

const cloneCharacter = (character: CharacterRecord): CharacterRecord => {
  return structuredClone(character);
};

const pruneSelectedChoicesByPrefix = (character: CharacterRecord, prefixes: string[]): void => {
  const nextChoices: Record<string, string | string[] | number | boolean> = {};
  Object.entries(character.features.selectedChoices).forEach(([key, value]) => {
    const shouldDrop = prefixes.some((prefix) => key.startsWith(prefix));
    if (!shouldDrop) {
      nextChoices[key] = value;
    }
  });
  character.features.selectedChoices = nextChoices;
};

export const invalidateForClassChange = (character: CharacterRecord, nextClassId: string | null): CharacterRecord => {
  const next = cloneCharacter(character);
  if (next.progression.classId === nextClassId) {
    return next;
  }

  next.progression.classId = nextClassId;
  next.progression.subclassId = null;

  next.proficiencies.skills = [];
  next.proficiencies.tools = [];
  next.proficiencies.armor = [];
  next.proficiencies.weapons = [];
  next.proficiencies.savingThrows = [];

  next.equipment.selectedPackages = [];
  next.equipment.items = [];

  next.spells.selectedCantrips = [];
  next.spells.selectedKnownSpells = [];
  next.spells.preparedSpells = [];
  next.spells.grantedSpells = [];
  next.spells.spellbookSpells = [];
  next.spells.customSelections = {};

  pruneSelectedChoicesByPrefix(next, ['class:', 'subclass:', 'feature:']);
  next.features.autoGranted = [];
  next.featsAndAsi.opportunities = [];
  return next;
};

export const invalidateForSubclassChange = (
  character: CharacterRecord,
  nextSubclassId: string | null
): CharacterRecord => {
  const next = cloneCharacter(character);
  if (next.progression.subclassId === nextSubclassId) {
    return next;
  }

  next.progression.subclassId = nextSubclassId;
  pruneSelectedChoicesByPrefix(next, ['subclass:', 'feature:subclass']);
  next.spells.grantedSpells = [];
  return next;
};

export const invalidateForLevelChange = (character: CharacterRecord, nextLevel: number): CharacterRecord => {
  const next = cloneCharacter(character);
  const clampedLevel = Math.max(1, Math.min(20, Math.trunc(nextLevel)));
  if (next.progression.level === clampedLevel) {
    return next;
  }

  next.progression.level = clampedLevel;

  if (next.featsAndAsi.opportunities.length > 0) {
    next.featsAndAsi.opportunities = next.featsAndAsi.opportunities.filter(
      (entry) => entry.level <= clampedLevel
    );
  }

  if (clampedLevel < 2) {
    next.progression.subclassId = null;
  }

  next.spells.preparedSpells = [];
  next.spells.selectedKnownSpells = [];
  next.spells.selectedCantrips = [];
  pruneSelectedChoicesByPrefix(next, ['feature:level:']);
  return next;
};

export const invalidateForOriginModeChange = (
  character: CharacterRecord,
  nextMode: CharacterRecord['origin']['mode']
): CharacterRecord => {
  const next = cloneCharacter(character);
  if (next.origin.mode === nextMode) {
    return next;
  }

  next.origin.mode = nextMode;
  next.origin.raceId = null;
  next.origin.speciesId = null;
  next.origin.selectedLanguages = [];
  next.origin.selectedToolProficiencies = [];
  next.origin.backgroundBonusAssignments = {};
  next.origin.legacyRaceBonusAssignments = {};

  next.spells.grantedSpells = [];
  return next;
};

export const invalidateForRaceChange = (character: CharacterRecord, raceId: string | null): CharacterRecord => {
  const next = cloneCharacter(character);
  if (next.origin.raceId === raceId) {
    return next;
  }
  next.origin.raceId = raceId;
  next.origin.speciesId = raceId;
  next.origin.selectedLanguages = [];
  next.origin.selectedToolProficiencies = [];
  next.origin.legacyRaceBonusAssignments = {};
  next.spells.grantedSpells = [];
  return next;
};

export const invalidateForBackgroundChange = (
  character: CharacterRecord,
  backgroundId: string | null
): CharacterRecord => {
  const next = cloneCharacter(character);
  if (next.origin.backgroundId === backgroundId) {
    return next;
  }
  next.origin.backgroundId = backgroundId;
  next.origin.selectedLanguages = [];
  next.origin.selectedToolProficiencies = [];
  if (next.origin.mode === 'SRD_5_2_BACKGROUND') {
    next.origin.backgroundBonusAssignments = {};
  }
  return next;
};

