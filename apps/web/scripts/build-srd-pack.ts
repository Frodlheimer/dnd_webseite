import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractSrdSections } from '../src/rules/srd/parse/extractors';
import { loadSrdJson, foldSrdText, normalizeSrdBlocks } from '../src/rules/srd/parse/srdJsonLoader';
import type { SrdBitsetsIndex, SrdCategory, SrdEntryDetail, SrdEntryMeta, SrdPackIndex } from '../src/rules/srd/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const envPathRaw = process.env.SRD_JSON_PATH?.trim();
const envPath = envPathRaw ? path.resolve(envPathRaw) : null;
const fallbackPath = path.resolve(repoRoot, 'content/SRD_CC_v5.1.json');

const indexOutputPath = path.resolve(repoRoot, 'apps/web/src/rules/srd/generated/srdIndex.ts');
const bitsetsOutputPath = path.resolve(repoRoot, 'apps/web/src/rules/srd/generated/srdBitsets.ts');
const detailsRootDir = path.resolve(repoRoot, 'apps/web/public/rules/srd');
const tocOutputPath = path.resolve(detailsRootDir, 'toc.json');

const srdCategories: SrdCategory[] = [
  'races',
  'equipment',
  'adventuring',
  'combat',
  'spellcasting',
  'conditions',
  'magic-items',
  'monsters'
];

const resolveInputPath = (): string => {
  if (envPath && existsSync(envPath) && statSync(envPath).isFile()) {
    return envPath;
  }

  if (existsSync(fallbackPath) && statSync(fallbackPath).isFile()) {
    return fallbackPath;
  }

  const lines: string[] = [];
  lines.push('[srd:build] Failed to resolve SRD JSON input file.');
  lines.push(`SRD_JSON_PATH: ${envPathRaw ? envPathRaw : '(not set)'}`);
  if (envPath) {
    lines.push(`Resolved SRD_JSON_PATH: ${envPath}`);
  }
  lines.push(`Fallback path: ${fallbackPath}`);
  lines.push('Provide SRD_JSON_PATH or place SRD_CC_v5.1.json at ./content/SRD_CC_v5.1.json');
  throw new Error(lines.join('\n'));
};

const clearJsonFilesRecursive = (directoryPath: string): void => {
  if (!existsSync(directoryPath)) {
    return;
  }

  const entries = readdirSync(directoryPath, {
    withFileTypes: true
  });

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      clearJsonFilesRecursive(fullPath);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      rmSync(fullPath, {
        force: true
      });
    }
  }
};

const sanitizeString = (value: string): string => {
  const withoutWikidotLinks = value.replace(/https?:\/\/[^\s]*wikidot[^\s]*/gi, '').replace(/wikidot/gi, '');
  return withoutWikidotLinks.replace(/\s+/g, ' ').trim();
};

const deepSanitize = <T>(value: T): T => {
  if (typeof value === 'string') {
    return sanitizeString(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => deepSanitize(entry)) as T;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, deepSanitize(entry)]);
    return Object.fromEntries(entries) as T;
  }
  return value;
};

const toMeta = (entry: SrdEntryDetail): SrdEntryMeta => {
  const sectionLabel = {
    races: 'Races',
    equipment: 'Equipment',
    adventuring: 'Adventuring',
    combat: 'Combat',
    spellcasting: 'Spellcasting Rules',
    conditions: 'Conditions',
    'magic-items': 'Magic Items',
    monsters: 'Monsters'
  }[entry.category];

  return {
    id: entry.id,
    title: entry.title,
    category: entry.category,
    section: sectionLabel,
    tags: [...entry.tags].sort(),
    nameFolded: foldSrdText(entry.title),
    summary: entry.summary,
    detailUrl: `/rules/srd/${entry.category}/${entry.id}.json`,
    sourcePageRange: entry.sourcePageRange,
    extra: {
      sourcePageStart: entry.extra.sourcePageStart,
      sourcePageEnd: entry.extra.sourcePageEnd,
      rarity: entry.extra.rarity,
      size: entry.extra.size,
      monsterType: entry.extra.monsterType,
      challengeRating: entry.extra.challengeRating,
      initiativeMod: entry.extra.initiativeMod,
      armorClass: entry.extra.armorClass,
      hitPoints: entry.extra.hitPoints,
      speed: entry.extra.speed
    }
  };
};

const buildTagIndex = (metas: SrdEntryMeta[]): { allTags: string[]; tagCounts: Record<string, number> } => {
  const tagCounts: Record<string, number> = {};
  for (const meta of metas) {
    for (const tag of meta.tags) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }

  const allTags = Object.keys(tagCounts).sort((left, right) => left.localeCompare(right));
  return {
    allTags,
    tagCounts
  };
};

const buildBitsets = (metas: SrdEntryMeta[], allTags: string[]): { allCount: number; tagToBitset: Record<string, number[]> } => {
  const words = Math.ceil(metas.length / 32);
  const tagToBitset: Record<string, number[]> = {};
  for (const tag of allTags) {
    tagToBitset[tag] = Array.from({
      length: words
    }).map(() => 0);
  }

  metas.forEach((meta, index) => {
    const wordIndex = Math.floor(index / 32);
    const bit = 1 << (index % 32);
    for (const tag of meta.tags) {
      const bitset = tagToBitset[tag];
      if (!bitset) {
        continue;
      }
      bitset[wordIndex] = ((bitset[wordIndex] ?? 0) | bit) >>> 0;
    }
  });

  return {
    allCount: metas.length,
    tagToBitset
  };
};

const run = (): void => {
  const inputPath = resolveInputPath();
  const source = loadSrdJson(inputPath);
  const normalizedBlocks = normalizeSrdBlocks(source);
  const extracted = extractSrdSections(normalizedBlocks);

  const byCategoryDetails: Record<SrdCategory, SrdEntryDetail[]> = {
    races: [],
    equipment: [],
    adventuring: [],
    combat: [],
    spellcasting: [],
    conditions: [],
    'magic-items': [],
    monsters: []
  };

  for (const category of srdCategories) {
    byCategoryDetails[category] = extracted.byCategory[category].map((entry) => deepSanitize(entry));
  }

  mkdirSync(path.dirname(indexOutputPath), {
    recursive: true
  });
  mkdirSync(path.dirname(bitsetsOutputPath), {
    recursive: true
  });
  mkdirSync(detailsRootDir, {
    recursive: true
  });

  clearJsonFilesRecursive(detailsRootDir);

  for (const category of srdCategories) {
    const categoryDir = path.resolve(detailsRootDir, category);
    mkdirSync(categoryDir, {
      recursive: true
    });
    for (const detail of byCategoryDetails[category]) {
      const detailOutputPath = path.resolve(categoryDir, `${detail.id}.json`);
      writeFileSync(detailOutputPath, JSON.stringify(detail, null, 2), 'utf8');
    }
  }

  const byCategoryMeta = Object.fromEntries(
    srdCategories.map((category) => [category, byCategoryDetails[category].map((entry) => toMeta(entry))])
  ) as Record<SrdCategory, SrdEntryMeta[]>;

  const tagsByCategory: Record<SrdCategory, string[]> = {
    races: [],
    equipment: [],
    adventuring: [],
    combat: [],
    spellcasting: [],
    conditions: [],
    'magic-items': [],
    monsters: []
  };
  const tagCountsByCategory: Record<SrdCategory, Record<string, number>> = {
    races: {},
    equipment: {},
    adventuring: {},
    combat: {},
    spellcasting: {},
    conditions: {},
    'magic-items': {},
    monsters: {}
  };
  const bitsetsByCategory: SrdBitsetsIndex = {
    races: { allCount: 0, tagToBitset: {} },
    equipment: { allCount: 0, tagToBitset: {} },
    adventuring: { allCount: 0, tagToBitset: {} },
    combat: { allCount: 0, tagToBitset: {} },
    spellcasting: { allCount: 0, tagToBitset: {} },
    conditions: { allCount: 0, tagToBitset: {} },
    'magic-items': { allCount: 0, tagToBitset: {} },
    monsters: { allCount: 0, tagToBitset: {} }
  };

  for (const category of srdCategories) {
    const metas = byCategoryMeta[category];
    const tags = buildTagIndex(metas);
    tagsByCategory[category] = tags.allTags;
    tagCountsByCategory[category] = tags.tagCounts;
    bitsetsByCategory[category] = buildBitsets(metas, tags.allTags);
  }

  const generatedAt = new Date().toISOString();
  const indexPayload: SrdPackIndex = {
    version: 1,
    generatedAt,
    racesMeta: byCategoryMeta.races,
    equipmentMeta: byCategoryMeta.equipment,
    magicItemsMeta: byCategoryMeta['magic-items'],
    conditionsMeta: byCategoryMeta.conditions,
    rulesChaptersMeta: [
      ...byCategoryMeta.adventuring,
      ...byCategoryMeta.combat,
      ...byCategoryMeta.spellcasting
    ],
    monstersMeta: byCategoryMeta.monsters,
    byCategory: byCategoryMeta,
    tagsByCategory,
    tagCountsByCategory
  };

  const indexSource =
    '// This file is auto-generated by apps/web/scripts/build-srd-pack.ts.\n' +
    '// Do not edit manually.\n\n' +
    "import type { SrdPackIndex } from '../types';\n\n" +
    `export const srdPackIndex: SrdPackIndex = ${JSON.stringify(indexPayload, null, 2)};\n`;
  writeFileSync(indexOutputPath, indexSource, 'utf8');

  const bitsetsSource =
    '// This file is auto-generated by apps/web/scripts/build-srd-pack.ts.\n' +
    '// Do not edit manually.\n\n' +
    "import type { SrdBitsetsIndex } from '../types';\n\n" +
    `export const srdBitsetsIndex: SrdBitsetsIndex = ${JSON.stringify(bitsetsByCategory, null, 2)};\n`;
  writeFileSync(bitsetsOutputPath, bitsetsSource, 'utf8');

  const toc = {
    generatedAt,
    inputPath,
    ranges: extracted.ranges,
    attributionStatement: extracted.attributionStatement,
    countsByCategory: Object.fromEntries(srdCategories.map((category) => [category, byCategoryMeta[category].length]))
  };
  writeFileSync(tocOutputPath, JSON.stringify(toc, null, 2), 'utf8');

  console.log(`[srd:build] Input: ${inputPath}`);
  console.log(`[srd:build] Index: ${indexOutputPath}`);
  console.log(`[srd:build] Bitsets: ${bitsetsOutputPath}`);
  console.log(`[srd:build] Details root: ${detailsRootDir}`);
  console.log(
    `[srd:build] Counts: ${srdCategories.map((category) => `${category}=${byCategoryMeta[category].length}`).join(', ')}`
  );
};

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
