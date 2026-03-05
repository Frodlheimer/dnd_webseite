import type { ClassesPackIndex, RulesEntryMeta } from '../types';

export type ClassesTagGroups = {
  kind: string[];
  classes: string[];
  settings: string[];
  caster: string[];
  has: string[];
  misc: string[];
};

export const normalizeClassesQuery = (value: string): string => {
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

export const buildClassesTagGroups = (allTags: string[]): ClassesTagGroups => {
  const groups: ClassesTagGroups = {
    kind: [],
    classes: [],
    settings: [],
    caster: [],
    has: [],
    misc: []
  };

  for (const tag of allTags) {
    if (tag.startsWith('kind:')) {
      groups.kind.push(tag);
      continue;
    }
    if (tag.startsWith('class:')) {
      groups.classes.push(tag);
      continue;
    }
    if (tag.startsWith('setting:') || tag === 'ua') {
      groups.settings.push(tag);
      continue;
    }
    if (tag.startsWith('caster:') || tag === 'spellcaster') {
      groups.caster.push(tag);
      continue;
    }
    if (tag.startsWith('has:')) {
      groups.has.push(tag);
      continue;
    }
    groups.misc.push(tag);
  }

  groups.kind.sort();
  groups.classes.sort();
  groups.settings.sort();
  groups.caster.sort();
  groups.has.sort();
  groups.misc.sort();

  return groups;
};

export const filterClassesWithIndex = (args: {
  index: ClassesPackIndex;
  query: string;
  selectedTags: string[];
  kindFilter?: 'ALL' | 'CLASS' | 'SUBCLASS';
  classFilter?: string;
  offset: number;
  limit: number;
}): {
  ids: string[];
  total: number;
} => {
  const normalizedQuery = normalizeClassesQuery(args.query);
  const tags = new Set<string>(args.selectedTags.map((entry) => entry.trim()).filter(Boolean));

  if (args.kindFilter === 'CLASS') {
    tags.add('kind:class');
  } else if (args.kindFilter === 'SUBCLASS') {
    tags.add('kind:subclass');
  }

  if (args.classFilter && args.classFilter !== 'ALL') {
    tags.add(`class:${args.classFilter}`);
  }

  const candidateBits = buildAllBitset(args.index.entriesMeta.length);
  for (const tag of tags) {
    andBitsetInto(candidateBits, args.index.tagBitsets[tag]);
  }

  const candidates = collectIndices(candidateBits, args.index.entriesMeta.length);
  const matched: RulesEntryMeta[] = [];
  for (const candidateIndex of candidates) {
    const meta = args.index.entriesMeta[candidateIndex];
    if (!meta) {
      continue;
    }
    if (normalizedQuery.length > 0 && !meta.nameFolded.includes(normalizedQuery)) {
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

