import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractBackgroundsFromDirectory } from '../src/rules/backgrounds/parse/extractBackgrounds';
import { extractStructuredBackgroundData } from '../src/rules/backgrounds/parse/extractStructuredBackgroundData';
import {
  dedupeStrings,
  foldBackgroundText,
  slugifyBackgroundValue
} from '../src/rules/backgrounds/parse/normalizeNames';
import type {
  BackgroundMeta,
  BackgroundStructuredData,
  BackgroundsLookup,
  BackgroundsPackIndex
} from '../src/rules/backgrounds/model';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const envPathRaw = process.env.BACKGROUNDS_DIR?.trim();
const envPath = envPathRaw ? path.resolve(envPathRaw) : null;
const fallbackPath = path.resolve(repoRoot, 'content/background');

const indexOutputPath = path.resolve(
  repoRoot,
  'apps/web/src/rules/backgrounds/generated/backgroundsIndex.ts'
);
const lookupOutputPath = path.resolve(
  repoRoot,
  'apps/web/src/characterBuilder/generated/backgroundsLookup.ts'
);
const detailsOutputDir = path.resolve(repoRoot, 'apps/web/public/rules/backgrounds');

const resolveInputPath = (): string => {
  if (envPath && existsSync(envPath) && statSync(envPath).isDirectory()) {
    return envPath;
  }
  if (existsSync(fallbackPath) && statSync(fallbackPath).isDirectory()) {
    return fallbackPath;
  }

  const lines: string[] = [];
  lines.push('[backgrounds:build] Failed to resolve backgrounds directory.');
  lines.push(`BACKGROUNDS_DIR: ${envPathRaw ? envPathRaw : '(not set)'}`);
  if (envPath) {
    lines.push(`Resolved BACKGROUNDS_DIR: ${envPath}`);
  }
  lines.push(`Fallback path: ${fallbackPath}`);
  throw new Error(lines.join('\n'));
};

const clearDirectoryJsonFiles = (directoryPath: string): void => {
  if (!existsSync(directoryPath)) {
    return;
  }

  readdirSync(directoryPath, {
    withFileTypes: true
  }).forEach((entry) => {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      clearDirectoryJsonFiles(fullPath);
      return;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      rmSync(fullPath, {
        force: true
      });
    }
  });
};

const buildBitsets = (metas: BackgroundMeta[], allTags: string[]): Record<string, number[]> => {
  const words = Math.ceil(metas.length / 32);
  const tagBitsets: Record<string, number[]> = {};
  allTags.forEach((tag) => {
    tagBitsets[tag] = Array.from({
      length: words
    }).map(() => 0);
  });

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

const toMeta = (detail: BackgroundStructuredData): BackgroundMeta => {
  const searchParts = [
    detail.name,
    ...detail.aliases,
    ...detail.categories,
    ...detail.tags,
    detail.summary ?? ''
  ].filter(Boolean);

  return {
    id: detail.id,
    slug: detail.slug,
    name: detail.name,
    aliases: [...detail.aliases],
    categories: [...detail.categories],
    source: 'wikidot-local-export',
    tags: [...detail.tags],
    summary: detail.summary,
    grants: {
      skills: [...detail.grants.skills],
      tools: [...detail.grants.tools],
      languages: [...detail.grants.languages],
      hasChoices: Boolean(
        detail.grants.skillChoices || detail.grants.toolChoices || detail.grants.languageChoices
      ),
      hasEquipment: Boolean(
        detail.equipment.fixedItems.length > 0 ||
          detail.equipment.choiceGroups.length > 0 ||
          detail.equipment.coins
      ),
      hasFeature: Boolean(detail.feature.name || detail.feature.rulesText)
    },
    detailUrl: `/rules/backgrounds/${detail.id}.json`,
    nameFolded: foldBackgroundText(detail.name),
    aliasFolded: detail.aliases.map((alias) => foldBackgroundText(alias)).filter(Boolean),
    searchTextFolded: foldBackgroundText(searchParts.join(' '))
  };
};

const toLookup = (details: BackgroundStructuredData[]): BackgroundsLookup => {
  const byId = Object.fromEntries(
    details.map((detail) => [
      detail.id,
      {
        id: detail.id,
        slug: detail.slug,
        name: detail.name,
        aliases: [...detail.aliases],
        categories: [...detail.categories],
        summary: detail.summary ?? '',
        grants: detail.grants,
        featureName: detail.feature.name ?? null,
        equipmentSummary: detail.equipment.fixedItems.map((item) =>
          item.quantity && item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name
        ),
        detailUrl: `/rules/backgrounds/${detail.id}.json`
      }
    ])
  );

  const aliasToId = Object.fromEntries(
    details.flatMap((detail) =>
      dedupeStrings([detail.name, ...detail.aliases])
        .filter(Boolean)
        .flatMap((alias) => {
          const folded = foldBackgroundText(alias);
          if (!folded) {
            return [];
          }
          return [[folded, detail.id]] as Array<[string, string]>;
        })
    )
  );

  const categoryGroups = Object.fromEntries(
    [...new Set(details.flatMap((detail) => detail.categories))]
      .sort((left, right) => left.localeCompare(right))
      .map((category) => [
        category,
        details.filter((detail) => detail.categories.includes(category)).map((detail) => detail.id)
      ])
  );

  return {
    byId,
    aliasToId,
    categoryGroups
  };
};

const run = (): void => {
  const inputPath = resolveInputPath();
  const pages = extractBackgroundsFromDirectory(inputPath);
  const details = pages.map((page) => extractStructuredBackgroundData(page));
  const metas = details
    .map((detail) => {
      const meta = toMeta(detail);
      const categoryTags = detail.categories.map(
        (category) => `category:${slugifyBackgroundValue(category)}`
      );
      meta.tags = dedupeStrings([...meta.tags, ...categoryTags]).sort((left, right) =>
        left.localeCompare(right)
      );
      return meta;
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const tagCounts: Record<string, number> = {};
  metas.forEach((meta) => {
    meta.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    });
  });

  const allTags = Object.keys(tagCounts).sort((left, right) => left.localeCompare(right));
  const tagBitsets = buildBitsets(metas, allTags);
  const filterOptions = {
    categories: [...new Set(metas.flatMap((meta) => meta.categories))].sort((left, right) =>
      left.localeCompare(right)
    )
  };

  const generatedAt = new Date().toISOString();
  const indexPayload: BackgroundsPackIndex = {
    version: 1,
    generatedAt,
    backgroundsMeta: metas,
    allTags,
    tagCounts,
    tagBitsets,
    filterOptions
  };

  const lookupPayload = toLookup(details);

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
    writeFileSync(
      path.resolve(detailsOutputDir, `${detail.id}.json`),
      JSON.stringify(detail, null, 2),
      'utf8'
    );
  });

  const banner =
    '// This file is auto-generated by apps/web/scripts/build-backgrounds-pack.ts.\n// Do not edit manually.\n\n';
  writeFileSync(
    indexOutputPath,
    `${banner}import type { BackgroundsPackIndex } from '../model';\n\nexport const backgroundsPackIndex: BackgroundsPackIndex = ${JSON.stringify(indexPayload, null, 2)};\n`,
    'utf8'
  );
  writeFileSync(
    lookupOutputPath,
    `${banner}import type { BackgroundsLookup } from '../../rules/backgrounds/model';\n\nexport const backgroundsLookup: BackgroundsLookup = ${JSON.stringify(lookupPayload, null, 2)};\n`,
    'utf8'
  );

  console.log(`[backgrounds:build] Input: ${inputPath}`);
  console.log(`[backgrounds:build] Built ${details.length} background entries.`);
  console.log(`[backgrounds:build] Index output: ${indexOutputPath}`);
  console.log(`[backgrounds:build] Lookup output: ${lookupOutputPath}`);
  console.log(`[backgrounds:build] Detail output: ${detailsOutputDir}`);
};

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
