import { featsPackIndex } from '../generated/featsIndex';
import type { FeatAbility, FeatEntryDetail, FeatEntryMeta } from '../types';

export type BuilderAbility = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

const BUILDER_ABILITIES: BuilderAbility[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

const isBuilderAbility = (value: FeatAbility): value is BuilderAbility => {
  return value === 'STR' || value === 'DEX' || value === 'CON' || value === 'INT' || value === 'WIS' || value === 'CHA';
};

const metaById = new Map(featsPackIndex.entriesMeta.map((meta) => [meta.id, meta]));
const MAX_CACHE_SIZE = 64;
const detailCache = new Map<string, FeatEntryDetail>();
const inFlightById = new Map<string, Promise<FeatEntryDetail | null>>();

const rememberDetail = (id: string, detail: FeatEntryDetail): void => {
  if (detailCache.has(id)) {
    detailCache.delete(id);
  }
  detailCache.set(id, detail);

  while (detailCache.size > MAX_CACHE_SIZE) {
    const firstKey = detailCache.keys().next().value as string | undefined;
    if (!firstKey) {
      break;
    }
    detailCache.delete(firstKey);
  }
};

export const getFeatMeta = (id: string): FeatEntryMeta | null => {
  return metaById.get(id) ?? null;
};

export const getAllFeats = (): FeatEntryMeta[] => {
  return [...featsPackIndex.entriesMeta];
};

export const getFeatDetail = async (id: string): Promise<FeatEntryDetail | null> => {
  const cached = detailCache.get(id);
  if (cached) {
    return cached;
  }

  const existingPromise = inFlightById.get(id);
  if (existingPromise) {
    return await existingPromise;
  }

  const meta = getFeatMeta(id);
  if (!meta) {
    return null;
  }

  const request = fetch(meta.detailUrl)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load feat detail ${id}: ${response.status}`);
      }
      const detail = (await response.json()) as FeatEntryDetail;
      rememberDetail(id, detail);
      return detail;
    })
    .finally(() => {
      inFlightById.delete(id);
    });

  inFlightById.set(id, request);
  return await request;
};

export const getFeatsWithAbilityIncrease = (): FeatEntryMeta[] => {
  return featsPackIndex.entriesMeta.filter((meta) => meta.quickFacts.abilityIncrease.amount === 1);
};

export const getFeatAllowedPlusOneAbilities = (featId: string): BuilderAbility[] => {
  const meta = getFeatMeta(featId);
  if (!meta) {
    return [];
  }

  const increase = meta.quickFacts.abilityIncrease;
  if (increase.amount !== 1) {
    return [];
  }

  if (increase.abilities.includes('ALL')) {
    return [...BUILDER_ABILITIES];
  }

  const allowed = increase.abilities.filter(isBuilderAbility);
  return [...new Set(allowed)];
};

export const featHasPlusOneAbilityIncrease = (featId: string): boolean => {
  const meta = getFeatMeta(featId);
  if (!meta) {
    return false;
  }
  return meta.quickFacts.abilityIncrease.amount === 1;
};
