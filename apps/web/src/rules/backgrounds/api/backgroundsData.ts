import { backgroundsPackIndex } from '../generated/backgroundsIndex';
import type { BackgroundMeta, BackgroundStructuredData } from '../model';

const metaById = new Map(backgroundsPackIndex.backgroundsMeta.map((meta) => [meta.id, meta]));
const MAX_CACHE_SIZE = 40;
const detailCache = new Map<string, BackgroundStructuredData>();
const inFlightById = new Map<string, Promise<BackgroundStructuredData | null>>();

const rememberDetail = (id: string, detail: BackgroundStructuredData): void => {
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

export const getBackgroundMeta = (id: string): BackgroundMeta | null => {
  return metaById.get(id) ?? null;
};

export const getAllBackgroundMetas = (): BackgroundMeta[] => {
  return [...backgroundsPackIndex.backgroundsMeta];
};

export const getBackgroundDetail = async (id: string): Promise<BackgroundStructuredData | null> => {
  const cached = detailCache.get(id);
  if (cached) {
    return cached;
  }

  const existingRequest = inFlightById.get(id);
  if (existingRequest) {
    return await existingRequest;
  }

  const meta = getBackgroundMeta(id);
  if (!meta) {
    return null;
  }

  const request = fetch(meta.detailUrl)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load background detail ${id}: ${response.status}`);
      }
      const detail = (await response.json()) as BackgroundStructuredData;
      rememberDetail(id, detail);
      return detail;
    })
    .finally(() => {
      inFlightById.delete(id);
    });

  inFlightById.set(id, request);
  return await request;
};
