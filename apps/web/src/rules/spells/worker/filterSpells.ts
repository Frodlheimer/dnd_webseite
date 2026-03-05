import type { SpellDetail, SpellMeta, SpellsListResult, SpellsPack } from '../types';
import { normalizeSpellQuery } from '../parse/parseSpellsTxt';

export type SpellTagGroups = {
  levels: string[];
  schools: string[];
  classes: string[];
  sources: string[];
  concentrations: string[];
  targets: string[];
  flags: string[];
  misc: string[];
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
    const currentWord = target[index] ?? 0;
    target[index] = currentWord & (source[index] ?? 0);
  }
};

const collectIndices = (bitset: Uint32Array, total: number): number[] => {
  const indices: number[] = [];
  for (let index = 0; index < total; index += 1) {
    const wordIndex = Math.floor(index / 32);
    const bitOffset = index % 32;
    const currentWord = bitset[wordIndex] ?? 0;
    if ((currentWord & (1 << bitOffset)) !== 0) {
      indices.push(index);
    }
  }

  return indices;
};

const byTagValue = (tag: string): string => {
  return tag.slice(tag.indexOf(':') + 1);
};

const naturalSort = (left: string, right: string): number => {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base'
  });
};

const sortLevelTags = (tags: string[]): string[] => {
  return [...tags].sort((left, right) => {
    if (left === 'cantrip') {
      return -1;
    }
    if (right === 'cantrip') {
      return 1;
    }

    const leftNum = Number.parseInt(byTagValue(left), 10);
    const rightNum = Number.parseInt(byTagValue(right), 10);
    return leftNum - rightNum;
  });
};

export const buildTagGroups = (allTags: string[]): SpellTagGroups => {
  const groups: SpellTagGroups = {
    levels: [],
    schools: [],
    classes: [],
    sources: [],
    concentrations: [],
    targets: [],
    flags: [],
    misc: []
  };

  for (const tag of allTags) {
    if (tag === 'cantrip' || tag.startsWith('level:')) {
      groups.levels.push(tag);
      continue;
    }

    if (tag.startsWith('school:')) {
      groups.schools.push(tag);
      continue;
    }

    if (tag.startsWith('class:')) {
      groups.classes.push(tag);
      continue;
    }

    if (tag.startsWith('source:')) {
      groups.sources.push(tag);
      continue;
    }

    if (tag.startsWith('concentration:')) {
      groups.concentrations.push(tag);
      continue;
    }

    if (tag.startsWith('target:')) {
      groups.targets.push(tag);
      continue;
    }

    if (
      tag === 'ritual' ||
      tag === 'technomagic' ||
      tag === 'dunamancy' ||
      tag === 'dunamancy:graviturgy' ||
      tag === 'dunamancy:chronurgy'
    ) {
      groups.flags.push(tag);
      continue;
    }

    groups.misc.push(tag);
  }

  groups.levels = sortLevelTags(groups.levels);
  groups.schools = [...groups.schools].sort((left, right) =>
    naturalSort(byTagValue(left), byTagValue(right))
  );
  groups.classes = [...groups.classes].sort((left, right) =>
    naturalSort(byTagValue(left), byTagValue(right))
  );
  groups.sources = [...groups.sources].sort((left, right) =>
    naturalSort(byTagValue(left), byTagValue(right))
  );
  groups.concentrations = [...groups.concentrations].sort((left, right) =>
    naturalSort(byTagValue(left), byTagValue(right))
  );
  groups.targets = [...groups.targets].sort((left, right) =>
    naturalSort(byTagValue(left), byTagValue(right))
  );
  groups.flags = [...groups.flags].sort(naturalSort);
  groups.misc = [...groups.misc].sort(naturalSort);

  return groups;
};

export const filterSpellsWithPack = (args: {
  pack: SpellsPack;
  query: string;
  tags: string[];
  offset: number;
  limit: number;
}): SpellsListResult => {
  const normalizedQuery = normalizeSpellQuery(args.query);
  const normalizedTags = [...new Set(args.tags.map((tag) => tag.trim()).filter(Boolean))];
  const candidateBits = buildAllBitset(args.pack.metas.length);

  for (const tag of normalizedTags) {
    andBitsetInto(candidateBits, args.pack.tagBitsets[tag]);
  }

  const indices = collectIndices(candidateBits, args.pack.metas.length);
  const matchedIndices: number[] = [];

  for (const index of indices) {
    const meta = args.pack.metas[index];
    if (!meta) {
      continue;
    }

    if (normalizedQuery.length > 0 && !meta.nameNormalized.includes(normalizedQuery)) {
      continue;
    }

    matchedIndices.push(index);
  }

  const total = matchedIndices.length;
  const safeOffset = Math.max(0, args.offset);
  const safeLimit = Math.max(1, args.limit);
  const pageIndices = matchedIndices.slice(safeOffset, safeOffset + safeLimit);

  const items: SpellMeta[] = pageIndices
    .map((index) => args.pack.metas[index])
    .filter((meta): meta is SpellMeta => !!meta);

  return {
    total,
    items
  };
};

export const findSpellDetailBySlug = (pack: SpellsPack, slug: string): SpellDetail | null => {
  return pack.detailsBySlug[slug] ?? null;
};
