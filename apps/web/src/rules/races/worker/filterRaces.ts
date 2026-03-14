import type { RaceEntryMeta, RacesPackIndex } from '../model';

const slugifyFilterValue = (value: string): string => {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const normalizeRaceQuery = (value: string): string => {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['`]/g, '')
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

export type RaceFilterArgs = {
  index: RacesPackIndex;
  query: string;
  sizeFilter?: string;
  speedFilter?: string;
  darkvisionFilter?: string;
  languageFilter?: string;
  requireToolChoices?: boolean;
  requireWeaponProficiencies?: boolean;
  requireResistances?: boolean;
  offset: number;
  limit: number;
};

export const filterRacesWithIndex = (args: RaceFilterArgs): { ids: string[]; total: number } => {
  const normalizedQuery = normalizeRaceQuery(args.query);
  const tags = new Set<string>();

  if (args.sizeFilter && args.sizeFilter !== 'ALL') {
    tags.add(`size:${slugifyFilterValue(args.sizeFilter)}`);
  }
  if (args.speedFilter && args.speedFilter !== 'ALL') {
    tags.add(`speed:${args.speedFilter}`);
  }
  if (args.darkvisionFilter && args.darkvisionFilter !== 'ALL') {
    tags.add(`darkvision:${args.darkvisionFilter}`);
  }
  if (args.languageFilter && args.languageFilter !== 'ALL') {
    tags.add(`language:${slugifyFilterValue(args.languageFilter)}`);
  }
  if (args.requireToolChoices) {
    tags.add('has:tool-choice');
  }
  if (args.requireWeaponProficiencies) {
    tags.add('has:weapon-proficiency');
  }
  if (args.requireResistances) {
    tags.add('has:resistance');
  }

  const candidateBits = buildAllBitset(args.index.racesMeta.length);
  for (const tag of tags) {
    andBitsetInto(candidateBits, args.index.tagBitsets[tag]);
  }

  const candidates = collectIndices(candidateBits, args.index.racesMeta.length);
  const matched: RaceEntryMeta[] = [];
  for (const candidateIndex of candidates) {
    const meta = args.index.racesMeta[candidateIndex];
    if (!meta) {
      continue;
    }
    if (
      normalizedQuery.length > 0 &&
      !meta.nameFolded.includes(normalizedQuery) &&
      !normalizeRaceQuery(meta.summary).includes(normalizedQuery)
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
