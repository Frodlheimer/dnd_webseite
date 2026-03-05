import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildClassesPackFromText } from './parseClassesTxt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.resolve(__dirname, './fixtures/classes-fixture.txt');

describe('buildClassesPackFromText', () => {
  it('parses entries, tables, and removes all wikidot links', () => {
    const fixture = readFileSync(fixturePath, 'utf8');
    const spellSlugByName = new Map<string, string>([
      ['magic missile', 'magic-missile'],
      ['shield', 'shield'],
      ['fireball', 'fireball']
    ]);

    const result = buildClassesPackFromText(fixture, {
      spellSlugByName
    });

    expect(result.index.count).toBe(2);
    expect(result.details).toHaveLength(2);

    const serialized = JSON.stringify(result);
    expect(serialized.toLowerCase()).not.toContain('wikidot');
    expect(serialized).not.toContain('URL:');

    const wizard = result.details.find((entry) => entry.kind === 'CLASS');
    expect(wizard).toBeTruthy();
    expect(wizard?.documentBlocks.some((block) => block.type === 'table')).toBe(true);

    const subclass = result.details.find((entry) => entry.kind === 'SUBCLASS');
    expect(subclass).toBeTruthy();
    expect(subclass?.extracted.subclassLevelStart).toBe(2);
  });
});
