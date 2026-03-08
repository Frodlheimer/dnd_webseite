import { getClassMeta } from '../../rules/classes/api/classesData';

export type AsiProgressionPreset = 'STANDARD' | 'FIGHTER' | 'ROGUE';

export type AsiOpportunityInfo = {
  count: number;
  levels: number[];
  source: 'CLASS_DATA' | 'FALLBACK_PRESET';
  preset: AsiProgressionPreset;
};

export type ClassLevelDistribution = {
  classId: string;
  level: number;
};

export type AsiOpportunitySlot = {
  classId: string;
  className: string;
  classLevel: number;
  label: string;
};

export type MultiClassAsiOpportunityInfo = {
  count: number;
  slots: AsiOpportunitySlot[];
  source: 'CLASS_DATA' | 'FALLBACK_PRESET' | 'MIXED';
};

const ASI_FEATURE_PATTERN = 'ability score improvement';

const PRESET_LEVELS: Record<AsiProgressionPreset, number[]> = {
  STANDARD: [4, 8, 12, 16, 19],
  FIGHTER: [4, 6, 8, 12, 14, 16, 19],
  ROGUE: [4, 8, 10, 12, 16, 19]
};

const normalize = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const isAsiFeatureName = (featureName: string): boolean => {
  return normalize(featureName).includes(ASI_FEATURE_PATTERN);
};

const sanitizeLevel = (level: number): number => {
  if (!Number.isFinite(level)) {
    return 1;
  }
  return Math.max(1, Math.min(20, Math.trunc(level)));
};

export const resolvePresetForClassId = (classId: string): AsiProgressionPreset => {
  if (classId === 'fighter') {
    return 'FIGHTER';
  }
  if (classId === 'rogue') {
    return 'ROGUE';
  }
  return 'STANDARD';
};

export const getAsiOpportunityLevelsForPreset = (
  preset: AsiProgressionPreset,
  level: number
): number[] => {
  const cappedLevel = sanitizeLevel(level);
  return PRESET_LEVELS[preset].filter((entry) => entry <= cappedLevel);
};

export const getAsiOpportunityLevelsFromFeaturesMap = (
  featuresByLevel: Record<number, string[]> | undefined,
  level: number
): number[] => {
  if (!featuresByLevel) {
    return [];
  }

  const cappedLevel = sanitizeLevel(level);
  const levels: number[] = [];

  for (const [rawLevel, features] of Object.entries(featuresByLevel)) {
    const numericLevel = Number.parseInt(rawLevel, 10);
    if (!Number.isFinite(numericLevel) || numericLevel > cappedLevel) {
      continue;
    }

    if (features.some((feature) => isAsiFeatureName(feature))) {
      levels.push(numericLevel);
    }
  }

  levels.sort((left, right) => left - right);
  return levels;
};

export const getAsiOpportunityInfo = (
  classId: string,
  level: number,
  fallbackPreset?: AsiProgressionPreset
): AsiOpportunityInfo => {
  const preset = fallbackPreset ?? resolvePresetForClassId(classId);
  const classMeta = getClassMeta(classId);
  const levelsFromClass = classMeta?.quick.featuresByLevel
    ? getAsiOpportunityLevelsFromFeaturesMap(classMeta.quick.featuresByLevel, level)
    : [];

  if (levelsFromClass.length > 0) {
    return {
      count: levelsFromClass.length,
      levels: levelsFromClass,
      source: 'CLASS_DATA',
      preset
    };
  }

  const fallbackLevels = getAsiOpportunityLevelsForPreset(preset, level);
  return {
    count: fallbackLevels.length,
    levels: fallbackLevels,
    source: 'FALLBACK_PRESET',
    preset
  };
};

export const getAsiOpportunities = (classId: string, level: number): number => {
  return getAsiOpportunityInfo(classId, level).count;
};

export const getAsiOpportunityInfoForClassDistribution = (
  classes: ClassLevelDistribution[],
  fallbackPreset?: AsiProgressionPreset
): MultiClassAsiOpportunityInfo => {
  const validClasses = classes.filter(
    (entry) => typeof entry.classId === 'string' && entry.classId.trim().length > 0 && entry.level >= 1
  );

  if (validClasses.length === 0) {
    return {
      count: 0,
      slots: [],
      source: 'CLASS_DATA'
    };
  }

  const slots: AsiOpportunitySlot[] = [];
  let hasClassDataSource = false;
  let hasFallbackSource = false;

  validClasses.forEach((entry) => {
    const classMeta = getClassMeta(entry.classId);
    const className = classMeta?.name ?? entry.classId;
    const preset = fallbackPreset ?? resolvePresetForClassId(entry.classId);
    const info = getAsiOpportunityInfo(entry.classId, entry.level, preset);

    if (info.source === 'CLASS_DATA') {
      hasClassDataSource = true;
    } else {
      hasFallbackSource = true;
    }

    info.levels.forEach((level) => {
      slots.push({
        classId: entry.classId,
        className,
        classLevel: level,
        label: `${className} ${level}`
      });
    });
  });

  let source: MultiClassAsiOpportunityInfo['source'] = 'CLASS_DATA';
  if (hasClassDataSource && hasFallbackSource) {
    source = 'MIXED';
  } else if (hasFallbackSource) {
    source = 'FALLBACK_PRESET';
  }

  return {
    count: slots.length,
    slots,
    source
  };
};
