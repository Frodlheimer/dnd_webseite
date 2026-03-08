// @vitest-environment node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const webRoot = process.cwd();
const generatedRoot = path.resolve(webRoot, 'src/rules/srd/generated');
const publicRoot = path.resolve(webRoot, 'public/rules/srd');

const collectJsonFiles = (rootPath: string): string[] => {
  const result: string[] = [];
  const visit = (currentPath: string) => {
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        result.push(fullPath);
      }
    }
  };
  visit(rootPath);
  return result;
};

describe('SRD build artifacts', () => {
  it(
    'generates index, bitsets, and detail json files without wikidot links',
    () => {
    const indexPath = path.resolve(generatedRoot, 'srdIndex.ts');
    const bitsetsPath = path.resolve(generatedRoot, 'srdBitsets.ts');

    expect(existsSync(indexPath)).toBe(true);
    expect(existsSync(bitsetsPath)).toBe(true);
    expect(existsSync(publicRoot)).toBe(true);

    const detailFiles = collectJsonFiles(publicRoot);
    expect(detailFiles.length).toBeGreaterThan(20);

    const indexSource = readFileSync(indexPath, 'utf8');
    const bitsetsSource = readFileSync(bitsetsPath, 'utf8');
    expect(indexSource.toLowerCase()).not.toContain('wikidot');
    expect(bitsetsSource.toLowerCase()).not.toContain('wikidot');

      for (const filePath of detailFiles) {
        const fileSource = readFileSync(filePath, 'utf8');
        expect(fileSource.toLowerCase()).not.toContain('wikidot');
      }
    },
    30000
  );
});
