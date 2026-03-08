import { ABILITIES, createAbilityMap, type Ability, type AbilityMap } from './types';

export type BonusMode = 'SRD_BACKGROUND' | 'LEGACY_RACE';

export type BackgroundPattern = 'PLUS_TWO_ONE' | 'PLUS_ONE_ALL_THREE';

export type BackgroundBonusConfig = {
  selectedAbilities: Ability[];
  pattern: BackgroundPattern;
  plusTwoAbility?: Ability;
  plusOneAbility?: Ability;
};

export type LegacyRaceId =
  | 'NONE'
  | 'HUMAN'
  | 'HUMAN_VARIANT'
  | 'DWARF'
  | 'ELF'
  | 'HALFLING'
  | 'GNOME'
  | 'HALF_ELF'
  | 'HALF_ORC'
  | 'TIEFLING'
  | 'DRAGONBORN'
  | 'CUSTOM';

export type LegacyCustomBonus = {
  ability: Ability;
  amount: number;
};

export type LegacyRaceConfig = {
  raceId: LegacyRaceId;
  halfElfPlusOneAbilities: Ability[];
  humanVariantPlusOneAbilities: Ability[];
  humanVariantFeatId: string | undefined;
  humanVariantFeatAbility: Ability | undefined;
  customBonuses: LegacyCustomBonus[];
};

export type BonusComputation = {
  bonuses: AbilityMap;
  errors: string[];
};

export type LegacyRaceOption = {
  id: LegacyRaceId;
  label: string;
  description: string;
};

export const LEGACY_RACE_OPTIONS: LegacyRaceOption[] = [
  { id: 'NONE', label: 'Choose Race', description: 'Select a legacy race to apply race bonuses.' },
  { id: 'HUMAN', label: 'Human', description: '+1 to all six abilities' },
  {
    id: 'HUMAN_VARIANT',
    label: 'Human Variant',
    description: '+1 to two different abilities, one skill, and one feat at level 1'
  },
  { id: 'DWARF', label: 'Dwarf', description: '+2 Constitution' },
  { id: 'ELF', label: 'Elf', description: '+2 Dexterity' },
  { id: 'HALFLING', label: 'Halfling', description: '+2 Dexterity' },
  { id: 'GNOME', label: 'Gnome', description: '+2 Intelligence' },
  { id: 'HALF_ELF', label: 'Half-Elf', description: '+2 Charisma, +1 to two other abilities' },
  { id: 'HALF_ORC', label: 'Half-Orc', description: '+2 Strength, +1 Constitution' },
  { id: 'TIEFLING', label: 'Tiefling', description: '+2 Charisma, +1 Intelligence' },
  { id: 'DRAGONBORN', label: 'Dragonborn', description: '+2 Strength, +1 Charisma' },
  { id: 'CUSTOM', label: 'Custom', description: 'Manual bonus setup (legacy / house-rule)' }
];

const uniqueAbilities = (abilities: Ability[]): Ability[] => {
  const seen = new Set<Ability>();
  const output: Ability[] = [];
  abilities.forEach((ability) => {
    if (seen.has(ability)) {
      return;
    }
    seen.add(ability);
    output.push(ability);
  });
  return output;
};

export const createDefaultBackgroundBonusConfig = (): BackgroundBonusConfig => {
  return {
    selectedAbilities: ['STR', 'DEX', 'CON'],
    pattern: 'PLUS_TWO_ONE',
    plusTwoAbility: 'STR',
    plusOneAbility: 'DEX'
  };
};

export const createDefaultLegacyRaceConfig = (): LegacyRaceConfig => {
  return {
    raceId: 'NONE',
    halfElfPlusOneAbilities: ['DEX', 'CON'],
    humanVariantPlusOneAbilities: ['DEX', 'CON'],
    humanVariantFeatId: undefined,
    humanVariantFeatAbility: 'STR',
    customBonuses: [
      { ability: 'STR', amount: 1 },
      { ability: 'DEX', amount: 1 }
    ]
  };
};

export const computeBackgroundBonuses = (config: BackgroundBonusConfig): BonusComputation => {
  const bonuses = createAbilityMap(0);
  const errors: string[] = [];
  const selected = uniqueAbilities(config.selectedAbilities).slice(0, 3);

  if (selected.length !== 3) {
    errors.push('Background mode requires exactly three different abilities.');
  }

  if (config.pattern === 'PLUS_ONE_ALL_THREE') {
    selected.forEach((ability) => {
      bonuses[ability] += 1;
    });
    return {
      bonuses,
      errors
    };
  }

  if (!config.plusTwoAbility || !config.plusOneAbility) {
    errors.push('Background +2/+1 pattern requires selecting both bonus targets.');
    return {
      bonuses,
      errors
    };
  }

  if (!selected.includes(config.plusTwoAbility) || !selected.includes(config.plusOneAbility)) {
    errors.push('Background +2/+1 targets must be chosen from the selected three abilities.');
    return {
      bonuses,
      errors
    };
  }

  if (config.plusTwoAbility === config.plusOneAbility) {
    errors.push('Background +2 and +1 must target different abilities.');
    return {
      bonuses,
      errors
    };
  }

  bonuses[config.plusTwoAbility] += 2;
  bonuses[config.plusOneAbility] += 1;
  return {
    bonuses,
    errors
  };
};

export const computeLegacyRaceBonuses = (config: LegacyRaceConfig): BonusComputation => {
  const bonuses = createAbilityMap(0);
  const errors: string[] = [];

  switch (config.raceId) {
    case 'NONE':
      break;
    case 'HUMAN':
      ABILITIES.forEach((ability) => {
        bonuses[ability] += 1;
      });
      break;
    case 'HUMAN_VARIANT': {
      const picks = uniqueAbilities(config.humanVariantPlusOneAbilities).slice(0, 2);
      if (picks.length !== 2) {
        errors.push('Human Variant requires two different +1 ability selections.');
        break;
      }
      picks.forEach((ability) => {
        bonuses[ability] += 1;
      });
      break;
    }
    case 'DWARF':
      bonuses.CON += 2;
      break;
    case 'ELF':
      bonuses.DEX += 2;
      break;
    case 'HALFLING':
      bonuses.DEX += 2;
      break;
    case 'GNOME':
      bonuses.INT += 2;
      break;
    case 'HALF_ELF': {
      bonuses.CHA += 2;
      const picks = uniqueAbilities(config.halfElfPlusOneAbilities).slice(0, 2);
      if (picks.length !== 2) {
        errors.push('Half-Elf requires two different +1 ability selections.');
        break;
      }
      if (picks.includes('CHA')) {
        errors.push('Half-Elf +1 selections must be different abilities other than Charisma.');
        break;
      }
      picks.forEach((ability) => {
        bonuses[ability] += 1;
      });
      break;
    }
    case 'HALF_ORC':
      bonuses.STR += 2;
      bonuses.CON += 1;
      break;
    case 'TIEFLING':
      bonuses.CHA += 2;
      bonuses.INT += 1;
      break;
    case 'DRAGONBORN':
      bonuses.STR += 2;
      bonuses.CHA += 1;
      break;
    case 'CUSTOM':
      config.customBonuses.slice(0, 3).forEach((bonus) => {
        const amount = Math.max(0, Math.min(3, Math.trunc(bonus.amount)));
        bonuses[bonus.ability] += amount;
      });
      break;
    default:
      errors.push(`Unsupported legacy race mode: ${String(config.raceId)}.`);
      break;
  }

  return {
    bonuses,
    errors
  };
};
