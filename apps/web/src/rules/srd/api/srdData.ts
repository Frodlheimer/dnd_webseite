import { srdPackIndex } from '../generated/srdIndex';
import type { SrdCategory, SrdEntryDetail, SrdEntryMeta } from '../types';

const MAX_CACHE_SIZE = 80;
const detailCache = new Map<string, SrdEntryDetail>();
const inFlightByKey = new Map<string, Promise<SrdEntryDetail | null>>();

const keyFor = (category: SrdCategory, id: string): string => `${category}:${id}`;

const rememberDetail = (key: string, detail: SrdEntryDetail): void => {
  if (detailCache.has(key)) {
    detailCache.delete(key);
  }
  detailCache.set(key, detail);

  while (detailCache.size > MAX_CACHE_SIZE) {
    const firstKey = detailCache.keys().next().value as string | undefined;
    if (!firstKey) {
      break;
    }
    detailCache.delete(firstKey);
  }
};

const metaByCategoryById = new Map<SrdCategory, Map<string, SrdEntryMeta>>();
for (const [category, metas] of Object.entries(srdPackIndex.byCategory) as Array<[SrdCategory, SrdEntryMeta[]]>) {
  metaByCategoryById.set(category, new Map(metas.map((meta) => [meta.id, meta])));
}

export const getSrdCategoryMetas = (category: SrdCategory): SrdEntryMeta[] => {
  return [...(srdPackIndex.byCategory[category] ?? [])];
};

export const getSrdEntryMeta = (category: SrdCategory, id: string): SrdEntryMeta | null => {
  return metaByCategoryById.get(category)?.get(id) ?? null;
};

export const getSrdEntryDetail = async (
  category: SrdCategory,
  id: string
): Promise<SrdEntryDetail | null> => {
  const key = keyFor(category, id);
  const cached = detailCache.get(key);
  if (cached) {
    return cached;
  }

  const inFlight = inFlightByKey.get(key);
  if (inFlight) {
    return await inFlight;
  }

  const meta = getSrdEntryMeta(category, id);
  if (!meta) {
    return null;
  }

  const request = fetch(meta.detailUrl)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load SRD entry ${category}/${id}: ${response.status}`);
      }
      const detail = (await response.json()) as SrdEntryDetail;
      rememberDetail(key, detail);
      return detail;
    })
    .finally(() => {
      inFlightByKey.delete(key);
    });

  inFlightByKey.set(key, request);
  return await request;
};

export const getSrdAttributionStatement = async (): Promise<string> => {
  const response = await fetch('/rules/srd/toc.json');
  if (!response.ok) {
    throw new Error(`Failed to load SRD TOC: ${response.status}`);
  }
  const payload = (await response.json()) as { attributionStatement?: string };
  return (
    payload.attributionStatement ??
    'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.'
  );
};
