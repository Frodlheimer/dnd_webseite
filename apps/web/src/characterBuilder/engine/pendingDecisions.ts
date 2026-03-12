import type { CharacterRecord, PendingDecision } from '../model/character';
import type { BuilderClassFeatureChoice, BuilderEquipmentChoice, BuilderSpellSelectionLimits } from '../rules/rulesFacade';

export type PendingDecisionContext = {
  character: CharacterRecord;
  classSkillChoice: {
    choose: number;
    options: string[];
  };
  selectedClassSkillsCount: number;
  subclassRequired: boolean;
  featureChoices: BuilderClassFeatureChoice[];
  equipmentChoices: BuilderEquipmentChoice[];
  spellLimits: BuilderSpellSelectionLimits;
  availableCantripCount: number;
  availableKnownSpellCount: number;
  availablePreparedSpellCount: number;
  asiLevels: number[];
};

const createDecision = (decision: PendingDecision): PendingDecision => decision;

const createAsiDecisionId = (level: number): string => `asi-opportunity-${level}`;

export const buildPendingDecisions = (context: PendingDecisionContext): PendingDecision[] => {
  const { character } = context;
  const pending: PendingDecision[] = [];

  if (!character.progression.classId) {
    pending.push(
      createDecision({
        id: 'choose-class',
        section: 'Basics',
        title: 'Choose a class',
        description: 'Your class determines proficiencies, hit die, features, and spellcasting.',
        kind: 'chooseClass',
        required: true,
        source: 'class'
      })
    );
  }

  if (!character.origin.raceId && !character.origin.speciesId) {
    pending.push(
      createDecision({
        id: 'choose-race',
        section: 'Origin',
        title: 'Choose race/species',
        kind: 'chooseRace',
        required: true,
        source: 'origin'
      })
    );
  }

  if (!character.origin.backgroundId) {
    pending.push(
      createDecision({
        id: 'choose-background',
        section: 'Origin',
        title: 'Choose a background',
        kind: 'chooseBackground',
        required: true,
        source: 'origin'
      })
    );
  }

  if (context.subclassRequired && !character.progression.subclassId) {
    pending.push(
      createDecision({
        id: 'choose-subclass',
        section: 'Features',
        title: 'Choose a subclass',
        description: 'Your class progression at this level requires a subclass.',
        kind: 'chooseSubclass',
        required: true,
        source: 'class'
      })
    );
  }

  if (context.classSkillChoice.choose > 0) {
    if (context.selectedClassSkillsCount < context.classSkillChoice.choose) {
      pending.push(
        createDecision({
          id: 'choose-class-skills',
          section: 'Proficiencies',
          title: 'Choose class skills',
          description: `Select ${context.classSkillChoice.choose} class skills.`,
          kind: 'chooseClassSkills',
          required: true,
          source: 'class',
          optionsCount: context.classSkillChoice.options.length
        })
      );
    }
  }

  if (character.origin.backgroundId) {
    const selectedLanguages = character.origin.selectedLanguages.length;
    const selectedTools = character.origin.selectedToolProficiencies.length;
    if (selectedLanguages === 0) {
      pending.push(
        createDecision({
          id: 'choose-background-languages',
          section: 'Origin',
          title: 'Choose background language choices',
          kind: 'chooseBackgroundLanguages',
          required: false,
          source: 'background'
        })
      );
    }
    if (selectedTools === 0) {
      pending.push(
        createDecision({
          id: 'choose-background-tools',
          section: 'Origin',
          title: 'Choose background tool choices',
          kind: 'chooseBackgroundTools',
          required: false,
          source: 'background'
        })
      );
    }
  }

  if (context.equipmentChoices.length > 0) {
    context.equipmentChoices.forEach((choice) => {
      const selected = character.equipment.selectedPackages.find(
        (entry) => entry.decisionId === choice.id
      );
      if (!selected) {
        pending.push(
          createDecision({
            id: choice.id,
            section: 'Equipment',
            title: choice.title,
            description: `Choose ${choice.choose} option${choice.choose > 1 ? 's' : ''}.`,
            kind: 'chooseEquipmentPackage',
            required: true,
            source: 'class',
            optionsCount: choice.options.length
          })
        );
      }
    });
  }

  context.featureChoices.forEach((choice) => {
    const value = character.features.selectedChoices[choice.id];
    const selectedCount = Array.isArray(value) ? value.length : value !== undefined ? 1 : 0;
    if (selectedCount < choice.choiceCount) {
      pending.push(
        createDecision({
          id: choice.id,
          section: 'Features',
          title: choice.title,
          description: `Choose ${choice.choiceCount} option${choice.choiceCount > 1 ? 's' : ''}.`,
          kind: 'chooseFeatureOption',
          required: choice.required,
          source: choice.source,
          optionsCount: choice.options.length
        })
      );
    }
  });

  if (context.spellLimits.cantripsKnown && context.spellLimits.cantripsKnown > 0) {
    if (character.spells.selectedCantrips.length < context.spellLimits.cantripsKnown) {
      pending.push(
        createDecision({
          id: 'choose-spell-cantrips',
          section: 'Spells',
          title: 'Choose cantrips',
          description: `Select ${context.spellLimits.cantripsKnown} cantrips.`,
          kind: 'chooseSpellCantrips',
          required: true,
          source: 'spellcasting',
          optionsCount: context.availableCantripCount
        })
      );
    }
  }

  if (context.spellLimits.isKnownSpellsCaster && context.spellLimits.spellsKnown) {
    if (character.spells.selectedKnownSpells.length < context.spellLimits.spellsKnown) {
      pending.push(
        createDecision({
          id: 'choose-known-spells',
          section: 'Spells',
          title: 'Choose known spells',
          description: `Select ${context.spellLimits.spellsKnown} known spells.`,
          kind: 'chooseKnownSpells',
          required: true,
          source: 'spellcasting',
          optionsCount: context.availableKnownSpellCount
        })
      );
    }
  }

  if (context.spellLimits.isPreparedCaster && context.spellLimits.preparedMax) {
    if (character.spells.preparedSpells.length < context.spellLimits.preparedMax) {
      pending.push(
        createDecision({
          id: 'choose-prepared-spells',
          section: 'Spells',
          title: 'Choose prepared spells',
          description: `Prepare up to ${context.spellLimits.preparedMax} spells.`,
          kind: 'choosePreparedSpells',
          required: false,
          source: 'spellcasting',
          optionsCount: context.availablePreparedSpellCount
        })
      );
    }
  }

  context.asiLevels
    .filter((level) => level <= character.progression.level)
    .forEach((level) => {
      const entry = character.featsAndAsi.opportunities.find((opportunity) => opportunity.level === level);
      if (!entry) {
        pending.push(
          createDecision({
            id: createAsiDecisionId(level),
            section: 'ASI / Feats',
            title: `Resolve ASI / Feat at level ${level}`,
            kind: 'chooseAsiOrFeat',
            required: true,
            source: 'class'
          })
        );
        return;
      }
      if (entry.choice.kind === 'FEAT' && !entry.choice.featId) {
        pending.push(
          createDecision({
            id: `${createAsiDecisionId(level)}:feat`,
            section: 'ASI / Feats',
            title: `Choose feat at level ${level}`,
            kind: 'chooseFeat',
            required: true,
            source: 'class'
          })
        );
      }
    });

  return pending;
};
