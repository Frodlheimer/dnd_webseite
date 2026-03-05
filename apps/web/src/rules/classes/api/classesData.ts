import { classesPackIndex } from '../generated/classesIndex';
import type { GrantedSpellRef, RulesEntryDetail, RulesEntryMeta } from '../types';

const metaById = new Map(classesPackIndex.entriesMeta.map((meta) => [meta.id, meta]));
const MAX_CACHE_SIZE = 32;
const detailCache = new Map<string, RulesEntryDetail>();
const inFlightById = new Map<string, Promise<RulesEntryDetail | null>>();

const rememberDetail = (id: string, detail: RulesEntryDetail): void => {
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

const parseNumberRecord = <T>(value: Record<number, T> | undefined): Record<number, T> => {
  if (!value) {
    return {};
  }

  const normalized: Record<number, T> = {};
  for (const [key, entry] of Object.entries(value)) {
    const numericKey = Number.parseInt(key, 10);
    if (!Number.isFinite(numericKey)) {
      continue;
    }
    normalized[numericKey] = entry;
  }
  return normalized;
};

export const getRulesEntryMeta = (id: string): RulesEntryMeta | null => {
  return metaById.get(id) ?? null;
};

export const getClassMeta = (id: string): RulesEntryMeta | null => {
  const meta = metaById.get(id);
  if (!meta || meta.kind !== 'CLASS') {
    return null;
  }
  return meta;
};

export const getAllClasses = (): RulesEntryMeta[] => {
  return classesPackIndex.entriesMeta.filter((meta) => meta.kind === 'CLASS');
};

export const getSubclassesForClass = (classId: string): RulesEntryMeta[] => {
  return classesPackIndex.entriesMeta.filter(
    (meta) => meta.kind === 'SUBCLASS' && meta.classId === classId
  );
};

export const getRulesEntryDetail = async (id: string): Promise<RulesEntryDetail | null> => {
  const cached = detailCache.get(id);
  if (cached) {
    return cached;
  }

  const existingPromise = inFlightById.get(id);
  if (existingPromise) {
    return await existingPromise;
  }

  const meta = metaById.get(id);
  if (!meta) {
    return null;
  }

  const request = fetch(meta.detailUrl)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load class detail ${id}: ${response.status}`);
      }
      const detail = (await response.json()) as RulesEntryDetail;
      rememberDetail(id, detail);
      return detail;
    })
    .finally(() => {
      inFlightById.delete(id);
    });

  inFlightById.set(id, request);
  return await request;
};

export const getSpellSlotsForClassLevel = (classId: string, level: number): number[] | null => {
  const meta = getClassMeta(classId);
  if (!meta) {
    return null;
  }
  const spellSlotsByLevel = meta.quick.spellSlotsByLevel;
  if (!spellSlotsByLevel) {
    return null;
  }
  if (!Number.isFinite(level) || level < 1 || level > spellSlotsByLevel.length) {
    return null;
  }
  const row = spellSlotsByLevel[level - 1];
  return row ? [...row] : null;
};

export const getFeaturesForClassLevel = (classId: string, level: number): string[] => {
  const meta = getClassMeta(classId);
  if (!meta || !meta.quick.featuresByLevel) {
    return [];
  }
  const byLevel = parseNumberRecord(meta.quick.featuresByLevel);
  return [...(byLevel[level] ?? [])];
};

export const getGrantedSpellsForSubclass = (
  subclassId: string,
  level: number
): GrantedSpellRef[] => {
  const meta = getRulesEntryMeta(subclassId);
  if (!meta || meta.kind !== 'SUBCLASS' || !meta.quick.grantedSpellRefsByLevel) {
    return [];
  }
  const byLevel = parseNumberRecord(meta.quick.grantedSpellRefsByLevel);
  return [...(byLevel[level] ?? [])];
};
