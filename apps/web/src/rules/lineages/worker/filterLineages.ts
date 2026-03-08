import type { LineageEntryMeta, LineagesPackIndex } from '../types';

export type LineagesTagGroups = {
  kind: string[];
  groups: string[];
  settings: string[];
  sources: string[];
  has: string[];
  trait: string[];
  misc: string[];
};

export const normalizeLineagesQuery = (value: string): string => {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['â€™`]/g, '')
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

const andBitsetInto = (target: Uint32Array, source: number[] | undefined): void => {
  if (!source) {
    target.fill(0);
    return;
  }

  for (let index = 0; index < target.length; index += 1) {
    const current = target[index] ?? 0;
    target[index] = current & (source[index] ?? 0);
  }
};

const collectIndices = (bitset: Uint32Array, total: number): number[] => {
  const indices: number[] = [];
  for (let index = 0; index < total; index += 1) {
    const wordIndex = Math.floor(index / 32);
    const bitOffset = index % 32;
    const word = bitset[wordIndex] ?? 0;
    if ((word & (1 << bitOffset)) !== 0) {
      indices.push(index);
    }
  }
  return indices;
};

export const buildLineagesTagGroups = (allTags: string[]): LineagesTagGroups => {
  const groups: LineagesTagGroups = {
    kind: [],
    groups: [],
    settings: [],
    sources: [],
    has: [],
    trait: [],
    misc: []
  };

  for (const tag of allTags) {
    if (tag.startsWith('kind:')) {
      groups.kind.push(tag);
      continue;
    }
    if (tag.startsWith('group:')) {
      groups.groups.push(tag);
      continue;
    }
    if (tag.startsWith('setting:')) {
      groups.settings.push(tag);
      continue;
    }
    if (tag.startsWith('source:')) {
      groups.sources.push(tag);
      continue;
    }
    if (tag.startsWith('has:')) {
      groups.has.push(tag);
      continue;
    }
    if (tag.startsWith('trait:')) {
      groups.trait.push(tag);
      continue;
    }
    groups.misc.push(tag);
  }

  groups.kind.sort();
  groups.groups.sort();
  groups.settings.sort();
  groups.sources.sort();
  groups.has.sort();
  groups.trait.sort();
  groups.misc.sort();

  return groups;
};

export const filterLineagesWithIndex = (args: {
  index: LineagesPackIndex;
  query: string;
  selectedTags: string[];
  groupFilter?: string;
  settingFilter?: string;
  offset: number;
  limit: number;
}): {
  ids: string[];
  total: number;
} => {
  const normalizedQuery = normalizeLineagesQuery(args.query);
  const tags = new Set<string>(args.selectedTags.map((entry) => entry.trim()).filter(Boolean));

  tags.add('kind:lineage');

  if (args.groupFilter && args.groupFilter !== 'ALL') {
    tags.add(`group:${args.groupFilter}`);
  }

  if (args.settingFilter && args.settingFilter !== 'ALL') {
    tags.add(`setting:${args.settingFilter}`);
  }

  const candidateBits = buildAllBitset(args.index.entriesMeta.length);
  for (const tag of tags) {
    andBitsetInto(candidateBits, args.index.tagBitsets[tag]);
  }

  const candidates = collectIndices(candidateBits, args.index.entriesMeta.length);
  const matched: LineageEntryMeta[] = [];
  for (const candidateIndex of candidates) {
    const meta = args.index.entriesMeta[candidateIndex];
    if (!meta) {
      continue;
    }

    if (
      normalizedQuery.length > 0 &&
      !meta.nameFolded.includes(normalizedQuery) &&
      !normalizeLineagesQuery(meta.summary).includes(normalizedQuery)
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
    ids: paged.map((entry) => entry.id),
    total
  };
};
