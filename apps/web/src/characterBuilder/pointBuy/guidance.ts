import type { FinalScoreComputation } from './rules';
import type { BonusMode } from './bonuses';
import { ABILITIES, ABILITY_LABELS, type Ability, type AbilityMap } from './types';

export type PointBuyGuidanceSeverity = 'warning' | 'info';

export type PointBuyGuidanceItem = {
  id: string;
  severity: PointBuyGuidanceSeverity;
  text: string;
};

type PointBuyGuidanceInput = {
  classId: string;
  baseScores: AbilityMap;
  pointRemaining: number;
  finalComputation: FinalScoreComputation;
  classSelected: boolean;
  bonusMode: BonusMode;
  legacyRaceSelected: boolean;
  asiOpportunityCount: number;
  unresolvedImprovementSlots: number;
  multiclassEnabled: boolean;
  multiclassPrimaryClassId: string;
  multiclassSecondaryClassId: string;
};

type MulticlassRequirement =
  | {
      mode: 'ALL';
      abilities: Ability[];
    }
  | {
      mode: 'ANY';
      abilities: Ability[];
    };

const MULTICLASS_REQUIREMENTS: Partial<Record<string, MulticlassRequirement>> = {
  artificer: { mode: 'ALL', abilities: ['INT'] },
  barbarian: { mode: 'ALL', abilities: ['STR'] },
  bard: { mode: 'ALL', abilities: ['CHA'] },
  cleric: { mode: 'ALL', abilities: ['WIS'] },
  druid: { mode: 'ALL', abilities: ['WIS'] },
  fighter: { mode: 'ANY', abilities: ['STR', 'DEX'] },
  monk: { mode: 'ALL', abilities: ['DEX', 'WIS'] },
  paladin: { mode: 'ALL', abilities: ['STR', 'CHA'] },
  ranger: { mode: 'ALL', abilities: ['DEX', 'WIS'] },
  rogue: { mode: 'ALL', abilities: ['DEX'] },
  sorcerer: { mode: 'ALL', abilities: ['CHA'] },
  warlock: { mode: 'ALL', abilities: ['CHA'] },
  wizard: { mode: 'ALL', abilities: ['INT'] }
};

const formatClassName = (classId: string): string => {
  if (!classId) {
    return 'Class';
  }
  return classId
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
};

const formatRequirementText = (requirement: MulticlassRequirement): string => {
  const names = requirement.abilities.map((ability) => `${ABILITY_LABELS[ability]} 13+`);
  if (requirement.mode === 'ANY') {
    return names.join(' or ');
  }
  return names.join(' and ');
};

const createMulticlassRequirementHints = (
  input: Pick<
    PointBuyGuidanceInput,
    'multiclassEnabled' | 'multiclassPrimaryClassId' | 'multiclassSecondaryClassId'
  >,
  finalScores: Record<Ability, number>
): PointBuyGuidanceItem[] => {
  if (!input.multiclassEnabled) {
    return [];
  }

  const hints: PointBuyGuidanceItem[] = [];

  if (!input.multiclassPrimaryClassId) {
    hints.push({
      id: 'multiclass-primary-missing',
      severity: 'warning',
      text: 'Choose a primary class before applying multiclass requirements.'
    });
    return hints;
  }

  if (!input.multiclassSecondaryClassId) {
    hints.push({
      id: 'multiclass-secondary-missing',
      severity: 'warning',
      text: 'Choose a secondary class to validate multiclass requirements.'
    });
    return hints;
  }

  const evaluateClassRequirement = (classId: string, hintId: string) => {
    const requirement = MULTICLASS_REQUIREMENTS[classId];
    if (!requirement) {
      return;
    }

    const met =
      requirement.mode === 'ALL'
        ? requirement.abilities.every((ability) => finalScores[ability] >= 13)
        : requirement.abilities.some((ability) => finalScores[ability] >= 13);
    if (met) {
      return;
    }

    const scorePreview = requirement.abilities
      .map((ability) => `${ABILITY_LABELS[ability]} ${finalScores[ability]}`)
      .join(', ');

    hints.push({
      id: hintId,
      severity: 'warning',
      text: `Multiclass requirement not met for ${formatClassName(classId)}: ${formatRequirementText(
        requirement
      )}. Current: ${scorePreview}.`
    });
  };

  evaluateClassRequirement(input.multiclassPrimaryClassId, 'multiclass-primary-requirement');
  evaluateClassRequirement(input.multiclassSecondaryClassId, 'multiclass-secondary-requirement');

  return hints;
};

const createClassPrimaryHint = (
  classId: string,
  classSelected: boolean,
  finalScores: Record<Ability, number>
): PointBuyGuidanceItem[] => {
  const hints: PointBuyGuidanceItem[] = [];

  if (!classSelected) {
    hints.push({
      id: 'setup-class-missing',
      severity: 'warning',
      text: 'Choose a class to enable class-specific guidance and correct ASI/Feat progression.'
    });
    return hints;
  }

  const isLow = (ability: Ability, min: number) => finalScores[ability] < min;

  switch (classId) {
    case 'barbarian': {
      if (isLow('STR', 14)) {
        hints.push({
          id: 'class-barbarian-str',
          severity: 'warning',
          text: 'Unusual choice for Barbarian: Strength is low. Most builds prioritize Strength.'
        });
      }
      if (isLow('CON', 14)) {
        hints.push({
          id: 'class-barbarian-con',
          severity: 'warning',
          text: 'Unusual choice for Barbarian: Constitution is low for a front-line build.'
        });
      }
      break;
    }
    case 'wizard': {
      if (isLow('INT', 14)) {
        hints.push({
          id: 'class-wizard-int',
          severity: 'warning',
          text: 'Most Wizards prioritize Intelligence for spell accuracy and DCs.'
        });
      }
      break;
    }
    case 'cleric':
    case 'druid': {
      if (isLow('WIS', 14)) {
        hints.push({
          id: `class-${classId}-wis`,
          severity: 'warning',
          text: 'Most Clerics and Druids prioritize Wisdom.'
        });
      }
      break;
    }
    case 'paladin': {
      if (isLow('STR', 13) && isLow('CHA', 13)) {
        hints.push({
          id: 'class-paladin-dual',
          severity: 'warning',
          text: 'Unusual Paladin setup: both Strength and Charisma are low.'
        });
      } else {
        if (isLow('STR', 13)) {
          hints.push({
            id: 'class-paladin-str',
            severity: 'info',
            text: 'Most Paladins keep Strength at a solid baseline.'
          });
        }
        if (isLow('CHA', 13)) {
          hints.push({
            id: 'class-paladin-cha',
            severity: 'info',
            text: 'Most Paladins benefit from stronger Charisma.'
          });
        }
      }
      break;
    }
    case 'rogue': {
      if (isLow('DEX', 14)) {
        hints.push({
          id: 'class-rogue-dex',
          severity: 'warning',
          text: 'Most Rogues prioritize Dexterity.'
        });
      }
      break;
    }
    case 'fighter': {
      if (isLow('STR', 13) && isLow('DEX', 13)) {
        hints.push({
          id: 'class-fighter-physical',
          severity: 'warning',
          text: 'Fighter has no clear physical primary stat yet (Strength or Dexterity).'
        });
      }
      break;
    }
    case 'sorcerer':
    case 'warlock':
    case 'bard': {
      if (isLow('CHA', 14)) {
        hints.push({
          id: `class-${classId}-cha`,
          severity: 'warning',
          text: 'Most Charisma casters prioritize Charisma.'
        });
      }
      break;
    }
    case 'monk': {
      if (isLow('DEX', 14)) {
        hints.push({
          id: 'class-monk-dex',
          severity: 'warning',
          text: 'Monk usually needs strong Dexterity.'
        });
      }
      if (isLow('WIS', 14)) {
        hints.push({
          id: 'class-monk-wis',
          severity: 'info',
          text: 'Monk usually benefits from stronger Wisdom.'
        });
      }
      break;
    }
    case 'ranger': {
      if (isLow('DEX', 13) && isLow('WIS', 13)) {
        hints.push({
          id: 'class-ranger-core',
          severity: 'warning',
          text: 'Ranger usually wants a stronger Dexterity or Wisdom baseline.'
        });
      } else if (isLow('DEX', 13)) {
        hints.push({
          id: 'class-ranger-dex',
          severity: 'info',
          text: 'Most Rangers keep Dexterity at a solid baseline.'
        });
      } else if (isLow('WIS', 13)) {
        hints.push({
          id: 'class-ranger-wis',
          severity: 'info',
          text: 'Most Rangers benefit from stronger Wisdom.'
        });
      }
      break;
    }
    default:
      break;
  }

  return hints;
};

const createEfficiencyHints = ({
  baseScores,
  pointRemaining,
  finalComputation
}: Pick<PointBuyGuidanceInput, 'baseScores' | 'pointRemaining' | 'finalComputation'>): PointBuyGuidanceItem[] => {
  const hints: PointBuyGuidanceItem[] = [];

  const finalScores = ABILITIES.map((ability) => ({
    ability,
    base: baseScores[ability],
    final: finalComputation.byAbility[ability].final
  }));

  const abilitiesAt15 = finalScores.filter((entry) => entry.base === 15);
  if (abilitiesAt15.length > 1) {
    hints.push({
      id: 'efficiency-multi-15',
      severity: 'info',
      text: `You have ${abilitiesAt15.length} base scores at 15. Raising 14 -> 15 costs 2 points each.`
    });
  } else if (abilitiesAt15.length === 1 && abilitiesAt15[0]) {
    hints.push({
      id: 'efficiency-single-15',
      severity: 'info',
      text: `${ABILITY_LABELS[abilitiesAt15[0].ability]} at 15 is expensive (14 -> 15 costs 2 points).`
    });
  }

  const oddFinals = finalScores
    .filter((entry) => entry.final % 2 === 1 && entry.final < 20)
    .slice(0, 2);
  oddFinals.forEach((entry) => {
    hints.push({
      id: `efficiency-odd-${entry.ability}`,
      severity: 'info',
      text: `${ABILITY_LABELS[entry.ability]} is ${entry.final}, which gives the same modifier as ${
        entry.final - 1
      } until you add another +1.`
    });
  });

  if (pointRemaining > 0) {
    hints.push({
      id: 'efficiency-points-left',
      severity: 'info',
      text: `You still have ${pointRemaining} point${pointRemaining === 1 ? '' : 's'} available.`
    });
  }

  const conFinal = finalComputation.byAbility.CON.final;
  if (conFinal < 12) {
    hints.push({
      id: 'efficiency-con-low',
      severity: 'warning',
      text: `Constitution is ${conFinal}. Many builds keep Constitution between 12 and 16 for survivability.`
    });
  } else if (conFinal > 16) {
    hints.push({
      id: 'efficiency-con-high',
      severity: 'info',
      text: `Constitution is ${conFinal}. This is valid, but many builds stay in the 12-16 range and invest points elsewhere.`
    });
  }

  ABILITIES.forEach((ability) => {
    const overflow = finalComputation.capOverflow[ability];
    if (overflow <= 0) {
      return;
    }

    const fromBonus = finalComputation.byAbility[ability].bonus;
    const fromAsi = finalComputation.advancement.asi[ability];
    const fromFeat = finalComputation.advancement.feat[ability];
    const sources: string[] = [];
    if (fromBonus > 0) {
      sources.push(`bonus +${fromBonus}`);
    }
    if (fromAsi > 0) {
      sources.push(`ASI +${fromAsi}`);
    }
    if (fromFeat > 0) {
      sources.push(`feat +${fromFeat}`);
    }

    hints.push({
      id: `cap-${ability}`,
      severity: 'info',
      text: `${ABILITY_LABELS[ability]} is capped at 20; ${overflow} point${
        overflow === 1 ? '' : 's'
      } overflow from ${sources.length > 0 ? sources.join(', ') : 'advancements'}.`
    });
  });

  return hints;
};

export const buildPointBuyGuidance = (input: PointBuyGuidanceInput): PointBuyGuidanceItem[] => {
  const finalScores = ABILITIES.reduce(
    (accumulator, ability) => {
      accumulator[ability] = input.finalComputation.byAbility[ability].final;
      return accumulator;
    },
    {} as Record<Ability, number>
  );

  const setupHints: PointBuyGuidanceItem[] = [];
  if (input.bonusMode === 'LEGACY_RACE' && !input.legacyRaceSelected) {
    setupHints.push({
      id: 'setup-race-missing',
      severity: 'warning',
      text: 'Choose a legacy race to apply race bonuses.'
    });
  }
  if (input.unresolvedImprovementSlots > 0) {
    setupHints.push({
      id: 'setup-asi-feat-missing',
      severity: 'warning',
      text: `${input.unresolvedImprovementSlots} ASI or Feat selection${
        input.unresolvedImprovementSlots === 1 ? '' : 's'
      } still ${input.unresolvedImprovementSlots === 1 ? 'needs' : 'need'} to be chosen.`
    });
  }

  const classHints = createClassPrimaryHint(input.classId, input.classSelected, finalScores);
  const multiclassHints = createMulticlassRequirementHints(input, finalScores);
  const efficiencyHints = createEfficiencyHints(input);

  const combined = [...setupHints, ...multiclassHints, ...classHints, ...efficiencyHints];
  const seen = new Set<string>();
  const deduped = combined.filter((hint) => {
    if (seen.has(hint.id)) {
      return false;
    }
    seen.add(hint.id);
    return true;
  });

  const warnings = deduped.filter((hint) => hint.severity === 'warning');
  const infos = deduped.filter((hint) => hint.severity === 'info');
  return [...warnings, ...infos].slice(0, 7);
};
