import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeSrdBlocks, loadSrdJson, foldSrdText } from '../src/rules/srd/parse/srdJsonLoader';
import { extractRacesFromSrd } from '../src/rules/races/parse/extractRacesFromSrd';
import { extractRaceStructuredData } from '../src/rules/races/parse/extractRaceStructuredData';
import type { RaceEntryMeta, RaceLookup, RaceStructuredData, RacesPackIndex } from '../src/rules/races/model';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const envPathRaw = process.env.SRD_JSON_PATH?.trim();
const envPath = envPathRaw ? path.resolve(envPathRaw) : null;
const fallbackPath = path.resolve(repoRoot, 'content/SRD_CC_v5.1.json');

const indexOutputPath = path.resolve(repoRoot, 'apps/web/src/rules/races/generated/racesIndex.ts');
const lookupOutputPath = path.resolve(repoRoot, 'apps/web/src/rules/races/generated/raceLookup.ts');
const detailsOutputDir = path.resolve(repoRoot, 'apps/web/public/rules/races');

const resolveInputPath = (): string => {
  if (envPath && existsSync(envPath) && statSync(envPath).isFile()) {
    return envPath;
  }

  if (existsSync(fallbackPath) && statSync(fallbackPath).isFile()) {
    return fallbackPath;
  }

  const lines: string[] = [];
  lines.push('[races:build] Failed to resolve SRD JSON input file.');
  lines.push(`SRD_JSON_PATH: ${envPathRaw ? envPathRaw : '(not set)'}`);
  if (envPath) {
    lines.push(`Resolved SRD_JSON_PATH: ${envPath}`);
  }
  lines.push(`Fallback path: ${fallbackPath}`);
  lines.push('Provide SRD_JSON_PATH or place SRD_CC_v5.1.json at ./content/SRD_CC_v5.1.json');
  throw new Error(lines.join('\n'));
};

const clearDirectoryJsonFiles = (directoryPath: string): void => {
  if (!existsSync(directoryPath)) {
    return;
  }

  const entries = readdirSync(directoryPath, {
    withFileTypes: true
  });
  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      clearDirectoryJsonFiles(fullPath);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      rmSync(fullPath, {
        force: true
      });
    }
  }
};

const buildBitsets = (metas: RaceEntryMeta[], allTags: string[]): Record<string, number[]> => {
  const words = Math.ceil(metas.length / 32);
  const tagBitsets: Record<string, number[]> = {};
  for (const tag of allTags) {
    tagBitsets[tag] = Array.from({
      length: words
    }).map(() => 0);
  }

  metas.forEach((meta, index) => {
    const wordIndex = Math.floor(index / 32);
    const bit = 1 << (index % 32);
    meta.tags.forEach((tag) => {
      const bitset = tagBitsets[tag];
      if (!bitset) {
        return;
      }
      bitset[wordIndex] = ((bitset[wordIndex] ?? 0) | bit) >>> 0;
    });
  });

  return tagBitsets;
};

const toMeta = (detail: RaceStructuredData): RaceEntryMeta => ({
  id: detail.id,
  name: detail.name,
  kind: detail.kind,
  parentRaceId: detail.parentRaceId ?? null,
  source: 'srd51',
  tags: [...detail.tags].sort((left, right) => left.localeCompare(right)),
  summary: detail.summary ?? '',
  size: detail.basics.size ?? null,
  speedWalk: detail.basics.speedWalk ?? null,
  darkvision: detail.senses.darkvision ?? null,
  languagesGranted: [...detail.languages.granted],
  structuredFlags: {
    hasAbilityBonuses: Object.keys(detail.abilities.bonuses).length > 0 || !!detail.abilities.bonusChoice,
    hasToolChoices: !!detail.proficiencies.toolChoices,
    hasWeaponProficiencies: detail.proficiencies.weapons.length > 0,
    hasSkillChoices: !!detail.proficiencies.skillChoices,
    hasResistances: detail.defenses.resistances.length > 0
  },
  detailUrl: `/rules/races/${detail.id}.json`,
  nameFolded: foldSrdText(detail.name)
});

const run = (): void => {
  const inputPath = resolveInputPath();
  const normalizedBlocks = normalizeSrdBlocks(loadSrdJson(inputPath));
  const extracted = extractRacesFromSrd(normalizedBlocks);
  const details = extracted.entries.map((entry) => extractRaceStructuredData(entry));

  details.forEach((detail) => {
    if ((extracted.parentToSubraces[detail.id] ?? []).length > 0 && !detail.tags.includes('has:subrace')) {
      detail.tags = [...detail.tags, 'has:subrace'].sort((left, right) => left.localeCompare(right));
    }
  });

  const metas = details.map((detail) => toMeta(detail));
  const tagCounts: Record<string, number> = {};
  metas.forEach((meta) => {
    meta.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    });
  });

  const allTags = Object.keys(tagCounts).sort((left, right) => left.localeCompare(right));
  const tagBitsets = buildBitsets(metas, allTags);

  const filterOptions = {
    sizes: [...new Set(metas.map((meta) => meta.size).filter((value): value is string => typeof value === 'string'))].sort(
      (left, right) => left.localeCompare(right)
    ),
    speeds: [...new Set(metas.map((meta) => meta.speedWalk).filter((value): value is number => typeof value === 'number'))].sort(
      (left, right) => left - right
    ),
    darkvisionValues: [
      ...new Set(metas.map((meta) => meta.darkvision).filter((value): value is number => typeof value === 'number'))
    ].sort((left, right) => left - right),
    languages: [...new Set(metas.flatMap((meta) => meta.languagesGranted))].sort((left, right) => left.localeCompare(right))
  };

  const generatedAt = new Date().toISOString();
  const indexPayload: RacesPackIndex = {
    version: 1,
    generatedAt,
    racesMeta: metas,
    allTags,
    tagCounts,
    tagBitsets,
    filterOptions
  };

  const lookupPayload: RaceLookup = {
    byId: Object.fromEntries(
      details.map((detail) => [
        detail.id,
        {
          id: detail.id,
          kind: detail.kind,
          parentRaceId: detail.parentRaceId ?? null,
          name: detail.name
        }
      ])
    ),
    parentToSubraces: extracted.parentToSubraces
  };

  mkdirSync(path.dirname(indexOutputPath), {
    recursive: true
  });
  mkdirSync(path.dirname(lookupOutputPath), {
    recursive: true
  });
  mkdirSync(detailsOutputDir, {
    recursive: true
  });
  clearDirectoryJsonFiles(detailsOutputDir);

  details.forEach((detail) => {
    const outputPath = path.resolve(detailsOutputDir, `${detail.id}.json`);
    writeFileSync(outputPath, JSON.stringify(detail, null, 2), 'utf8');
  });

  const banner = '// This file is auto-generated by apps/web/scripts/build-races-pack.ts.\n// Do not edit manually.\n\n';
  writeFileSync(
    indexOutputPath,
    `${banner}import type { RacesPackIndex } from '../model';\n\nexport const racesPackIndex: RacesPackIndex = ${JSON.stringify(indexPayload, null, 2)};\n`,
    'utf8'
  );
  writeFileSync(
    lookupOutputPath,
    `${banner}import type { RaceLookup } from '../model';\n\nexport const raceLookup: RaceLookup = ${JSON.stringify(lookupPayload, null, 2)};\n`,
    'utf8'
  );

  console.log(`[races:build] Input: ${inputPath}`);
  console.log(`[races:build] Built ${details.length} race entries.`);
  console.log(`[races:build] Index output: ${indexOutputPath}`);
  console.log(`[races:build] Lookup output: ${lookupOutputPath}`);
  console.log(`[races:build] Detail output: ${detailsOutputDir}`);
};

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
