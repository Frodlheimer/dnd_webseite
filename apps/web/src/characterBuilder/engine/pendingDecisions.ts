import { isImplementedCharacterRuleset, type CharacterRecord, type PendingDecision } from '../model/character';
import { calculatePointBuy } from '../pointBuy/rules';
import type { BuilderClassFeatureChoice, BuilderEquipmentChoice, BuilderSpellSelectionLimits } from '../rules/rulesFacade';
import { rulesFacade } from '../rules/rulesFacade';

export type PendingDecisionContext = {
  character: CharacterRecord;
  classSkillChoice: {
    choose: number;
    options: string[];
  };
  selectedClassSkillsCount: number;
  availableSubraces: Array<{
    id: string;
    name: string;
    summary: string;
  }>;
  selectedRaceSkillChoicesCount: number;
  selectedRaceLanguageChoicesCount: number;
  selectedRaceToolChoicesCount: number;
  selectedRaceAbilityChoicesCount: number;
  selectedBackgroundSkillChoicesCount: number;
  selectedBackgroundLanguageChoicesCount: number;
  selectedBackgroundToolChoicesCount: number;
  raceSkillChoice: {
    choose: number;
    from: string[];
  } | null;
  raceLanguageChoice: {
    choose: number;
    from: string[];
  } | null;
  raceToolChoice: {
    choose: number;
    from: string[];
  } | null;
  raceAbilityBonusChoice: {
    choose: number;
    amount: number;
    from: Array<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'>;
  } | null;
  backgroundSkillChoice: {
    choose: number;
    from: string[];
  } | null;
  backgroundLanguageChoice: {
    choose: number;
    from: string[];
  } | null;
  backgroundToolChoice: {
    choose: number;
    from: string[];
  } | null;
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

const toPointBuyBaseScores = (character: CharacterRecord) => ({
  STR: character.abilities.pointBuyBase.str,
  DEX: character.abilities.pointBuyBase.dex,
  CON: character.abilities.pointBuyBase.con,
  INT: character.abilities.pointBuyBase.int,
  WIS: character.abilities.pointBuyBase.wis,
  CHA: character.abilities.pointBuyBase.cha
});

export const buildPendingDecisions = (context: PendingDecisionContext): PendingDecision[] => {
  const { character } = context;
  const pending: PendingDecision[] = [];

  if (!isImplementedCharacterRuleset(character.ruleset)) {
    return pending;
  }

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
        section: 'Race',
        title: 'Choose race/species',
        kind: 'chooseRace',
        required: true,
        source: 'origin'
      })
    );
  }

  if (character.origin.raceId && context.availableSubraces.length > 0 && !character.origin.subraceId) {
    pending.push(
      createDecision({
        id: 'choose-subrace',
        section: 'Race',
        title: 'Choose a subrace',
        description: 'Your selected race has subrace options that add more traits.',
        kind: 'chooseSubrace',
        required: true,
        source: 'origin',
        optionsCount: context.availableSubraces.length
      })
    );
  }

  if (!character.origin.backgroundId) {
    pending.push(
      createDecision({
        id: 'choose-background',
        section: 'Background',
        title: 'Choose a background',
        kind: 'chooseBackground',
        required: true,
        source: 'origin'
      })
    );
  }

  const pointBuy = calculatePointBuy(toPointBuyBaseScores(character));
  if (pointBuy.remaining > 0) {
    pending.push(
      createDecision({
        id: 'complete-point-buy',
        section: 'Ability Scores',
        title: 'Spend remaining point-buy points',
        description: `Assign the remaining ${pointBuy.remaining} point-buy point${
          pointBuy.remaining === 1 ? '' : 's'
        } before this step is complete.`,
        kind: 'completePointBuy',
        required: true,
        source: 'point-buy'
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
    if (
      context.backgroundSkillChoice &&
      context.selectedBackgroundSkillChoicesCount < context.backgroundSkillChoice.choose
    ) {
      pending.push(
        createDecision({
          id: 'choose-background-skills',
          section: 'Background',
          title: 'Choose background skill choices',
          description: `Select ${context.backgroundSkillChoice.choose} background skill choice${
            context.backgroundSkillChoice.choose > 1 ? 's' : ''
          }.`,
          kind: 'chooseBackgroundSkills',
          required: true,
          source: 'background',
          optionsCount: context.backgroundSkillChoice.from.length
        })
      );
    }
    if (
      context.backgroundLanguageChoice &&
      context.selectedBackgroundLanguageChoicesCount < context.backgroundLanguageChoice.choose
    ) {
      pending.push(
        createDecision({
          id: 'choose-background-languages',
          section: 'Background',
          title: 'Choose background language choices',
          description: `Select ${context.backgroundLanguageChoice.choose} background language choice${
            context.backgroundLanguageChoice.choose > 1 ? 's' : ''
          }.`,
          kind: 'chooseBackgroundLanguages',
          required: true,
          source: 'background',
          optionsCount: context.backgroundLanguageChoice.from.length
        })
      );
    }
    if (
      context.backgroundToolChoice &&
      context.selectedBackgroundToolChoicesCount < context.backgroundToolChoice.choose
    ) {
      pending.push(
        createDecision({
          id: 'choose-background-tools',
          section: 'Background',
          title: 'Choose background tool choices',
          description: `Select ${context.backgroundToolChoice.choose} background tool choice${
            context.backgroundToolChoice.choose > 1 ? 's' : ''
          }.`,
          kind: 'chooseBackgroundTools',
          required: true,
          source: 'background',
          optionsCount: context.backgroundToolChoice.from.length
        })
      );
    }
  }

  if (context.raceLanguageChoice && context.selectedRaceLanguageChoicesCount < context.raceLanguageChoice.choose) {
    pending.push(
      createDecision({
        id: 'choose-race-languages',
        section: 'Race',
        title: 'Choose race language choices',
        description: `Select ${context.raceLanguageChoice.choose} race language choice${
          context.raceLanguageChoice.choose > 1 ? 's' : ''
        }.`,
        kind: 'chooseRaceLanguages',
        required: true,
        source: 'origin',
        optionsCount: context.raceLanguageChoice.from.length
      })
    );
  }

  if (context.raceToolChoice && context.selectedRaceToolChoicesCount < context.raceToolChoice.choose) {
    pending.push(
      createDecision({
        id: 'choose-race-tools',
        section: 'Race',
        title: 'Choose race tool choices',
        description: `Select ${context.raceToolChoice.choose} race tool choice${
          context.raceToolChoice.choose > 1 ? 's' : ''
        }.`,
        kind: 'chooseRaceTools',
        required: true,
        source: 'origin',
        optionsCount: context.raceToolChoice.from.length
      })
    );
  }

  if (
    context.raceAbilityBonusChoice &&
    context.selectedRaceAbilityChoicesCount < context.raceAbilityBonusChoice.choose
  ) {
    pending.push(
      createDecision({
        id: 'choose-race-ability-bonuses',
        section: 'Ability Scores',
        title: 'Choose race ability bonuses',
        description: `Select ${context.raceAbilityBonusChoice.choose} ability score${
          context.raceAbilityBonusChoice.choose > 1 ? 's' : ''
        } to gain +${context.raceAbilityBonusChoice.amount}.`,
        kind: 'chooseRaceAbilityBonuses',
        required: true,
        source: 'origin',
        optionsCount: context.raceAbilityBonusChoice.from.length
      })
    );
  }

  if (context.raceSkillChoice && context.selectedRaceSkillChoicesCount < context.raceSkillChoice.choose) {
    pending.push(
      createDecision({
        id: 'choose-race-skills',
        section: 'Race',
        title: 'Choose race skill choices',
        description: `Select ${context.raceSkillChoice.choose} race skill choice${
          context.raceSkillChoice.choose > 1 ? 's' : ''
        }.`,
        kind: 'chooseRaceSkills',
        required: true,
        source: 'origin',
        optionsCount: context.raceSkillChoice.from.length
      })
    );
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
            source: choice.source ?? 'class',
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
            required: true,
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
            section: 'Ability Scores',
            title: `Resolve ASI / Feat at level ${level}`,
            kind: 'chooseAsiOrFeat',
            required: true,
            source: 'class'
          })
        );
        return;
      }
      if (entry.choice.kind === 'ASI') {
        const assignedTotal = Object.values(entry.choice.increases).reduce((sum, value) => sum + (value ?? 0), 0);
        if (assignedTotal < 2) {
          pending.push(
            createDecision({
              id: `${createAsiDecisionId(level)}:asi`,
              section: 'Ability Scores',
              title: `Finish ASI assignment at level ${level}`,
              kind: 'chooseAsiOrFeat',
              required: true,
              source: 'class'
            })
          );
        }
        return;
      }
      if (entry.choice.kind === 'FEAT' && !entry.choice.featId) {
        pending.push(
          createDecision({
            id: `${createAsiDecisionId(level)}:feat`,
            section: 'Ability Scores',
            title: `Choose feat at level ${level}`,
            kind: 'chooseFeat',
            required: true,
            source: 'class'
          })
        );
        return;
      }
      if (entry.choice.kind === 'FEAT' && entry.choice.featId) {
        const featMeta = rulesFacade.getFeatById(entry.choice.featId);
        const requiredBonusCount =
          featMeta?.quickFacts.abilityIncrease.mode === 'CHOICE'
            ? featMeta.quickFacts.abilityIncrease.amount
            : 0;
        if (requiredBonusCount > 0) {
          const assignedTotal = Object.values(entry.choice.bonusAssignments ?? {}).reduce(
            (sum, value) => sum + (value ?? 0),
            0
          );
          if (assignedTotal < requiredBonusCount) {
            pending.push(
              createDecision({
                id: `${createAsiDecisionId(level)}:feat-bonus`,
                section: 'Ability Scores',
                title: `Assign feat ability bonus at level ${level}`,
                kind: 'chooseFeatBonusAbility',
                required: true,
                source: 'class'
              })
            );
          }
        }
      }
    });

  return pending;
};
