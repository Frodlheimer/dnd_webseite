import type { SrdBitsetsIndex, SrdCategory, SrdEntryMeta, SrdPackIndex } from '../types';

export const normalizeSrdQuery = (value: string): string => {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const buildAllBitset = (total: number): Uint32Array => {
  const words = Math.ceil(total / 32);
  const bits = new Uint32Array(words);
  bits.fill(0xffffffff);

  if (words > 0 && total % 32 !== 0) {
    bits[words - 1] = (2 ** (total % 32) - 1) >>> 0;
  }

  return bits;
};

const andInto = (target: Uint32Array, source: number[] | undefined): void => {
  if (!source) {
    target.fill(0);
    return;
  }

  for (let index = 0; index < target.length; index += 1) {
    target[index] = (target[index] ?? 0) & (source[index] ?? 0);
  }
};

const collectIndices = (bitset: Uint32Array, total: number): number[] => {
  const ids: number[] = [];
  for (let index = 0; index < total; index += 1) {
    const wordIndex = Math.floor(index / 32);
    const bitOffset = index % 32;
    const word = bitset[wordIndex] ?? 0;
    if ((word & (1 << bitOffset)) !== 0) {
      ids.push(index);
    }
  }
  return ids;
};

export const filterSrdWithIndex = (args: {
  category: SrdCategory;
  index: SrdPackIndex;
  bitsets: SrdBitsetsIndex;
  query: string;
  selectedTags: string[];
  offset: number;
  limit: number;
  monsterTypeFilter?: string;
  monsterCrFilter?: string;
  monsterSizeFilter?: string;
}): { ids: string[]; total: number; metas: SrdEntryMeta[] } => {
  const metas = args.index.byCategory[args.category] ?? [];
  const categoryBitsets = args.bitsets[args.category];
  const normalizedQuery = normalizeSrdQuery(args.query);

  const tags = new Set(args.selectedTags.map((entry) => entry.trim()).filter(Boolean));
  if (args.category === 'monsters') {
    if (args.monsterTypeFilter && args.monsterTypeFilter !== 'ALL') {
      tags.add(`type:${args.monsterTypeFilter}`);
    }
    if (args.monsterCrFilter && args.monsterCrFilter !== 'ALL') {
      tags.add(`cr:${args.monsterCrFilter}`);
    }
    if (args.monsterSizeFilter && args.monsterSizeFilter !== 'ALL') {
      tags.add(`size:${args.monsterSizeFilter}`);
    }
  }

  const candidateBits = buildAllBitset(metas.length);
  for (const tag of tags) {
    andInto(candidateBits, categoryBitsets.tagToBitset[tag]);
  }

  const matched: SrdEntryMeta[] = [];
  const candidates = collectIndices(candidateBits, metas.length);
  for (const index of candidates) {
    const meta = metas[index];
    if (!meta) {
      continue;
    }

    if (
      normalizedQuery.length > 0 &&
      !meta.nameFolded.includes(normalizedQuery) &&
      !normalizeSrdQuery(meta.summary).includes(normalizedQuery)
    ) {
      continue;
    }

    matched.push(meta);
  }

  const total = matched.length;
  const safeOffset = Math.max(0, args.offset);
  const safeLimit = Math.max(1, args.limit);
  const paged = matched.slice(safeOffset, safeOffset + safeLimit);

  return {
    ids: paged.map((meta) => meta.id),
    total,
    metas: paged
  };
};
