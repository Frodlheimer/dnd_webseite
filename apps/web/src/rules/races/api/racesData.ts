import { raceLookup } from '../generated/raceLookup';
import { racesPackIndex } from '../generated/racesIndex';
import type { RaceEntryMeta, RaceStructuredData } from '../model';

const metaById = new Map(racesPackIndex.racesMeta.map((meta) => [meta.id, meta]));
const MAX_CACHE_SIZE = 40;
const detailCache = new Map<string, RaceStructuredData>();
const inFlightById = new Map<string, Promise<RaceStructuredData | null>>();

const rememberDetail = (id: string, detail: RaceStructuredData): void => {
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

export const getRaceMeta = (id: string): RaceEntryMeta | null => {
  return metaById.get(id) ?? null;
};

export const getAllRaceMetas = (): RaceEntryMeta[] => {
  return [...racesPackIndex.racesMeta];
};

export const getPlayableRaceMetas = (): RaceEntryMeta[] => {
  return racesPackIndex.racesMeta.filter((meta) => meta.kind === 'race');
};

export const getSubraceMetasForRace = (raceId: string): RaceEntryMeta[] => {
  const subraceIds = raceLookup.parentToSubraces[raceId] ?? [];
  return subraceIds.map((id) => getRaceMeta(id)).filter((meta): meta is RaceEntryMeta => !!meta);
};

export const getParentRaceMeta = (raceId: string): RaceEntryMeta | null => {
  const parentRaceId = getRaceMeta(raceId)?.parentRaceId ?? null;
  if (!parentRaceId) {
    return null;
  }
  return getRaceMeta(parentRaceId);
};

export const getRaceDetail = async (id: string): Promise<RaceStructuredData | null> => {
  const cached = detailCache.get(id);
  if (cached) {
    return cached;
  }

  const existingRequest = inFlightById.get(id);
  if (existingRequest) {
    return await existingRequest;
  }

  const meta = getRaceMeta(id);
  if (!meta) {
    return null;
  }

  const request = fetch(meta.detailUrl)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load race detail ${id}: ${response.status}`);
      }
      const detail = (await response.json()) as RaceStructuredData;
      rememberDetail(id, detail);
      return detail;
    })
    .finally(() => {
      inFlightById.delete(id);
    });

  inFlightById.set(id, request);
  return await request;
};
