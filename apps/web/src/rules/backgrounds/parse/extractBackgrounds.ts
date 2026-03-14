import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import type { BackgroundStructuredData } from '../model';
import { extractStructuredBackgroundData } from './extractStructuredBackgroundData';
import type { BackgroundTreeNode } from './treeToBlocks';

export type BackgroundSourcePage = {
  kind: 'BACKGROUND';
  slug: string;
  page_title: string;
  aliases?: string[];
  categories?: string[];
  content: {
    format: 'html-structure-tree';
    tree: BackgroundTreeNode[];
    html?: string;
  };
};

const IGNORED_FILENAMES = new Set(['_index.json', 'background_links.json']);

export const discoverBackgroundPageFiles = (backgroundsDir: string): string[] => {
  const pagesDir = path.join(backgroundsDir, 'pages');
  const targetDir =
    existsSync(pagesDir) && statSync(pagesDir).isDirectory() ? pagesDir : backgroundsDir;

  return readdirSync(targetDir)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .filter((name) => !IGNORED_FILENAMES.has(name.toLowerCase()))
    .map((name) => path.join(targetDir, name))
    .sort((left, right) => left.localeCompare(right));
};

export const loadBackgroundPage = (filePath: string): BackgroundSourcePage => {
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<BackgroundSourcePage>;
  if (parsed.kind !== 'BACKGROUND' || typeof parsed.slug !== 'string' || !Array.isArray(parsed.content?.tree)) {
    throw new Error(`Invalid background page JSON: ${filePath}`);
  }
  return parsed as BackgroundSourcePage;
};

export const extractBackgroundsFromDirectory = (backgroundsDir: string): BackgroundSourcePage[] => {
  return discoverBackgroundPageFiles(backgroundsDir).map((filePath) => loadBackgroundPage(filePath));
};

export const extractStructuredBackgroundsFromDirectory = (
  backgroundsDir: string
): BackgroundStructuredData[] => {
  return extractBackgroundsFromDirectory(backgroundsDir).map((page) => extractStructuredBackgroundData(page));
};
