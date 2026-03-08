import { lineagesPackIndex } from '../generated/lineagesIndex';
import type { LineageEntryDetail, LineageEntryMeta } from '../types';

const metaById = new Map(lineagesPackIndex.entriesMeta.map((meta) => [meta.id, meta]));
const MAX_CACHE_SIZE = 40;
const detailCache = new Map<string, LineageEntryDetail>();
const inFlightById = new Map<string, Promise<LineageEntryDetail | null>>();

const rememberDetail = (id: string, detail: LineageEntryDetail): void => {
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

export const getLineageMeta = (id: string): LineageEntryMeta | null => {
  return metaById.get(id) ?? null;
};

export const getAllLineages = (): LineageEntryMeta[] => {
  return [...lineagesPackIndex.entriesMeta];
};

export const getLineageDetail = async (id: string): Promise<LineageEntryDetail | null> => {
  const cached = detailCache.get(id);
  if (cached) {
    return cached;
  }

  const existingPromise = inFlightById.get(id);
  if (existingPromise) {
    return await existingPromise;
  }

  const meta = getLineageMeta(id);
  if (!meta) {
    return null;
  }

  const request = fetch(meta.detailUrl)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load lineage detail ${id}: ${response.status}`);
      }
      const detail = (await response.json()) as LineageEntryDetail;
      rememberDetail(id, detail);
      return detail;
    })
    .finally(() => {
      inFlightById.delete(id);
    });

  inFlightById.set(id, request);
  return await request;
};
