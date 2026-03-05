import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  buildClassesPackFromContentEntries,
  type SourceEntryJson
} from '../src/rules/classes/parse/parseClassesContentJson';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const envDirRaw = process.env.CLASSES_JSON_DIR?.trim();
const envDir = envDirRaw ? path.resolve(envDirRaw) : null;
const fallbackDir = path.resolve(repoRoot, 'content');

const indexOutputPath = path.resolve(repoRoot, 'apps/web/src/rules/classes/generated/classesIndex.ts');
const detailsOutputDir = path.resolve(repoRoot, 'apps/web/public/rules/classes/entries');

type IndexEntry = {
  file?: string;
};

const resolveInputDir = (): string => {
  if (envDir) {
    return envDir;
  }

  return fallbackDir;
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

const normalizeSpellFoldedName = (value: string): string => {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2019\u2018â€™'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

const loadSpellSlugMap = async (): Promise<Map<string, string>> => {
  const output = new Map<string, string>();
  const spellIndexModulePath = path.resolve(
    repoRoot,
    'apps/web/src/rules/spells/generated/spellNameIndex.ts'
  );
  if (!existsSync(spellIndexModulePath)) {
    return output;
  }

  try {
    const moduleUrl = pathToFileURL(spellIndexModulePath).href;
    const module = (await import(moduleUrl)) as {
      spellNameIndex?: Array<{
        slug: string;
        nameFolded?: string;
        nameNormalized?: string;
        name: string;
      }>;
    };
    const entries = module.spellNameIndex ?? [];
    for (const entry of entries) {
      const key = normalizeSpellFoldedName(entry.nameFolded ?? entry.nameNormalized ?? entry.name);
      if (key.length > 0) {
        output.set(key, entry.slug);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[classes:build] Could not load spellNameIndex; spell slug refs will be best-effort only.\n${message}`);
  }

  return output;
};

const resolveOrderedInputFiles = (inputDir: string): string[] => {
  const indexPath = path.resolve(inputDir, '_index.json');
  if (existsSync(indexPath)) {
    const parsed = JSON.parse(readFileSync(indexPath, 'utf8')) as IndexEntry[];
    const fromIndex = parsed
      .map((entry) => entry.file?.trim())
      .filter((entry): entry is string => !!entry && entry.toLowerCase().endsWith('.json'))
      .map((entry) => path.resolve(inputDir, entry))
      .filter((entry) => existsSync(entry));

    if (fromIndex.length > 0) {
      return fromIndex;
    }
  }

  return readdirSync(inputDir)
    .filter((entry) => entry.toLowerCase().endsWith('.json') && entry.toLowerCase() !== '_index.json')
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => path.resolve(inputDir, entry));
};

const loadEntries = (inputDir: string): Array<{ fileName: string; payload: SourceEntryJson }> => {
  const files = resolveOrderedInputFiles(inputDir);

  return files
    .map((filePath) => {
      const fileName = path.basename(filePath);
      const payload = JSON.parse(readFileSync(filePath, 'utf8')) as SourceEntryJson;
      if (!payload || (payload.type !== 'CLASS' && payload.type !== 'SUBCLASS')) {
        return null;
      }
      if (!payload.name || !payload.content || !Array.isArray(payload.content.tree)) {
        return null;
      }
      return {
        fileName,
        payload
      };
    })
    .filter((entry): entry is { fileName: string; payload: SourceEntryJson } => !!entry);
};

const run = async (): Promise<void> => {
  const inputDir = resolveInputDir();
  if (!existsSync(inputDir)) {
    const lines: string[] = [];
    lines.push('[classes:build] Failed to build classes/subclasses pack.');
    lines.push(`CLASSES_JSON_DIR: ${envDirRaw ? envDirRaw : '(not set)'}`);
    lines.push(`Tried input dir: ${inputDir}`);
    lines.push(`Fallback dir: ${fallbackDir}`);
    lines.push('Provide CLASSES_JSON_DIR or place class/subclass JSON files in ./content.');
    throw new Error(lines.join('\n'));
  }

  const entries = loadEntries(inputDir);
  if (entries.length === 0) {
    throw new Error(
      `[classes:build] No valid CLASS/SUBCLASS JSON files found in ${inputDir}.`
    );
  }

  const spellSlugByName = await loadSpellSlugMap();
  const pack = buildClassesPackFromContentEntries(entries, {
    spellSlugByName
  });

  mkdirSync(path.dirname(indexOutputPath), {
    recursive: true
  });
  mkdirSync(detailsOutputDir, {
    recursive: true
  });
  clearDirectoryJsonFiles(detailsOutputDir);

  for (const detail of pack.details) {
    const outputPath = path.resolve(detailsOutputDir, `${detail.id}.json`);
    writeFileSync(outputPath, JSON.stringify(detail, null, 2), 'utf8');
  }

  const banner =
    '// This file is auto-generated by apps/web/scripts/build-classes-pack.ts.\n' +
    '// Do not edit manually.\n\n';
  const source =
    `${banner}` +
    "import type { ClassesPackIndex } from '../types';\n\n" +
    `export const classesPackIndex: ClassesPackIndex = ${JSON.stringify(pack.index, null, 2)};\n`;
  writeFileSync(indexOutputPath, source, 'utf8');

  const classCount = pack.details.filter((entry) => entry.kind === 'CLASS').length;
  const subclassCount = pack.details.filter((entry) => entry.kind === 'SUBCLASS').length;

  console.log(`[classes:build] Built classes pack with ${pack.index.count} entries.`);
  console.log(`[classes:build] Classes: ${classCount}, Subclasses: ${subclassCount}`);
  console.log(`[classes:build] Input dir: ${inputDir}`);
  console.log(`[classes:build] Index output: ${indexOutputPath}`);
  console.log(`[classes:build] Detail output: ${detailsOutputDir}`);
};

void run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});

