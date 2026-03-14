import { useEffect, useMemo, useState } from 'react';

import { getAllClasses } from '../../rules/classes/api/classesData';
import {
  getAllFeats,
  getFeatDetail,
  getFeatAllowedPlusOneAbilities,
  getFeatsWithAbilityIncrease
} from '../../rules/feats/api/featsData';
import type { FeatEntryDetail, FeatEntryMeta } from '../../rules/feats/types';
import {
  computeBackgroundBonuses,
  computeLegacyRaceBonuses,
  createDefaultBackgroundBonusConfig,
  createDefaultLegacyRaceConfig,
  LEGACY_RACE_OPTIONS,
  type BackgroundBonusConfig,
  type BackgroundPattern,
  type BonusMode,
  type LegacyRaceConfig,
  type LegacyRaceId
} from './bonuses';
import {
  getAsiOpportunityInfo,
  getAsiOpportunityInfoForClassDistribution,
  resolvePresetForClassId,
  type AsiProgressionPreset
} from './advancement';
import {
  calculatePointBuy,
  computeFinalScores,
  createDefaultAsChoice,
  createDefaultBaseScores,
  getModifierForScore,
  POINT_BUY_BUDGET
} from './rules';
import { ABILITIES, ABILITY_LABELS, type Ability, type AbilityMap, type AsChoice } from './types';
import { buildPointBuyGuidance } from './guidance';

const STORAGE_KEY = 'characterBuilder.pointBuy.v1';
const LEVEL_MIN = 1;
const LEVEL_MAX = 20;
const BASE_MIN = 8;
const BASE_MAX = 15;

type PointBuyState = {
  baseScores: AbilityMap;
  bonusMode: BonusMode;
  backgroundConfig: BackgroundBonusConfig;
  legacyRaceConfig: LegacyRaceConfig;
  classId: string;
  level: number;
  multiclassEnabled: boolean;
  multiclassClassId: string;
  multiclassClassLevel: number;
  fallbackPreset: AsiProgressionPreset;
  asiChoices: AsChoice[];
};

const isAbility = (value: unknown): value is Ability => {
  return typeof value === 'string' && ABILITIES.includes(value as Ability);
};

const clampInteger = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.trunc(value)));
};

const parseInteger = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sanitizeFeatId = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const formatSignedNumber = (value: number): string => {
  return value >= 0 ? `+${value}` : `${value}`;
};

const formatFeatAbilityIncreaseLabel = (feat: FeatEntryMeta): string => {
  const increase = feat.quickFacts.abilityIncrease;
  if (increase.amount <= 0) {
    return 'No ability increase';
  }

  if (increase.abilities.includes('ALL')) {
    return `+${increase.amount} any ability`;
  }

  return `+${increase.amount} ${increase.abilities.join(', ')}`;
};

const isLikelyTruncatedSummary = (summary: string): boolean => {
  return summary.trim().endsWith('...');
};

const extractFeatFullDescription = (detail: FeatEntryDetail): string => {
  const lines: string[] = [];

  detail.documentBlocks.forEach((block) => {
    if (
      block.type === 'h1' ||
      block.type === 'h2' ||
      block.type === 'h3' ||
      block.type === 'h4' ||
      block.type === 'h5' ||
      block.type === 'h6'
    ) {
      lines.push(block.text.trim());
      return;
    }

    if (block.type === 'p') {
      lines.push(block.text.trim());
      return;
    }

    if (block.type === 'ul') {
      lines.push(block.items.map((item) => `• ${item.trim()}`).join('\n'));
      return;
    }

    if (block.type === 'ol') {
      lines.push(block.items.map((item, index) => `${index + 1}. ${item.trim()}`).join('\n'));
      return;
    }

    if (block.type === 'pre') {
      lines.push(block.lines.join('\n').trim());
      return;
    }

    if (block.type === 'table') {
      const tableText = block.rows
        .map((row) => row.map((cell) => cell.trim()).filter(Boolean).join(' | ').trim())
        .filter(Boolean)
        .join('\n');
      if (tableText.length > 0) {
        lines.push(tableText);
      }
    }
  });

  const fullText = lines.filter(Boolean).join('\n\n').trim();
  return fullText.length > 0 ? fullText : detail.summary;
};

const sanitizeBaseScores = (value: unknown): AbilityMap => {
  const fallback = createDefaultBaseScores();
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const raw = value as Partial<Record<Ability, unknown>>;
  for (const ability of ABILITIES) {
    fallback[ability] = clampInteger(Number(raw[ability]), BASE_MIN, BASE_MAX);
  }
  return fallback;
};

const sanitizeAbilitySelection = (value: unknown, fallback: Ability): Ability => {
  return isAbility(value) ? value : fallback;
};

const sanitizeBackgroundConfig = (value: unknown): BackgroundBonusConfig => {
  const fallback = createDefaultBackgroundBonusConfig();
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const raw = value as Partial<BackgroundBonusConfig>;
  const selectedRaw = Array.isArray(raw.selectedAbilities) ? raw.selectedAbilities : [];
  const selected = selectedRaw
    .map((entry) => (isAbility(entry) ? entry : null))
    .filter((entry): entry is Ability => entry !== null)
    .slice(0, 3);

  for (const ability of ABILITIES) {
    if (selected.length >= 3) {
      break;
    }
    if (!selected.includes(ability)) {
      selected.push(ability);
    }
  }

  const pattern: BackgroundPattern =
    raw.pattern === 'PLUS_ONE_ALL_THREE' ? 'PLUS_ONE_ALL_THREE' : 'PLUS_TWO_ONE';

  const plusTwoFallback = selected[0] ?? fallback.plusTwoAbility ?? 'STR';
  const plusOneFallback =
    selected.find((ability) => ability !== plusTwoFallback) ?? fallback.plusOneAbility ?? 'DEX';

  const plusTwoAbility = sanitizeAbilitySelection(raw.plusTwoAbility, plusTwoFallback);
  const plusOneAbility = sanitizeAbilitySelection(raw.plusOneAbility, plusOneFallback);

  return {
    selectedAbilities: selected,
    pattern,
    plusTwoAbility,
    plusOneAbility
  };
};

const sanitizeLegacyRaceId = (value: unknown): LegacyRaceId => {
  return LEGACY_RACE_OPTIONS.some((entry) => entry.id === value)
    ? (value as LegacyRaceId)
    : 'NONE';
};

const sanitizeLegacyRaceConfig = (value: unknown): LegacyRaceConfig => {
  const fallback = createDefaultLegacyRaceConfig();
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const raw = value as Partial<LegacyRaceConfig>;
  const raceId = sanitizeLegacyRaceId(raw.raceId);

  const halfElfRaw = Array.isArray(raw.halfElfPlusOneAbilities) ? raw.halfElfPlusOneAbilities : [];
  const halfElfPlusOneAbilities = halfElfRaw
    .map((entry) => (isAbility(entry) ? entry : null))
    .filter((entry): entry is Ability => entry !== null && entry !== 'CHA')
    .slice(0, 2);

  const fallbackHalfElf: Ability[] = ['DEX', 'CON'];
  for (const ability of fallbackHalfElf) {
    if (halfElfPlusOneAbilities.length >= 2) {
      break;
    }
    if (!halfElfPlusOneAbilities.includes(ability)) {
      halfElfPlusOneAbilities.push(ability);
    }
  }

  const humanVariantRaw = Array.isArray(raw.humanVariantPlusOneAbilities)
    ? raw.humanVariantPlusOneAbilities
    : [];
  const humanVariantPlusOneAbilities = humanVariantRaw
    .map((entry) => (isAbility(entry) ? entry : null))
    .filter((entry): entry is Ability => entry !== null)
    .slice(0, 2);

  const fallbackHumanVariant: Ability[] = ['DEX', 'CON'];
  for (const ability of fallbackHumanVariant) {
    if (humanVariantPlusOneAbilities.length >= 2) {
      break;
    }
    if (!humanVariantPlusOneAbilities.includes(ability)) {
      humanVariantPlusOneAbilities.push(ability);
    }
  }

  const customRaw = Array.isArray(raw.customBonuses) ? raw.customBonuses : [];
  const customBonuses = customRaw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const candidate = entry as { ability?: unknown; amount?: unknown };
      if (!isAbility(candidate.ability)) {
        return null;
      }
      return {
        ability: candidate.ability,
        amount: clampInteger(Number(candidate.amount), 0, 3)
      };
    })
    .filter((entry): entry is { ability: Ability; amount: number } => entry !== null)
    .slice(0, 3);

  while (customBonuses.length < 3) {
    customBonuses.push({
      ability: ABILITIES[customBonuses.length] ?? 'STR',
      amount: 0
    });
  }

  return {
    raceId,
    halfElfPlusOneAbilities,
    humanVariantPlusOneAbilities,
    humanVariantFeatId: sanitizeFeatId(raw.humanVariantFeatId),
    humanVariantFeatAbility: sanitizeAbilitySelection(raw.humanVariantFeatAbility, 'STR'),
    customBonuses
  };
};

const sanitizeAsChoice = (value: unknown): AsChoice => {
  if (!value || typeof value !== 'object') {
    return createDefaultAsChoice();
  }

  const raw = value as Partial<AsChoice>;
  if (raw.kind === 'FEAT_NONE') {
    const featId = sanitizeFeatId(raw.featId);
    return featId
      ? {
          kind: 'FEAT_NONE',
          featId
        }
      : { kind: 'FEAT_NONE' };
  }

  if (raw.kind === 'FEAT_PLUS1') {
    const featId = sanitizeFeatId(raw.featId);
    return {
      kind: 'FEAT_PLUS1',
      ability: sanitizeAbilitySelection(raw.ability, 'STR'),
      ...(featId ? { featId } : {})
    };
  }

  if (raw.kind === 'ASI') {
    if (isAbility(raw.plus2)) {
      return {
        kind: 'ASI',
        plus2: raw.plus2
      };
    }

    const plus1a = isAbility(raw.plus1a) ? raw.plus1a : 'STR';
    const plus1b = isAbility(raw.plus1b) ? raw.plus1b : plus1a === 'STR' ? 'DEX' : 'STR';
    return {
      kind: 'ASI',
      plus1a,
      plus1b
    };
  }

  return createDefaultAsChoice();
};

const sanitizeAsChoices = (value: unknown): AsChoice[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => sanitizeAsChoice(entry));
};

const sanitizeBonusMode = (value: unknown): BonusMode => {
  return value === 'LEGACY_RACE' ? 'LEGACY_RACE' : 'SRD_BACKGROUND';
};

const sanitizeLevel = (value: unknown): number => {
  return clampInteger(Number(value), LEVEL_MIN, LEVEL_MAX);
};

const sanitizeMulticlassLevel = (value: unknown): number => {
  return clampInteger(Number(value), 0, LEVEL_MAX - 1);
};

const sanitizePreset = (value: unknown, classId: string): AsiProgressionPreset => {
  if (value === 'FIGHTER' || value === 'ROGUE' || value === 'STANDARD') {
    return value;
  }
  return resolvePresetForClassId(classId);
};

const createDefaultState = (): PointBuyState => {
  return {
    baseScores: createDefaultBaseScores(),
    bonusMode: 'SRD_BACKGROUND',
    backgroundConfig: createDefaultBackgroundBonusConfig(),
    legacyRaceConfig: createDefaultLegacyRaceConfig(),
    classId: '',
    level: 1,
    multiclassEnabled: false,
    multiclassClassId: '',
    multiclassClassLevel: 1,
    fallbackPreset: 'STANDARD',
    asiChoices: []
  };
};

const loadStoredState = (): PointBuyState => {
  const fallback = createDefaultState();
  if (typeof window === 'undefined') {
    return fallback;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PointBuyState>;
    const classId =
      typeof parsed.classId === 'string' && parsed.classId.trim().length > 0 ? parsed.classId : '';

    return {
      baseScores: sanitizeBaseScores(parsed.baseScores),
      bonusMode: sanitizeBonusMode(parsed.bonusMode),
      backgroundConfig: sanitizeBackgroundConfig(parsed.backgroundConfig),
      legacyRaceConfig: sanitizeLegacyRaceConfig(parsed.legacyRaceConfig),
      classId,
      level: sanitizeLevel(parsed.level),
      multiclassEnabled: parsed.multiclassEnabled === true,
      multiclassClassId:
        typeof parsed.multiclassClassId === 'string' ? parsed.multiclassClassId.trim() : '',
      multiclassClassLevel: sanitizeMulticlassLevel(parsed.multiclassClassLevel),
      fallbackPreset: sanitizePreset(parsed.fallbackPreset, classId),
      asiChoices: sanitizeAsChoices(parsed.asiChoices)
    };
  } catch {
    return fallback;
  }
};

type PointBuyPreset = {
  id: string;
  label: string;
  description: string;
  values: AbilityMap;
};

const POINT_BUY_PRESETS: PointBuyPreset[] = [
  {
    id: 'balanced',
    label: 'Balanced (Standard Array Shape)',
    description: 'General-purpose spread for many classes.',
    values: {
      STR: 15,
      DEX: 14,
      CON: 13,
      INT: 12,
      WIS: 10,
      CHA: 8
    }
  },
  {
    id: 'physical-focus',
    label: 'Physical Focus',
    description: 'Front-line leaning baseline with strong physical stats.',
    values: {
      STR: 15,
      DEX: 14,
      CON: 14,
      INT: 10,
      WIS: 10,
      CHA: 8
    }
  },
  {
    id: 'caster-focus',
    label: 'Caster Focus',
    description: 'Single-stat caster leaning baseline with survivability.',
    values: {
      STR: 8,
      DEX: 14,
      CON: 14,
      INT: 15,
      WIS: 10,
      CHA: 10
    }
  }
];

const SURFACE_PRIMARY = 'rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-5';
const SURFACE_SECONDARY = 'rounded-2xl border border-slate-800/70 bg-slate-950/45 p-4';
const SURFACE_TERTIARY = 'rounded-xl border border-slate-800/60 bg-slate-950/35 p-3';
const INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-slate-700/80 bg-slate-950/85 px-3 py-2 text-slate-100 outline-none transition focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/40';

export const PointBuyCalculator = () => {
  const classOptions = useMemo(() => {
    return [...getAllClasses()].sort((left, right) => left.name.localeCompare(right.name));
  }, []);
  const classOptionsById = useMemo(() => {
    return new Map(classOptions.map((entry) => [entry.id, entry]));
  }, [classOptions]);
  const featOptions = useMemo(() => {
    return [...getAllFeats()].sort((left, right) => left.name.localeCompare(right.name));
  }, []);
  const plusOneFeatOptions = useMemo(() => {
    return [...getFeatsWithAbilityIncrease()].sort((left, right) => left.name.localeCompare(right.name));
  }, []);
  const featOptionsById = useMemo(() => {
    return new Map(featOptions.map((entry) => [entry.id, entry]));
  }, [featOptions]);

  const [state, setState] = useState<PointBuyState>(() => loadStoredState());
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [expandedFeatDescriptions, setExpandedFeatDescriptions] = useState<Record<string, boolean>>({});
  const [expandedFeatTexts, setExpandedFeatTexts] = useState<Record<string, string>>({});
  const [expandedFeatLoading, setExpandedFeatLoading] = useState<Record<string, boolean>>({});
  const [expandedFeatErrors, setExpandedFeatErrors] = useState<Record<string, string>>({});

  const bonusComputation = useMemo(() => {
    if (state.bonusMode === 'SRD_BACKGROUND') {
      return computeBackgroundBonuses(state.backgroundConfig);
    }

    return computeLegacyRaceBonuses(state.legacyRaceConfig);
  }, [state.bonusMode, state.backgroundConfig, state.legacyRaceConfig]);

  const pointBuyComputation = useMemo(() => calculatePointBuy(state.baseScores), [state.baseScores]);
  const canUseMulticlass = useMemo(() => {
    return (
      state.multiclassEnabled &&
      Boolean(state.classId) &&
      Boolean(state.multiclassClassId) &&
      state.multiclassClassId !== state.classId &&
      state.level > 1
    );
  }, [state.classId, state.level, state.multiclassClassId, state.multiclassEnabled]);
  const effectiveSecondaryLevel = useMemo(() => {
    if (!canUseMulticlass) {
      return 0;
    }
    return clampInteger(state.multiclassClassLevel, 1, Math.max(1, state.level - 1));
  }, [canUseMulticlass, state.level, state.multiclassClassLevel]);
  const effectivePrimaryLevel = useMemo(() => {
    if (!state.classId) {
      return 0;
    }
    return Math.max(1, state.level - effectiveSecondaryLevel);
  }, [effectiveSecondaryLevel, state.classId, state.level]);
  const classDistribution = useMemo(() => {
    if (!state.classId) {
      return [] as { classId: string; className: string; level: number }[];
    }

    const primaryClassName = classOptionsById.get(state.classId)?.name ?? state.classId;
    const distribution: { classId: string; className: string; level: number }[] = [
      {
        classId: state.classId,
        className: primaryClassName,
        level: effectivePrimaryLevel
      }
    ];

    if (canUseMulticlass && state.multiclassClassId && effectiveSecondaryLevel > 0) {
      distribution.push({
        classId: state.multiclassClassId,
        className: classOptionsById.get(state.multiclassClassId)?.name ?? state.multiclassClassId,
        level: effectiveSecondaryLevel
      });
    }

    return distribution;
  }, [
    canUseMulticlass,
    classOptionsById,
    effectivePrimaryLevel,
    effectiveSecondaryLevel,
    state.classId,
    state.multiclassClassId
  ]);
  const asiInfo = useMemo(() => {
    if (classDistribution.length === 0) {
      return {
        count: 0,
        levels: [] as number[],
        slots: [] as { classId: string; className: string; classLevel: number; label: string }[],
        source: 'FALLBACK_PRESET' as const,
        preset: 'STANDARD' as const,
        usesMulticlass: false
      };
    }

    if (classDistribution.length === 1) {
      const singleClass = classDistribution[0];
      if (!singleClass) {
        return {
          count: 0,
          levels: [] as number[],
          slots: [] as { classId: string; className: string; classLevel: number; label: string }[],
          source: 'FALLBACK_PRESET' as const,
          preset: 'STANDARD' as const,
          usesMulticlass: false
        };
      }
      const info = getAsiOpportunityInfo(singleClass.classId, singleClass.level, state.fallbackPreset);
      return {
        ...info,
        slots: info.levels.map((level) => ({
          classId: singleClass.classId,
          className: singleClass.className,
          classLevel: level,
          label: `Level ${level}`
        })),
        usesMulticlass: false
      };
    }

    const multi = getAsiOpportunityInfoForClassDistribution(
      classDistribution.map((entry) => ({
        classId: entry.classId,
        level: entry.level
      })),
      state.fallbackPreset
    );
    return {
      count: multi.count,
      levels: [] as number[],
      slots: multi.slots,
      source: multi.source,
      preset: 'STANDARD' as const,
      usesMulticlass: true
    };
  }, [classDistribution, state.fallbackPreset]);

  const normalizedAsChoices = useMemo(() => {
    return state.asiChoices.map((choice) => {
      if (choice.kind !== 'FEAT_PLUS1') {
        return choice;
      }

      if (!choice.featId) {
        return choice;
      }

      const allowed = getFeatAllowedPlusOneAbilities(choice.featId).filter((ability): ability is Ability =>
        isAbility(ability)
      );
      if (allowed.length === 0) {
        return choice;
      }

      if (allowed.includes(choice.ability)) {
        return choice;
      }

      return {
        ...choice,
        ability: allowed[0] ?? 'STR'
      };
    });
  }, [state.asiChoices]);

  const isHumanVariantActive = useMemo(() => {
    return state.bonusMode === 'LEGACY_RACE' && state.legacyRaceConfig.raceId === 'HUMAN_VARIANT';
  }, [state.bonusMode, state.legacyRaceConfig.raceId]);

  const humanVariantFeatId = useMemo(() => {
    return sanitizeFeatId(state.legacyRaceConfig.humanVariantFeatId);
  }, [state.legacyRaceConfig.humanVariantFeatId]);

  const humanVariantAllowedAbilities = useMemo(() => {
    if (!isHumanVariantActive || !humanVariantFeatId) {
      return [] as Ability[];
    }
    return getFeatAllowedPlusOneAbilities(humanVariantFeatId).filter((ability): ability is Ability =>
      isAbility(ability)
    );
  }, [humanVariantFeatId, isHumanVariantActive]);

  const humanVariantSelectedAbility = useMemo(() => {
    const configured = sanitizeAbilitySelection(state.legacyRaceConfig.humanVariantFeatAbility, 'STR');
    if (humanVariantAllowedAbilities.length === 0) {
      return configured;
    }
    return humanVariantAllowedAbilities.includes(configured)
      ? configured
      : (humanVariantAllowedAbilities[0] ?? 'STR');
  }, [humanVariantAllowedAbilities, state.legacyRaceConfig.humanVariantFeatAbility]);

  const humanVariantFeatChoice = useMemo<AsChoice | null>(() => {
    if (!isHumanVariantActive || !humanVariantFeatId) {
      return null;
    }
    if (humanVariantAllowedAbilities.length === 0) {
      return {
        kind: 'FEAT_NONE',
        featId: humanVariantFeatId
      };
    }
    return {
      kind: 'FEAT_PLUS1',
      featId: humanVariantFeatId,
      ability: humanVariantSelectedAbility
    };
  }, [humanVariantAllowedAbilities.length, humanVariantFeatId, humanVariantSelectedAbility, isHumanVariantActive]);

  const advancementChoices = useMemo(() => {
    if (!humanVariantFeatChoice) {
      return normalizedAsChoices;
    }
    return [humanVariantFeatChoice, ...normalizedAsChoices];
  }, [humanVariantFeatChoice, normalizedAsChoices]);

  const finalScoreComputation = useMemo(() => {
    return computeFinalScores(state.baseScores, bonusComputation.bonuses, advancementChoices);
  }, [advancementChoices, bonusComputation.bonuses, state.baseScores]);

  const totalAsiIncrease = useMemo(() => {
    return ABILITIES.reduce((sum, ability) => sum + finalScoreComputation.asiIncreases[ability], 0);
  }, [finalScoreComputation.asiIncreases]);
  const totalFeatIncrease = useMemo(() => {
    return ABILITIES.reduce((sum, ability) => sum + finalScoreComputation.advancement.feat[ability], 0);
  }, [finalScoreComputation.advancement.feat]);
  const asiSlotLabels = useMemo(() => {
    return asiInfo.slots.map((slot) => slot.label);
  }, [asiInfo.slots]);
  const asiSummaryLabel = useMemo(() => {
    if (asiInfo.count === 0) {
      return 'None yet';
    }
    return asiSlotLabels.join(', ');
  }, [asiInfo.count, asiSlotLabels]);

  const featSelectionErrors = useMemo(() => {
    const errors: string[] = [];

    normalizedAsChoices.forEach((choice, index) => {
      if (choice.kind !== 'FEAT_PLUS1') {
        return;
      }

      const levelLabel = asiSlotLabels[index]
        ? asiSlotLabels[index].toLowerCase()
        : `slot ${index + 1}`;
      if (!choice.featId) {
        errors.push(`Select a feat for ${levelLabel} when using "Feat (+1 ability)".`);
        return;
      }

      const allowed = getFeatAllowedPlusOneAbilities(choice.featId).filter((ability): ability is Ability =>
        isAbility(ability)
      );
      if (allowed.length === 0) {
        errors.push(`Selected feat on ${levelLabel} has no supported ability score increase.`);
        return;
      }
      if (!allowed.includes(choice.ability)) {
        errors.push(`Selected ability for ${levelLabel} does not match the chosen feat.`);
      }
    });

    return errors;
  }, [asiSlotLabels, normalizedAsChoices]);

  const mergedErrors = useMemo(() => {
    return [
      ...pointBuyComputation.errors,
      ...bonusComputation.errors,
      ...finalScoreComputation.errors,
      ...featSelectionErrors
    ];
  }, [pointBuyComputation.errors, bonusComputation.errors, finalScoreComputation.errors, featSelectionErrors]);
  const isBuildValid = mergedErrors.length === 0;
  const selectedClassName = useMemo(() => {
    return classOptionsById.get(state.classId)?.name ?? 'Choose Class';
  }, [classOptionsById, state.classId]);
  const humanVariantFeatMeta = useMemo(() => {
    return humanVariantFeatId ? featOptionsById.get(humanVariantFeatId) ?? null : null;
  }, [featOptionsById, humanVariantFeatId]);
  const unresolvedImprovementSlots = useMemo(() => {
    let count = normalizedAsChoices.reduce((currentCount, choice) => {
      if (choice.kind === 'FEAT_NONE' && !choice.featId) {
        return currentCount + 1;
      }
      if (choice.kind === 'FEAT_PLUS1' && !choice.featId) {
        return currentCount + 1;
      }
      return currentCount;
    }, 0);
    if (isHumanVariantActive && !humanVariantFeatId) {
      count += 1;
    }
    return count;
  }, [humanVariantFeatId, isHumanVariantActive, normalizedAsChoices]);
  const guidanceItems = useMemo(() => {
    return buildPointBuyGuidance({
      classId: state.classId,
      baseScores: state.baseScores,
      pointRemaining: pointBuyComputation.remaining,
      finalComputation: finalScoreComputation,
      classSelected: Boolean(state.classId),
      bonusMode: state.bonusMode,
      legacyRaceSelected:
        state.bonusMode !== 'LEGACY_RACE' || state.legacyRaceConfig.raceId !== 'NONE',
      asiOpportunityCount: asiInfo.count,
      unresolvedImprovementSlots,
      multiclassEnabled: state.multiclassEnabled,
      multiclassPrimaryClassId: state.classId,
      multiclassSecondaryClassId: state.multiclassClassId
    });
  }, [
    asiInfo.count,
    finalScoreComputation,
    state.classId,
    pointBuyComputation.remaining,
    state.baseScores,
    state.bonusMode,
    state.legacyRaceConfig.raceId,
    state.multiclassClassId,
    state.multiclassEnabled,
    unresolvedImprovementSlots
  ]);
  const compactValidationItems = useMemo(() => mergedErrors.slice(0, 4), [mergedErrors]);
  const hasMoreValidationItems = mergedErrors.length > compactValidationItems.length;
  const abilityRows = useMemo(() => {
    return ABILITIES.map((ability) => {
      const pointRow = pointBuyComputation.perAbility[ability];
      const finalRow = finalScoreComputation.byAbility[ability];
      const asiContribution = finalScoreComputation.advancement.asi[ability];
      const featContribution = finalScoreComputation.advancement.feat[ability];
      return {
        ability,
        label: ABILITY_LABELS[ability],
        base: pointRow?.score ?? state.baseScores[ability],
        baseCost: pointRow?.cost,
        baseModifier: getModifierForScore(pointRow?.score ?? state.baseScores[ability]),
        final: finalRow.final,
        finalModifier: finalRow.modifier,
        bonus: finalRow.bonus,
        asi: asiContribution,
        feat: featContribution,
        raw: finalRow.raw,
        capOverflow: finalScoreComputation.capOverflow[ability]
      };
    });
  }, [finalScoreComputation, pointBuyComputation.perAbility, state.baseScores]);

  const classIdSet = useMemo(() => new Set(classOptions.map((entry) => entry.id)), [classOptions]);

  useEffect(() => {
    if (classOptions.length === 0) {
      return;
    }

    if (!state.classId) {
      return;
    }

    if (classIdSet.has(state.classId)) {
      return;
    }

    setState((previous) => ({
      ...previous,
      classId: '',
      multiclassEnabled: false,
      multiclassClassId: '',
      multiclassClassLevel: 1,
      fallbackPreset: 'STANDARD'
    }));
  }, [classIdSet, classOptions.length, state.classId]);

  useEffect(() => {
    if (!state.multiclassClassId) {
      return;
    }

    if (classIdSet.has(state.multiclassClassId)) {
      return;
    }

    setState((previous) => ({
      ...previous,
      multiclassClassId: '',
      multiclassClassLevel: 1
    }));
  }, [classIdSet, state.multiclassClassId]);

  useEffect(() => {
    if (!state.multiclassEnabled) {
      return;
    }

    const maxSecondaryLevel = Math.max(1, state.level - 1);
    if (state.multiclassClassLevel <= maxSecondaryLevel) {
      return;
    }

    setState((previous) => ({
      ...previous,
      multiclassClassLevel: maxSecondaryLevel
    }));
  }, [state.level, state.multiclassClassLevel, state.multiclassEnabled]);

  useEffect(() => {
    setState((previous) => {
      if (previous.asiChoices.length === asiInfo.count) {
        return previous;
      }

      const nextChoices = Array.from({ length: asiInfo.count }, (_, index) => {
        return previous.asiChoices[index] ?? createDefaultAsChoice();
      });

      return {
        ...previous,
        asiChoices: nextChoices
      };
    });
  }, [asiInfo.count]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSavedAt(Date.now());
  }, [state]);

  const updateBaseScore = (ability: Ability, nextScore: number) => {
    setState((previous) => ({
      ...previous,
      baseScores: {
        ...previous.baseScores,
        [ability]: clampInteger(nextScore, BASE_MIN, BASE_MAX)
      }
    }));
  };

  const updateBackgroundConfig = (updater: (config: BackgroundBonusConfig) => BackgroundBonusConfig) => {
    setState((previous) => ({
      ...previous,
      backgroundConfig: updater(previous.backgroundConfig)
    }));
  };

  const updateLegacyRaceConfig = (updater: (config: LegacyRaceConfig) => LegacyRaceConfig) => {
    setState((previous) => ({
      ...previous,
      legacyRaceConfig: updater(previous.legacyRaceConfig)
    }));
  };

  const updateAsChoice = (index: number, nextChoice: AsChoice) => {
    setState((previous) => {
      const nextChoices = [...previous.asiChoices];
      nextChoices[index] = nextChoice;
      return {
        ...previous,
        asiChoices: nextChoices
      };
    });
  };

  const toggleFeatDescription = (feat: FeatEntryMeta) => {
    const isExpanded = Boolean(expandedFeatDescriptions[feat.id]);

    if (!isExpanded && !expandedFeatTexts[feat.id] && !expandedFeatLoading[feat.id]) {
      setExpandedFeatLoading((previous) => ({
        ...previous,
        [feat.id]: true
      }));
      setExpandedFeatErrors((previous) => {
        const next = { ...previous };
        delete next[feat.id];
        return next;
      });
      void getFeatDetail(feat.id)
        .then((detail) => {
          if (!detail) {
            throw new Error('Full feat description is unavailable.');
          }
          setExpandedFeatTexts((previous) => ({
            ...previous,
            [feat.id]: extractFeatFullDescription(detail)
          }));
        })
        .catch((error) => {
          setExpandedFeatErrors((previous) => ({
            ...previous,
            [feat.id]:
              error instanceof Error ? error.message : 'Failed to load full feat description.'
          }));
        })
        .finally(() => {
          setExpandedFeatLoading((previous) => ({
            ...previous,
            [feat.id]: false
          }));
        });
    }

    setExpandedFeatDescriptions((previous) => ({
      ...previous,
      [feat.id]: !isExpanded
    }));
  };

  const handleReset = () => {
    setState(createDefaultState());
  };

  return (
    <section className="space-y-3 lg:space-y-4">
      <header className={SURFACE_PRIMARY}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-sky-300/90">Character Builder</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
              Point Buy Calculator (5e)
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-500/35 bg-emerald-950/20 px-3 py-1 text-xs text-emerald-200">
              Saved locally{savedAt ? ` (${new Date(savedAt).toLocaleTimeString()})` : ''}
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <section className={SURFACE_PRIMARY} aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
          <p className="text-base font-semibold text-slate-100">
            {pointBuyComputation.spent} / {POINT_BUY_BUDGET} points used
          </p>
          <p
            className={`font-medium ${
              pointBuyComputation.remaining < 0 ? 'text-rose-300' : 'text-emerald-300'
            }`}
          >
            {pointBuyComputation.remaining} remaining
          </p>
          <p
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              isBuildValid
                ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-200'
                : 'border-rose-500/55 bg-rose-950/30 text-rose-200'
            }`}
          >
            {isBuildValid ? 'Valid' : 'Invalid'}
          </p>
          <p className="text-xs text-slate-400">Base scores 8-15 | Budget 27</p>
        </div>
      </section>

      <section className={SURFACE_TERTIARY}>
        <details className="rounded-lg border border-slate-800/70 bg-slate-950/55 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-100">Beginner help</summary>
          <p className="mt-1 text-xs text-slate-500">
            Quick refresher for Point Buy basics, bonuses, and ASI/feat choices.
          </p>
          <div className="mt-3 space-y-2">
            <details className="rounded-lg border border-slate-800/70 bg-slate-950/65 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-100">How Point Buy works</summary>
              <p className="mt-2 text-sm text-slate-300">
                Point Buy always starts at 8 in every ability. You then spend from a fixed budget of{' '}
                {POINT_BUY_BUDGET} points to raise those base scores up to a maximum of 15 before any bonuses.
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Costs are not linear: higher scores become more expensive, especially 14 and 15. This calculator
                updates spent/remaining points live so you can immediately see whether your setup is valid.
              </p>
            </details>
            <details className="rounded-lg border border-slate-800/70 bg-slate-950/65 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-100">
                Why odd and even scores matter
              </summary>
              <p className="mt-2 text-sm text-slate-300">
                Ability modifiers increase on even totals (10, 12, 14, 16, 18, 20). That means a 13 gives the same
                modifier as a 12 until you gain another +1 later.
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Because of that, odd scores are often temporary stepping stones. They can be strong when you plan a
                near-future +1 from background bonuses, an ASI split (+1/+1), or a feat that grants +1.
              </p>
            </details>
            <details className="rounded-lg border border-slate-800/70 bg-slate-950/65 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-100">
                How bonuses are applied
              </summary>
              <p className="mt-2 text-sm text-slate-300">
                Choose exactly one bonus mode at a time: SRD 5.2 Background bonuses or Legacy race bonuses. These
                bonuses are added after base Point Buy scores are set.
              </p>
              <p className="mt-2 text-sm text-slate-300">
                The final cap of 20 still applies after all bonuses and later improvements. If a combination would go
                above 20, the overflow is shown in the notes so you can reallocate points efficiently.
              </p>
            </details>
            <details className="rounded-lg border border-slate-800/70 bg-slate-950/65 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-100">
                ASI vs feat (+1) and what the difference is
              </summary>
              <p className="mt-2 text-sm text-slate-300">
                <strong>ASI</strong> means <strong>Ability Score Improvement</strong>: either +2 to one ability or +1
                to two different abilities. This is the most direct way to raise core stats.
              </p>
              <p className="mt-2 text-sm text-slate-300">
                <strong>Feats</strong> usually grant special features, and only some feats also provide +1 to an
                ability. In this calculator, feat effects are tracked only for score changes; non-score feature text
                is shown for reference.
              </p>
            </details>
          </div>
        </details>
      </section>

      {compactValidationItems.length > 0 ? (
        <section className="rounded-xl border border-rose-500/45 bg-rose-950/25 p-3.5">
          <h3 className="text-sm font-semibold text-rose-100">Validation and caps</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-100/85">
            {compactValidationItems.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
          {hasMoreValidationItems ? (
            <p className="mt-2 text-xs text-rose-100/80">
              Additional messages are listed in the final breakdown section.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className={SURFACE_SECONDARY}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-100">Guidance</h3>
          <p className="text-xs text-slate-500">Class-aware and efficiency hints</p>
        </div>
        {guidanceItems.length > 0 ? (
          <>
            <ul className="mt-2.5 space-y-1.5">
              {guidanceItems.map((hint, index) => (
                <li
                  key={hint.id}
                  className={`rounded-lg border px-3 py-2 text-sm leading-5 ${
                    hint.severity === 'warning' && index === 0
                      ? 'border-amber-500/45 bg-amber-950/25 text-amber-100'
                      : 'border-slate-700/70 bg-slate-950/55 text-slate-300'
                  }`}
                >
                  {hint.text}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2.5 rounded-lg border border-slate-700/70 bg-slate-950/55 px-3 py-2 text-sm text-slate-300">
            No unusual choices detected for this setup.
          </p>
        )}
      </section>

      <section className={SURFACE_PRIMARY}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Ability scores</h3>
            <p className="text-sm text-slate-400">
              Core point-buy editing with immediate final-score feedback.
            </p>
          </div>
        </div>

        <div className="mt-3.5 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {abilityRows.map((row) => (
            <article
              key={`ability-${row.ability}`}
              className={`rounded-xl border p-4 ${
                row.capOverflow > 0
                  ? 'border-amber-500/60 bg-amber-950/20'
                  : 'border-slate-800/80 bg-slate-950/65'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{row.ability}</p>
                  <p className="text-lg font-semibold text-slate-100">{row.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Final</p>
                  <p className="text-3xl font-semibold leading-none text-slate-100">{row.final}</p>
                  <p className="mt-1 text-sm text-slate-400">Mod {formatSignedNumber(row.finalModifier)}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Decrease ${row.label} base score`}
                  onClick={() => updateBaseScore(row.ability, row.base - 1)}
                  className="h-10 w-10 rounded-md border border-slate-700/80 bg-slate-900 text-lg text-slate-100 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/35"
                >
                  -
                </button>
                <div
                  aria-label={`${row.label} base score`}
                  aria-live="polite"
                  className="flex h-10 w-20 items-center justify-center rounded-md border border-slate-700/80 bg-slate-950 px-2 text-center text-xl font-semibold text-slate-100"
                >
                  {row.base}
                </div>
                <button
                  type="button"
                  aria-label={`Increase ${row.label} base score`}
                  onClick={() => updateBaseScore(row.ability, row.base + 1)}
                  className="h-10 w-10 rounded-md border border-slate-700/80 bg-slate-900 text-lg text-slate-100 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/35"
                >
                  +
                </button>
                <div className="ml-auto text-right text-sm text-slate-400">
                  <p>Cost {row.baseCost ?? '-'}</p>
                  <p>Base mod {formatSignedNumber(row.baseModifier)}</p>
                </div>
              </div>

              <details className="mt-3 rounded-lg border border-slate-800/80 bg-slate-900/55 px-3 py-2.5 text-sm text-slate-400">
                <summary className="cursor-pointer font-medium text-slate-300">Details</summary>
                <div className="mt-2 space-y-1">
                  <p>Base: {row.base}</p>
                  <p>Bonus: {formatSignedNumber(row.bonus)}</p>
                  <p>ASI: {formatSignedNumber(row.asi)}</p>
                  <p>Feat: {formatSignedNumber(row.feat)}</p>
                  <p>Raw total: {row.raw}</p>
                  <p className={row.capOverflow > 0 ? 'text-amber-200' : 'text-slate-400'}>
                    Final: {row.final}
                    {row.capOverflow > 0 ? ` (capped, overflow ${row.capOverflow})` : ''}
                  </p>
                </div>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section className={SURFACE_SECONDARY}>
        <h3 className="text-lg font-semibold text-slate-100">Build setup</h3>
        <p className="mt-1 text-sm text-slate-400">
          Configure class and level first.
        </p>
        <p className="mt-1 text-xs text-slate-500">Current class: {selectedClassName}</p>
        <h4 className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Class and level</h4>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-300">
            Class
            <select
              value={state.classId}
              onChange={(event) =>
                setState((previous) => ({
                  ...previous,
                  classId: event.target.value,
                  multiclassClassId:
                    previous.multiclassClassId === event.target.value ? '' : previous.multiclassClassId,
                  fallbackPreset: event.target.value
                    ? resolvePresetForClassId(event.target.value)
                    : 'STANDARD'
                }))
              }
              className={INPUT_CLASS}
            >
              <option value="">Choose Class</option>
              {classOptions.map((entry) => (
                <option key={`class-option-${entry.id}`} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-300">
            Character level
            <input
              type="number"
              min={LEVEL_MIN}
              max={LEVEL_MAX}
              value={state.level}
              onChange={(event) =>
                setState((previous) => ({
                  ...previous,
                  level: sanitizeLevel(parseInteger(event.target.value))
                }))
              }
              className={INPUT_CLASS}
            />
          </label>

        </div>

        <div className="mt-3 rounded-xl border border-slate-800/70 bg-slate-950/60 p-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={state.multiclassEnabled}
              disabled={!state.classId || state.level <= 1}
              onChange={(event) =>
                setState((previous) => ({
                  ...previous,
                  multiclassEnabled: event.target.checked,
                  multiclassClassLevel: clampInteger(
                    previous.multiclassClassLevel,
                    1,
                    Math.max(1, previous.level - 1)
                  )
                }))
              }
              className="h-4 w-4 rounded border-slate-500 bg-slate-950 text-sky-400 focus:ring-sky-500/35 disabled:opacity-60"
            />
            Enable multiclass split
          </label>
          <p className="mt-1 text-xs text-slate-500">
            ASI / Feat opportunities are counted per class level progression when multiclass is enabled.
          </p>

          {state.multiclassEnabled ? (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="text-sm text-slate-300">
                Secondary class
                <select
                  value={state.multiclassClassId}
                  onChange={(event) =>
                    setState((previous) => ({
                      ...previous,
                      multiclassClassId: event.target.value
                    }))
                  }
                  className={INPUT_CLASS}
                >
                  <option value="">Choose secondary class</option>
                  {classOptions
                    .filter((entry) => entry.id !== state.classId)
                    .map((entry) => (
                      <option key={`secondary-class-option-${entry.id}`} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="text-sm text-slate-300">
                Secondary class level
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, state.level - 1)}
                  value={effectiveSecondaryLevel > 0 ? effectiveSecondaryLevel : 1}
                  onChange={(event) =>
                    setState((previous) => ({
                      ...previous,
                      multiclassClassLevel: clampInteger(
                        parseInteger(event.target.value),
                        1,
                        Math.max(1, previous.level - 1)
                      )
                    }))
                  }
                  disabled={!state.multiclassClassId || !state.classId || state.level <= 1}
                  className={INPUT_CLASS}
                />
              </label>

              <label className="text-sm text-slate-300">
                Secondary level slider
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, state.level - 1)}
                  value={effectiveSecondaryLevel > 0 ? effectiveSecondaryLevel : 1}
                  onChange={(event) =>
                    setState((previous) => ({
                      ...previous,
                      multiclassClassLevel: clampInteger(
                        parseInteger(event.target.value),
                        1,
                        Math.max(1, previous.level - 1)
                      )
                    }))
                  }
                  disabled={!state.multiclassClassId || !state.classId || state.level <= 1}
                  className="mt-3 w-full accent-sky-400 disabled:opacity-60"
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="mt-3 rounded-xl border border-slate-800/70 bg-slate-950/60 p-3 text-sm text-slate-300">
          {state.classId ? (
            <>
              <p className="text-xs text-slate-500">
                Class distribution:{' '}
                <span className="text-slate-300">
                  {classDistribution.map((entry) => `${entry.className} ${entry.level}`).join(' + ')}
                </span>
              </p>
              <p>
                ASI / Feat opportunities at this level:{' '}
                <span className="font-semibold text-slate-100">{asiInfo.count}</span>
              </p>
              <p className="mt-1">
                Levels:{' '}
                <span className="text-slate-100">{asiSummaryLabel}</span>
              </p>
              {state.multiclassEnabled && !state.multiclassClassId ? (
                <p className="mt-2 text-xs text-amber-200">
                  Select a secondary class to complete the multiclass split.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-amber-200">
              Select a class to unlock class-aware ASI / Feat opportunities.
            </p>
          )}
          {state.classId && !asiInfo.usesMulticlass && asiInfo.source === 'FALLBACK_PRESET' ? (
            <label className="mt-3 block text-sm text-slate-300">
              Progression preset (fallback)
              <select
                value={state.fallbackPreset}
                onChange={(event) =>
                  setState((previous) => ({
                    ...previous,
                    fallbackPreset:
                      event.target.value === 'FIGHTER' || event.target.value === 'ROGUE'
                        ? event.target.value
                        : 'STANDARD'
                  }))
                }
                className="mt-1 w-full rounded-lg border border-amber-600/35 bg-amber-950/15 px-3 py-2 text-amber-100 outline-none transition focus:border-amber-400 focus:ring-1 focus:ring-amber-500/35 md:max-w-xs"
              >
                <option value="STANDARD">Standard (4, 8, 12, 16, 19)</option>
                <option value="FIGHTER">Fighter (4, 6, 8, 12, 14, 16, 19)</option>
                <option value="ROGUE">Rogue (4, 8, 10, 12, 16, 19)</option>
              </select>
            </label>
          ) : null}
        </div>

      </section>

      <section className={SURFACE_SECONDARY}>
        <h3 className="text-lg font-semibold text-slate-100">Bonus mode</h3>
        <p className="mt-1 text-sm text-slate-400">
          Exactly one mode is active. Bonuses apply after base scores and before the final cap.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setState((previous) => ({
                ...previous,
                bonusMode: 'SRD_BACKGROUND'
              }))
            }
            className={`rounded-full border px-3 py-1 text-xs transition focus:outline-none focus:ring-2 focus:ring-sky-500/35 ${
              state.bonusMode === 'SRD_BACKGROUND'
                ? 'border-sky-500/70 bg-sky-950/25 text-sky-200'
                : 'border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-slate-500'
            }`}
          >
            SRD 5.2 Background bonuses
          </button>
          <button
            type="button"
            onClick={() =>
              setState((previous) => ({
                ...previous,
                bonusMode: 'LEGACY_RACE'
              }))
            }
            className={`rounded-full border px-3 py-1 text-xs transition focus:outline-none focus:ring-2 focus:ring-sky-500/35 ${
              state.bonusMode === 'LEGACY_RACE'
                ? 'border-sky-500/70 bg-sky-950/25 text-sky-200'
                : 'border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-slate-500'
            }`}
          >
            Legacy Race bonuses
          </button>
        </div>

        {state.bonusMode === 'SRD_BACKGROUND' ? (
          <div className="mt-4 grid gap-3 rounded-xl border border-slate-800/70 bg-slate-950/60 p-3 md:grid-cols-3">
            <p className="md:col-span-3 text-xs text-slate-500">
              Pick 3 background abilities, then choose either +2/+1 or +1/+1/+1.
            </p>
            {state.backgroundConfig.selectedAbilities.map((selectedAbility, index) => (
              <label key={`bg-select-${index}`} className="text-sm text-slate-300">
                Background ability {index + 1}
                <select
                  value={selectedAbility}
                  onChange={(event) =>
                    updateBackgroundConfig((current) => {
                      const next = [...current.selectedAbilities];
                      next[index] = sanitizeAbilitySelection(event.target.value, selectedAbility);
                      return {
                        ...current,
                        selectedAbilities: next
                      };
                    })
                  }
                  className={INPUT_CLASS}
                >
                  {ABILITIES.map((ability) => (
                    <option key={`bg-option-${index}-${ability}`} value={ability}>
                      {ability} - {ABILITY_LABELS[ability]}
                    </option>
                  ))}
                </select>
              </label>
            ))}

            <label className="mt-2 block text-sm text-slate-300">
              Bonus pattern
              <select
                value={state.backgroundConfig.pattern}
                onChange={(event) =>
                  updateBackgroundConfig((current) => ({
                    ...current,
                    pattern:
                      event.target.value === 'PLUS_ONE_ALL_THREE'
                        ? 'PLUS_ONE_ALL_THREE'
                        : 'PLUS_TWO_ONE'
                  }))
                }
                className={INPUT_CLASS}
              >
                <option value="PLUS_TWO_ONE">+2 to one and +1 to a different one</option>
                <option value="PLUS_ONE_ALL_THREE">+1 to all three selected abilities</option>
              </select>
            </label>

            {state.backgroundConfig.pattern === 'PLUS_TWO_ONE' ? (
              <>
                <label className="text-sm text-slate-300">
                  +2 ability
                  <select
                    value={state.backgroundConfig.plusTwoAbility ?? 'STR'}
                    onChange={(event) =>
                      updateBackgroundConfig((current) => ({
                        ...current,
                        plusTwoAbility: sanitizeAbilitySelection(event.target.value, 'STR')
                      }))
                    }
                    className={INPUT_CLASS}
                  >
                    {state.backgroundConfig.selectedAbilities.map((ability) => (
                      <option key={`bg-plus-two-${ability}`} value={ability}>
                        {ability} - {ABILITY_LABELS[ability]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-300">
                  +1 ability
                  <select
                    value={state.backgroundConfig.plusOneAbility ?? 'DEX'}
                    onChange={(event) =>
                      updateBackgroundConfig((current) => ({
                        ...current,
                        plusOneAbility: sanitizeAbilitySelection(event.target.value, 'DEX')
                      }))
                    }
                    className={INPUT_CLASS}
                  >
                    {state.backgroundConfig.selectedAbilities.map((ability) => (
                      <option key={`bg-plus-one-${ability}`} value={ability}>
                        {ability} - {ABILITY_LABELS[ability]}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-800/70 bg-slate-950/60 p-3">
            <p className="text-xs text-slate-500">
              Legacy mode for race-based bonuses (optional, non-SRD 5.2 flow).
            </p>
            <label className="text-sm text-slate-300">
              Legacy race
              <select
                value={state.legacyRaceConfig.raceId}
                onChange={(event) =>
                  updateLegacyRaceConfig((current) => ({
                    ...current,
                    raceId: sanitizeLegacyRaceId(event.target.value)
                  }))
                }
                className={`${INPUT_CLASS} md:max-w-sm`}
              >
                {LEGACY_RACE_OPTIONS.map((option) => (
                  <option key={`legacy-race-${option.id}`} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs text-slate-500">
              {
                LEGACY_RACE_OPTIONS.find((option) => option.id === state.legacyRaceConfig.raceId)
                  ?.description
              }
            </p>

            {state.legacyRaceConfig.raceId === 'HALF_ELF' ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[0, 1].map((index) => (
                  <label key={`half-elf-${index}`} className="text-sm text-slate-300">
                    Half-Elf +1 ability {index + 1}
                    <select
                      value={state.legacyRaceConfig.halfElfPlusOneAbilities[index] ?? 'DEX'}
                      onChange={(event) =>
                        updateLegacyRaceConfig((current) => {
                          const next = [...current.halfElfPlusOneAbilities];
                          next[index] = sanitizeAbilitySelection(event.target.value, 'DEX');
                          return {
                            ...current,
                            halfElfPlusOneAbilities: next
                          };
                        })
                      }
                      className={INPUT_CLASS}
                    >
                      {ABILITIES.filter((ability) => ability !== 'CHA').map((ability) => (
                        <option key={`half-elf-option-${index}-${ability}`} value={ability}>
                          {ability} - {ABILITY_LABELS[ability]}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            ) : null}

            {state.legacyRaceConfig.raceId === 'HUMAN_VARIANT' ? (
              <div className="mt-3 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {[0, 1].map((index) => (
                    <label key={`human-variant-${index}`} className="text-sm text-slate-300">
                      Human Variant +1 ability {index + 1}
                      <select
                        value={state.legacyRaceConfig.humanVariantPlusOneAbilities[index] ?? 'DEX'}
                        onChange={(event) =>
                          updateLegacyRaceConfig((current) => {
                            const next = [...current.humanVariantPlusOneAbilities];
                            next[index] = sanitizeAbilitySelection(event.target.value, 'DEX');
                            return {
                              ...current,
                              humanVariantPlusOneAbilities: next
                            };
                          })
                        }
                        className={INPUT_CLASS}
                      >
                        {ABILITIES.map((ability) => (
                          <option key={`human-variant-option-${index}-${ability}`} value={ability}>
                            {ability} - {ABILITY_LABELS[ability]}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                <div className="rounded-lg border border-slate-800/70 bg-slate-900/45 p-3">
                  <p className="text-xs text-slate-500">
                    Variant Human also grants one feat at level 1 (if feats are allowed). Skill proficiency is tracked outside this Point Buy calculator.
                  </p>
                  <label className="mt-2 block text-sm text-slate-300 md:max-w-xl">
                    Variant Human feat
                    <select
                      value={state.legacyRaceConfig.humanVariantFeatId ?? ''}
                      onChange={(event) =>
                        updateLegacyRaceConfig((current) => {
                          const nextFeatId = sanitizeFeatId(event.target.value);
                          const allowed = nextFeatId
                            ? getFeatAllowedPlusOneAbilities(nextFeatId).filter((ability): ability is Ability =>
                                isAbility(ability)
                              )
                            : [];
                          const currentAbility = sanitizeAbilitySelection(
                            current.humanVariantFeatAbility,
                            'STR'
                          );
                          const nextAbility = allowed.includes(currentAbility)
                            ? currentAbility
                            : (allowed[0] ?? currentAbility);
                          return {
                            ...current,
                            humanVariantFeatId: nextFeatId,
                            humanVariantFeatAbility: nextAbility
                          };
                        })
                      }
                      className={INPUT_CLASS}
                    >
                      <option value="">Select feat...</option>
                      {featOptions.map((feat) => (
                        <option key={`human-variant-feat-${feat.id}`} value={feat.id}>
                          {feat.name} ({feat.quickFacts.source ?? 'Unknown source'})
                        </option>
                      ))}
                    </select>
                  </label>

                  {humanVariantAllowedAbilities.length > 0 ? (
                    <label className="mt-3 block text-sm text-slate-300 md:max-w-xs">
                      Variant Human feat +1 ability
                      <select
                        value={humanVariantSelectedAbility}
                        onChange={(event) =>
                          updateLegacyRaceConfig((current) => ({
                            ...current,
                            humanVariantFeatAbility: sanitizeAbilitySelection(event.target.value, 'STR')
                          }))
                        }
                        disabled={humanVariantAllowedAbilities.length === 1}
                        className={`${INPUT_CLASS} disabled:opacity-70`}
                      >
                        {humanVariantAllowedAbilities.map((ability) => (
                          <option key={`human-variant-feat-ability-${ability}`} value={ability}>
                            {ability} - {ABILITY_LABELS[ability]}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {humanVariantFeatMeta ? (
                    <div className="mt-3 rounded-lg border border-slate-800/70 bg-slate-950/50 p-3">
                      <p className="text-sm font-semibold text-slate-100">{humanVariantFeatMeta.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {humanVariantFeatMeta.quickFacts.source ?? 'Unknown source'}
                        {humanVariantFeatMeta.quickFacts.prerequisite
                          ? ` - Prerequisite: ${humanVariantFeatMeta.quickFacts.prerequisite}`
                          : ''}
                      </p>
                      <p className="mt-2 whitespace-pre-line text-sm text-slate-300">
                        {expandedFeatDescriptions[humanVariantFeatMeta.id]
                          ? (expandedFeatTexts[humanVariantFeatMeta.id] ?? humanVariantFeatMeta.summary)
                          : humanVariantFeatMeta.summary}
                      </p>
                      {(isLikelyTruncatedSummary(humanVariantFeatMeta.summary) ||
                        expandedFeatDescriptions[humanVariantFeatMeta.id]) ? (
                        <div className="mt-2 space-y-1">
                          <button
                            type="button"
                            onClick={() => toggleFeatDescription(humanVariantFeatMeta)}
                            className="text-xs font-medium text-sky-300 transition hover:text-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500/35"
                          >
                            {expandedFeatDescriptions[humanVariantFeatMeta.id]
                              ? 'Show less'
                              : 'Show full description'}
                          </button>
                          {expandedFeatLoading[humanVariantFeatMeta.id] ? (
                            <p className="text-xs text-slate-500">Loading full description...</p>
                          ) : null}
                          {expandedFeatErrors[humanVariantFeatMeta.id] ? (
                            <p className="text-xs text-rose-300">
                              {expandedFeatErrors[humanVariantFeatMeta.id]}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {state.legacyRaceConfig.raceId === 'CUSTOM' ? (
              <div className="mt-3 grid gap-2">
                {state.legacyRaceConfig.customBonuses.map((customBonus, index) => (
                  <div
                    key={`custom-bonus-${index}`}
                    className="grid gap-2 rounded-lg border border-slate-800/70 bg-slate-900/45 p-2 sm:grid-cols-[minmax(0,1fr)_120px]"
                  >
                    <label className="text-sm text-slate-300">
                      Ability
                      <select
                        value={customBonus.ability}
                        onChange={(event) =>
                          updateLegacyRaceConfig((current) => {
                            const next = [...current.customBonuses];
                            const existing = next[index] ?? {
                              ability: customBonus.ability,
                              amount: customBonus.amount
                            };
                            next[index] = {
                              ...existing,
                              ability: sanitizeAbilitySelection(event.target.value, 'STR')
                            };
                            return {
                              ...current,
                              customBonuses: next
                            };
                          })
                        }
                        className={INPUT_CLASS}
                      >
                        {ABILITIES.map((ability) => (
                          <option key={`custom-${index}-${ability}`} value={ability}>
                            {ability} - {ABILITY_LABELS[ability]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-slate-300">
                      Bonus
                      <input
                        type="number"
                        min={0}
                        max={3}
                        value={customBonus.amount}
                        onChange={(event) =>
                          updateLegacyRaceConfig((current) => {
                            const next = [...current.customBonuses];
                            const existing = next[index] ?? {
                              ability: customBonus.ability,
                              amount: customBonus.amount
                            };
                            next[index] = {
                              ...existing,
                              amount: clampInteger(parseInteger(event.target.value), 0, 3)
                            };
                            return {
                              ...current,
                              customBonuses: next
                            };
                          })
                        }
                        className={INPUT_CLASS}
                      />
                    </label>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>

      {asiInfo.count > 0 ? (
      <section className={SURFACE_SECONDARY}>
        <h3 className="text-lg font-semibold text-slate-100">ASI / Feat allocation</h3>
        <p className="mt-1 text-sm text-slate-400">
          Choose what you gain at each improvement level.
        </p>
        <div className="mt-3 grid gap-3">
            {state.asiChoices.map((choice, index) => {
              const normalizedChoice = normalizedAsChoices[index] ?? choice;
              const levelLabel = asiSlotLabels[index] ?? `Slot ${index + 1}`;
              const slotLabel = asiSlotLabels[index]
                ? `${asiSlotLabels[index]} improvement`
                : `Improvement slot ${index + 1}`;
              const asiMode =
                normalizedChoice.kind === 'ASI' && normalizedChoice.plus2
                  ? 'PLUS2'
                  : normalizedChoice.kind === 'ASI'
                    ? 'PLUS_ONE_ONE'
                    : null;
              const selectedFeatMeta =
                normalizedChoice.kind === 'FEAT_NONE' || normalizedChoice.kind === 'FEAT_PLUS1'
                  ? featOptionsById.get(normalizedChoice.featId ?? '')
                  : null;
              const allowedFeatAbilities =
                normalizedChoice.kind === 'FEAT_PLUS1' && normalizedChoice.featId
                  ? getFeatAllowedPlusOneAbilities(normalizedChoice.featId).filter((ability): ability is Ability =>
                      isAbility(ability)
                    )
                  : [...ABILITIES];
              const displayedFeatAbilities =
                allowedFeatAbilities.length > 0 ? allowedFeatAbilities : [...ABILITIES];
              const isFixedFeatAbility = Boolean(
                normalizedChoice.kind === 'FEAT_PLUS1' &&
                  normalizedChoice.featId &&
                  allowedFeatAbilities.length === 1
              );

              return (
                <article
                  key={`asi-choice-${index}`}
                  className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-100">{slotLabel}</p>
                    <label className="text-xs text-slate-500">
                      Type
                      <select
                        aria-label={`${slotLabel} type`}
                        value={normalizedChoice.kind}
                        onChange={(event) => {
                        if (event.target.value === 'ASI') {
                          updateAsChoice(index, { kind: 'ASI', plus2: 'STR' });
                          return;
                        }

                        if (event.target.value === 'FEAT_PLUS1') {
                          const defaultFeat = plusOneFeatOptions[0];
                          const defaultFeatId = defaultFeat?.id;
                          const allowed = defaultFeatId
                            ? getFeatAllowedPlusOneAbilities(defaultFeatId).filter((ability): ability is Ability =>
                                isAbility(ability)
                              )
                            : [];
                          const nextAbility: Ability = allowed[0] ?? 'STR';
                          updateAsChoice(index, {
                            kind: 'FEAT_PLUS1',
                            ability: nextAbility,
                            ...(defaultFeatId ? { featId: defaultFeatId } : {})
                          });
                          return;
                        }

                        const defaultFeat = featOptions[0];
                        updateAsChoice(index, {
                          kind: 'FEAT_NONE',
                          ...(defaultFeat ? { featId: defaultFeat.id } : {})
                        });
                        }}
                        className="ml-2 rounded-lg border border-slate-700/80 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 outline-none transition focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/35"
                      >
                        <option value="ASI">Ability Score Improvement</option>
                        <option value="FEAT_NONE">Feat (no ASI)</option>
                        <option value="FEAT_PLUS1">Feat (+1 ability)</option>
                      </select>
                    </label>
                  </div>

                  {normalizedChoice.kind === 'ASI' ? (
                    <div className="mt-3 grid gap-3">
                      <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name={`asi-mode-${index}`}
                            checked={asiMode === 'PLUS2'}
                            onChange={() =>
                              updateAsChoice(index, {
                                kind: 'ASI',
                                plus2:
                                  normalizedChoice.kind === 'ASI' && isAbility(normalizedChoice.plus1a)
                                    ? normalizedChoice.plus1a
                                    : 'STR'
                              })
                            }
                            className="h-4 w-4 border-slate-500 bg-slate-950 text-sky-400 focus:ring-sky-500/35"
                          />
                          +2 to one ability
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name={`asi-mode-${index}`}
                            checked={asiMode === 'PLUS_ONE_ONE'}
                            onChange={() =>
                              updateAsChoice(index, {
                                kind: 'ASI',
                                plus1a:
                                  normalizedChoice.kind === 'ASI' && isAbility(normalizedChoice.plus2)
                                    ? normalizedChoice.plus2
                                    : 'STR',
                                plus1b: 'DEX'
                              })
                            }
                            className="h-4 w-4 border-slate-500 bg-slate-950 text-sky-400 focus:ring-sky-500/35"
                          />
                          +1 / +1 to two abilities
                        </label>
                      </div>

                      {asiMode === 'PLUS2' ? (
                        <label className="text-sm text-slate-300 md:max-w-xs">
                          +2 ability
                          <select
                            value={normalizedChoice.plus2 ?? 'STR'}
                            onChange={(event) =>
                              updateAsChoice(index, {
                                kind: 'ASI',
                                plus2: sanitizeAbilitySelection(event.target.value, 'STR')
                              })
                            }
                            className={INPUT_CLASS}
                          >
                            {ABILITIES.map((ability) => (
                              <option key={`asi-plus2-${index}-${ability}`} value={ability}>
                                {ability} - {ABILITY_LABELS[ability]}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="text-sm text-slate-300">
                            First +1 ability
                            <select
                              value={normalizedChoice.plus1a ?? 'STR'}
                              onChange={(event) =>
                                updateAsChoice(index, {
                                  kind: 'ASI',
                                  plus1a: sanitizeAbilitySelection(event.target.value, 'STR'),
                                  plus1b: normalizedChoice.plus1b ?? 'DEX'
                                })
                              }
                              className={INPUT_CLASS}
                            >
                              {ABILITIES.map((ability) => (
                                <option key={`asi-plus1a-${index}-${ability}`} value={ability}>
                                  {ability} - {ABILITY_LABELS[ability]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm text-slate-300">
                            Second +1 ability
                            <select
                              value={normalizedChoice.plus1b ?? 'DEX'}
                              onChange={(event) =>
                                updateAsChoice(index, {
                                  kind: 'ASI',
                                  plus1a: normalizedChoice.plus1a ?? 'STR',
                                  plus1b: sanitizeAbilitySelection(event.target.value, 'DEX')
                                })
                              }
                              className={INPUT_CLASS}
                            >
                              {ABILITIES.map((ability) => (
                                <option key={`asi-plus1b-${index}-${ability}`} value={ability}>
                                  {ability} - {ABILITY_LABELS[ability]}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {normalizedChoice.kind === 'FEAT_NONE' ? (
                    <label className="mt-3 block text-sm text-slate-300 md:max-w-xl">
                      Feat selection
                      <select
                        value={normalizedChoice.featId ?? ''}
                        onChange={(event) => {
                          const nextFeatId = sanitizeFeatId(event.target.value);
                          updateAsChoice(index, {
                            kind: 'FEAT_NONE',
                            ...(nextFeatId ? { featId: nextFeatId } : {})
                          });
                        }}
                        className={INPUT_CLASS}
                      >
                        <option value="">Select feat...</option>
                        {featOptions.map((feat) => (
                          <option key={`feat-none-${index}-${feat.id}`} value={feat.id}>
                            {feat.name} ({feat.quickFacts.source ?? 'Unknown source'})
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {normalizedChoice.kind === 'FEAT_PLUS1' ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="text-sm text-slate-300">
                        Feat (+1 ability)
                        <select
                          value={normalizedChoice.featId ?? ''}
                          onChange={(event) => {
                            const nextFeatId = sanitizeFeatId(event.target.value);
                            const allowed = nextFeatId
                              ? getFeatAllowedPlusOneAbilities(nextFeatId).filter((ability): ability is Ability =>
                                  isAbility(ability)
                                )
                              : [...ABILITIES];
                            const currentAbility: Ability = normalizedChoice.ability ?? 'STR';
                            const nextAbility: Ability =
                              allowed.includes(currentAbility) && allowed.length > 0
                                ? currentAbility
                                : (allowed[0] ?? 'STR');
                            updateAsChoice(index, {
                              kind: 'FEAT_PLUS1',
                              ability: nextAbility,
                              ...(nextFeatId ? { featId: nextFeatId } : {})
                            });
                          }}
                          className={INPUT_CLASS}
                        >
                          <option value="">Select feat...</option>
                          {plusOneFeatOptions.map((feat) => (
                            <option key={`feat-plus1-choice-${index}-${feat.id}`} value={feat.id}>
                              {feat.name} ({formatFeatAbilityIncreaseLabel(feat)})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm text-slate-300">
                        Applied +1 ability
                        <select
                          value={normalizedChoice.ability}
                          onChange={(event) =>
                            updateAsChoice(index, {
                              kind: 'FEAT_PLUS1',
                              ability: sanitizeAbilitySelection(event.target.value, 'STR'),
                              ...(normalizedChoice.featId ? { featId: normalizedChoice.featId } : {})
                            })
                          }
                          disabled={isFixedFeatAbility}
                          className={`${INPUT_CLASS} disabled:opacity-70`}
                        >
                          {displayedFeatAbilities.map((ability) => (
                            <option key={`feat-plus1-${index}-${ability}`} value={ability}>
                              {ability} - {ABILITY_LABELS[ability]}
                            </option>
                          ))}
                        </select>
                        {isFixedFeatAbility ? (
                          <p className="mt-1 text-xs text-slate-500">
                            This feat has a fixed ability increase.
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">
                            Only abilities allowed by this feat are selectable.
                          </p>
                        )}
                      </label>
                    </div>
                  ) : null}

                  {(normalizedChoice.kind === 'FEAT_NONE' || normalizedChoice.kind === 'FEAT_PLUS1') &&
                  selectedFeatMeta ? (
                    <div className="mt-3 rounded-lg border border-slate-800/70 bg-slate-900/45 p-3">
                      <p className="text-sm font-semibold text-slate-100">{selectedFeatMeta.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedFeatMeta.quickFacts.source ?? 'Unknown source'}
                        {selectedFeatMeta.quickFacts.prerequisite
                          ? ` - Prerequisite: ${selectedFeatMeta.quickFacts.prerequisite}`
                          : ''}
                      </p>
                      <p className="mt-2 whitespace-pre-line text-sm text-slate-300">
                        {expandedFeatDescriptions[selectedFeatMeta.id]
                          ? (expandedFeatTexts[selectedFeatMeta.id] ?? selectedFeatMeta.summary)
                          : selectedFeatMeta.summary}
                      </p>
                      {(isLikelyTruncatedSummary(selectedFeatMeta.summary) ||
                        expandedFeatDescriptions[selectedFeatMeta.id]) ? (
                        <div className="mt-2 space-y-1">
                          <button
                            type="button"
                            onClick={() => toggleFeatDescription(selectedFeatMeta)}
                            className="text-xs font-medium text-sky-300 transition hover:text-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500/35"
                          >
                            {expandedFeatDescriptions[selectedFeatMeta.id]
                              ? 'Show less'
                              : 'Show full description'}
                          </button>
                          {expandedFeatLoading[selectedFeatMeta.id] ? (
                            <p className="text-xs text-slate-500">Loading full description...</p>
                          ) : null}
                          {expandedFeatErrors[selectedFeatMeta.id] ? (
                            <p className="text-xs text-rose-300">
                              {expandedFeatErrors[selectedFeatMeta.id]}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">Applies at {levelLabel}.</p>
                </article>
              );
            })}
        </div>
      </section>
      ) : (
        <section className={`${SURFACE_TERTIARY} text-sm text-slate-300`}>
          {state.classId
            ? 'No ASI or feat opportunities at this level yet.'
            : 'Choose a class to start ASI / Feat planning.'}
        </section>
      )}

      <section className={SURFACE_TERTIARY}>
        <h3 className="text-base font-semibold text-slate-100">Quick presets</h3>
        <p className="mt-1 text-xs text-slate-500">Affects base scores only.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {POINT_BUY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                setState((previous) => ({
                  ...previous,
                  baseScores: { ...preset.values }
                }))
              }
              className="rounded-lg border border-slate-700/80 bg-slate-900/55 px-3 py-2 text-left transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/35"
            >
              <p className="text-sm font-semibold text-slate-100">{preset.label}</p>
              <p className="text-xs text-slate-500">{preset.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className={SURFACE_TERTIARY}>
        <h3 className="text-lg font-semibold text-slate-100">Final score breakdown</h3>
        <p className="mt-1 text-sm text-slate-400">
          Base, bonus mode, ASI, and feat contributions for each ability.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800/70">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/85 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Ability</th>
                <th className="px-2 py-2 text-right font-medium">Base</th>
                <th className="px-2 py-2 text-right font-medium">Bonus</th>
                <th className="px-2 py-2 text-right font-medium">ASI</th>
                <th className="px-2 py-2 text-right font-medium">Feat</th>
                <th className="px-2 py-2 text-right font-medium">Final</th>
                <th className="px-2 py-2 text-right font-medium">Mod</th>
                <th className="px-2 py-2 text-left font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="bg-slate-950/50 text-slate-200">
              {abilityRows.map((row) => (
                <tr key={`final-${row.ability}`} className="border-t border-slate-800/70">
                  <td className="px-2 py-2 font-medium">{row.ability}</td>
                  <td className="px-2 py-2 text-right">{row.base}</td>
                  <td className="px-2 py-2 text-right">{formatSignedNumber(row.bonus)}</td>
                  <td className="px-2 py-2 text-right">{formatSignedNumber(row.asi)}</td>
                  <td className="px-2 py-2 text-right">{formatSignedNumber(row.feat)}</td>
                  <td className="px-2 py-2 text-right font-semibold">{row.final}</td>
                  <td className="px-2 py-2 text-right">{formatSignedNumber(row.finalModifier)}</td>
                  <td className="px-2 py-2 text-xs text-slate-500">
                    {row.capOverflow > 0 ? `Capped by ${row.capOverflow}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Total from ASI: {totalAsiIncrease} | Total from feats: {totalFeatIncrease}
        </p>
      </section>
    </section>
  );
};




