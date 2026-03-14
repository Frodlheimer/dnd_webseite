import type { BackgroundMeta, BackgroundsPackIndex } from '../model';
import { slugifyBackgroundValue } from '../parse/normalizeNames';

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
    target[index] = (target[index] ?? 0) & (source[index] ?? 0);
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

export type BackgroundFilterArgs = {
  index: BackgroundsPackIndex;
  query: string;
  categoryFilter?: string;
  requireSkillProficiency?: boolean;
  requireToolProficiency?: boolean;
  requireLanguage?: boolean;
  requireChoices?: boolean;
  requireFeature?: boolean;
  requireEquipment?: boolean;
  offset: number;
  limit: number;
};

export const filterBackgroundsWithIndex = (
  args: BackgroundFilterArgs
): { ids: string[]; total: number } => {
  const tags = new Set<string>();

  if (args.categoryFilter && args.categoryFilter !== 'ALL') {
    tags.add(`category:${slugifyBackgroundValue(args.categoryFilter)}`);
  }
  if (args.requireSkillProficiency) {
    tags.add('has:skill-proficiency');
  }
  if (args.requireToolProficiency) {
    tags.add('has:tool-proficiency');
  }
  if (args.requireLanguage) {
    tags.add('has:language');
  }
  if (args.requireChoices) {
    tags.add('has:choice');
  }
  if (args.requireFeature) {
    tags.add('has:feature');
  }
  if (args.requireEquipment) {
    tags.add('has:equipment');
  }

  const candidateBits = buildAllBitset(args.index.backgroundsMeta.length);
  for (const tag of tags) {
    andBitsetInto(candidateBits, args.index.tagBitsets[tag]);
  }

  const candidates = collectIndices(candidateBits, args.index.backgroundsMeta.length);
  const matched: BackgroundMeta[] = [];
  const normalizedQuery = args.query.trim().toLowerCase();

  candidates.forEach((candidateIndex) => {
    const meta = args.index.backgroundsMeta[candidateIndex];
    if (!meta) {
      return;
    }
    if (normalizedQuery && !meta.searchTextFolded.includes(normalizedQuery)) {
      return;
    }
    matched.push(meta);
  });

  const total = matched.length;
  const safeOffset = Math.max(0, args.offset);
  const safeLimit = Math.max(1, args.limit);
  const paged = matched.slice(safeOffset, safeOffset + safeLimit);

  return {
    ids: paged.map((entry) => entry.id),
    total
  };
};
