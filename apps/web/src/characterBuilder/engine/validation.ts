import {
  isImplementedCharacterRuleset,
  type CharacterRecord,
  type PendingDecision,
  type ValidationIssue
} from '../model/character';
import type { BuilderClassFeatureChoice, BuilderEquipmentChoice, BuilderSpellSelectionLimits } from '../rules/rulesFacade';

export type ValidationContext = {
  character: CharacterRecord;
  pointBuyErrors: string[];
  classSkillChoiceCount: number;
  selectedClassSkillsCount: number;
  featureChoices: BuilderClassFeatureChoice[];
  equipmentChoices: BuilderEquipmentChoice[];
  spellLimits: BuilderSpellSelectionLimits;
  maxSpellLevel: number;
  availableSpellSlugs: Set<string>;
  pendingDecisions: PendingDecision[];
};

const issueId = (section: string, index: number): string => `${section.toLowerCase().replace(/\s+/g, '-')}-${index}`;

export const buildValidationIssues = (context: ValidationContext): {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
} => {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const pushError = (section: string, message: string, decisionId?: string) => {
    const issue: ValidationIssue = {
      id: issueId(section, errors.length + 1),
      severity: 'error',
      section,
      message
    };
    if (decisionId) {
      issue.decisionId = decisionId;
    }
    errors.push(issue);
  };

  const pushWarning = (section: string, message: string, decisionId?: string) => {
    const issue: ValidationIssue = {
      id: issueId(section, warnings.length + 1),
      severity: 'warning',
      section,
      message
    };
    if (decisionId) {
      issue.decisionId = decisionId;
    }
    warnings.push(issue);
  };

  if (!isImplementedCharacterRuleset(context.character.ruleset)) {
    pushError(
      'Rule Set',
      'DnD5.5 (SRD 5.2) is not available in the guided Character Builder yet. Switch to DnD5e (SRD 5.1) to continue.'
    );
    return {
      errors,
      warnings
    };
  }

  if (context.pointBuyErrors.length > 0) {
    context.pointBuyErrors.forEach((message) => {
      pushError('Ability Scores', message, 'choosePointBuy');
    });
  }

  if (!context.character.progression.classId) {
    pushError('Basics', 'Character class is required.', 'chooseClass');
  }

  if (!context.character.origin.raceId && !context.character.origin.speciesId) {
    pushError('Race', 'Race or species selection is required.', 'chooseRace');
  }

  if (!context.character.origin.backgroundId) {
    pushError('Background', 'Background selection is required.', 'chooseBackground');
  }

  if (context.classSkillChoiceCount > 0 && context.selectedClassSkillsCount < context.classSkillChoiceCount) {
    pushError(
      'Proficiencies',
      `Class skill selection is incomplete (${context.selectedClassSkillsCount}/${context.classSkillChoiceCount}).`,
      'chooseClassSkills'
    );
  }

  context.featureChoices.forEach((choice) => {
    const selected = context.character.features.selectedChoices[choice.id];
    const selectedCount = Array.isArray(selected) ? selected.length : selected !== undefined ? 1 : 0;
    if (selectedCount < choice.choiceCount) {
      pushError(
        'Features',
        `${choice.title} requires ${choice.choiceCount} selection${choice.choiceCount > 1 ? 's' : ''}.`,
        choice.id
      );
    } else if (Array.isArray(selected)) {
      const invalid = selected.filter((entry) => !choice.options.some((option) => option.id === entry));
      if (invalid.length > 0) {
        pushWarning(
          'Features',
          `${choice.title} contains outdated selections. Please review this decision.`,
          choice.id
        );
      }
    } else if (typeof selected === 'string') {
      if (!choice.options.some((option) => option.id === selected)) {
        pushWarning(
          'Features',
          `${choice.title} selection no longer matches available options and needs review.`,
          choice.id
        );
      }
    }
  });

  context.equipmentChoices.forEach((choice) => {
    const selected = context.character.equipment.selectedPackages.find((entry) => entry.decisionId === choice.id);
    if (!selected) {
      pushError('Equipment', `${choice.title} has no selected option.`, choice.id);
      return;
    }

    const validOption = choice.options.find((option) => option.id === selected.optionId);
    if (!validOption) {
      pushWarning('Equipment', `${choice.title} selection is outdated and needs review.`, choice.id);
    }
  });

  if (context.spellLimits.cantripsKnown && context.spellLimits.cantripsKnown > 0) {
    if (context.character.spells.selectedCantrips.length > context.spellLimits.cantripsKnown) {
      pushError(
        'Spells',
        `Too many cantrips selected (${context.character.spells.selectedCantrips.length}/${context.spellLimits.cantripsKnown}).`,
        'chooseSpellCantrips'
      );
    }
  }

  if (context.spellLimits.isKnownSpellsCaster && context.spellLimits.spellsKnown) {
    if (context.character.spells.selectedKnownSpells.length > context.spellLimits.spellsKnown) {
      pushError(
        'Spells',
        `Too many known spells selected (${context.character.spells.selectedKnownSpells.length}/${context.spellLimits.spellsKnown}).`,
        'chooseKnownSpells'
      );
    }
  }

  if (context.spellLimits.isPreparedCaster && context.spellLimits.preparedMax) {
    if (context.character.spells.preparedSpells.length > context.spellLimits.preparedMax) {
      pushError(
        'Spells',
        `Too many prepared spells selected (${context.character.spells.preparedSpells.length}/${context.spellLimits.preparedMax}).`,
        'choosePreparedSpells'
      );
    }
  }

  const selectedSpells = [
    ...context.character.spells.selectedCantrips,
    ...context.character.spells.selectedKnownSpells,
    ...context.character.spells.preparedSpells
  ];
  selectedSpells.forEach((spellSlug) => {
    if (!context.availableSpellSlugs.has(spellSlug)) {
      pushWarning('Spells', `Spell "${spellSlug}" is no longer available and needs review.`);
    }
  });

  if (context.maxSpellLevel === 0 && context.character.spells.selectedKnownSpells.length > 0) {
    pushWarning('Spells', 'Leveled spells were selected but no spell slots are available at this level.');
  }

  const pendingRequired = context.pendingDecisions.filter((entry) => entry.required);
  if (pendingRequired.length > 0) {
    pendingRequired.forEach((entry) => {
      pushError(entry.section, `${entry.title} is still unresolved.`, entry.id);
    });
  }

  if (context.character.derived.armorClass === null) {
    pushWarning('Combat', 'Armor Class could not be derived exactly from selected equipment.');
  }

  if (context.character.derived.hitPointsMax === null) {
    pushWarning('Combat', 'Hit points could not be fully derived until class and Constitution are resolved.');
  }

  const duplicateSkills = context.character.proficiencies.skills.filter(
    (skill, index, list) => list.indexOf(skill) !== index
  );
  if (duplicateSkills.length > 0) {
    pushWarning('Proficiencies', 'Duplicate skill proficiencies detected. Review your skill selections.');
  }

  return {
    errors,
    warnings
  };
};
