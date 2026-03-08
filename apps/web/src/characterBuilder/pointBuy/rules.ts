import { ABILITIES, ABILITY_LABELS, createAbilityMap, type Ability, type AbilityMap, type AsChoice } from './types';

export const POINT_BUY_BUDGET = 27;
export const BASE_SCORE_MIN = 8;
export const BASE_SCORE_MAX = 15;
export const FINAL_SCORE_CAP = 20;

export const POINT_BUY_COST_TABLE: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9
};

export type PointBuyScoreDetails = {
  score: number;
  cost: number | null;
};

export type PointBuyComputation = {
  perAbility: Record<Ability, PointBuyScoreDetails>;
  spent: number;
  remaining: number;
  errors: string[];
  isValid: boolean;
};

export type AbilityScoreBreakdown = {
  base: number;
  bonus: number;
  asi: number;
  raw: number;
  final: number;
  modifier: number;
};

export type FinalScoreComputation = {
  byAbility: Record<Ability, AbilityScoreBreakdown>;
  asiIncreases: AbilityMap;
  advancement: {
    asi: AbilityMap;
    feat: AbilityMap;
    total: AbilityMap;
  };
  capOverflow: AbilityMap;
  errors: string[];
};

const toInt = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.trunc(value);
};

export const createDefaultBaseScores = (): AbilityMap => {
  return createAbilityMap(BASE_SCORE_MIN);
};

export const getPointCostForScore = (score: number): number | null => {
  const normalized = toInt(score);
  return POINT_BUY_COST_TABLE[normalized] ?? null;
};

export const getModifierForScore = (score: number): number => {
  return Math.floor((score - 10) / 2);
};

export const calculatePointBuy = (baseScores: AbilityMap): PointBuyComputation => {
  const perAbility = {} as Record<Ability, PointBuyScoreDetails>;
  const errors: string[] = [];
  let spent = 0;

  for (const ability of ABILITIES) {
    const score = toInt(baseScores[ability]);
    const cost = getPointCostForScore(score);
    perAbility[ability] = {
      score,
      cost
    };

    if (score < BASE_SCORE_MIN || score > BASE_SCORE_MAX) {
      errors.push(
        `${ABILITY_LABELS[ability]} base score must be between ${BASE_SCORE_MIN} and ${BASE_SCORE_MAX}.`
      );
      continue;
    }

    if (cost === null) {
      errors.push(`${ABILITY_LABELS[ability]} uses an unsupported point-buy score: ${score}.`);
      continue;
    }

    spent += cost;
  }

  const remaining = POINT_BUY_BUDGET - spent;
  if (remaining < 0) {
    errors.push(`Point buy exceeds ${POINT_BUY_BUDGET} points by ${Math.abs(remaining)}.`);
  }

  return {
    perAbility,
    spent,
    remaining,
    errors,
    isValid: errors.length === 0
  };
};

export const createDefaultAsChoice = (): AsChoice => {
  return {
    kind: 'FEAT_NONE'
  };
};

const computeChoiceIncrease = (
  choice: AsChoice,
  index: number
): { asi: AbilityMap; feat: AbilityMap; errors: string[] } => {
  const asi = createAbilityMap(0);
  const feat = createAbilityMap(0);
  const errors: string[] = [];

  if (choice.kind === 'FEAT_NONE') {
    return {
      asi,
      feat,
      errors
    };
  }

  if (choice.kind === 'FEAT_PLUS1') {
    feat[choice.ability] += 1;
    return {
      asi,
      feat,
      errors
    };
  }

  if (choice.plus2) {
    asi[choice.plus2] += 2;
    return {
      asi,
      feat,
      errors
    };
  }

  if (choice.plus1a || choice.plus1b) {
    if (!choice.plus1a || !choice.plus1b) {
      errors.push(`ASI choice ${index + 1} (+1/+1) requires two abilities.`);
      return {
        asi,
        feat,
        errors
      };
    }

    if (choice.plus1a === choice.plus1b) {
      errors.push(`ASI choice ${index + 1} (+1/+1) must target two different abilities.`);
      return {
        asi,
        feat,
        errors
      };
    }

    asi[choice.plus1a] += 1;
    asi[choice.plus1b] += 1;
  }

  return {
    asi,
    feat,
    errors
  };
};

export const computeAsiIncreases = (choices: AsChoice[]): { increases: AbilityMap; errors: string[] } => {
  const increases = createAbilityMap(0);
  const errors: string[] = [];

  choices.forEach((choice, index) => {
    const choiceResult = computeChoiceIncrease(choice, index);
    for (const ability of ABILITIES) {
      increases[ability] += choiceResult.asi[ability] + choiceResult.feat[ability];
    }
    errors.push(...choiceResult.errors);
  });

  return {
    increases,
    errors
  };
};

export const computeFinalScores = (
  baseScores: AbilityMap,
  bonuses: AbilityMap,
  asiChoices: AsChoice[]
): FinalScoreComputation => {
  const byAbility = {} as Record<Ability, AbilityScoreBreakdown>;
  const capOverflow = createAbilityMap(0);
  const errors: string[] = [];
  const advancementAsi = createAbilityMap(0);
  const advancementFeat = createAbilityMap(0);
  const advancementTotal = createAbilityMap(0);

  asiChoices.forEach((choice, index) => {
    const contribution = computeChoiceIncrease(choice, index);
    errors.push(...contribution.errors);
    for (const ability of ABILITIES) {
      advancementAsi[ability] += contribution.asi[ability];
      advancementFeat[ability] += contribution.feat[ability];
      advancementTotal[ability] += contribution.asi[ability] + contribution.feat[ability];
    }
  });

  for (const ability of ABILITIES) {
    const base = toInt(baseScores[ability]);
    const bonus = toInt(bonuses[ability]);
    const asi = toInt(advancementTotal[ability]);
    const raw = base + bonus + asi;
    const final = Math.min(FINAL_SCORE_CAP, raw);
    capOverflow[ability] = Math.max(0, raw - final);

    if (raw > FINAL_SCORE_CAP) {
      errors.push(`${ABILITY_LABELS[ability]} exceeds ${FINAL_SCORE_CAP} and is clamped.`);
    }

    byAbility[ability] = {
      base,
      bonus,
      asi,
      raw,
      final,
      modifier: getModifierForScore(final)
    };
  }

  return {
    byAbility,
    asiIncreases: advancementTotal,
    advancement: {
      asi: advancementAsi,
      feat: advancementFeat,
      total: advancementTotal
    },
    capOverflow,
    errors
  };
};
