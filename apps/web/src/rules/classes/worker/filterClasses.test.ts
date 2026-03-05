import { describe, expect, it } from 'vitest';

import type { ClassesPackIndex } from '../types';
import { filterClassesWithIndex } from './filterClasses';

const buildTestIndex = (): ClassesPackIndex => {
  const entriesMeta: ClassesPackIndex['entriesMeta'] = [
    {
      id: 'wizard',
      kind: 'CLASS',
      name: 'Wizard',
      classId: 'wizard',
      tags: ['kind:class', 'class:wizard', 'spellcaster', 'caster:full', 'has:spell-slots'],
      nameFolded: 'wizard',
      summary: 'Arcane full caster.',
      detailUrl: '/rules/classes/entries/wizard.json',
      quick: {}
    },
    {
      id: 'wizard--school-of-evocation',
      kind: 'SUBCLASS',
      name: 'School of Evocation',
      classId: 'wizard',
      parentClassId: 'wizard',
      tags: ['kind:subclass', 'class:wizard', 'subclass:wizard--school-of-evocation', 'has:features'],
      nameFolded: 'school of evocation',
      summary: 'Evocation specialization.',
      detailUrl: '/rules/classes/entries/wizard--school-of-evocation.json',
      quick: {}
    },
    {
      id: 'fighter',
      kind: 'CLASS',
      name: 'Fighter',
      classId: 'fighter',
      tags: ['kind:class', 'class:fighter', 'has:features'],
      nameFolded: 'fighter',
      summary: 'Martial class.',
      detailUrl: '/rules/classes/entries/fighter.json',
      quick: {}
    }
  ];

  const words = Math.ceil(entriesMeta.length / 32);
  const tagBitsets: Record<string, number[]> = {};
  const tagCounts: Record<string, number> = {};
  const allTags = new Set<string>();

  entriesMeta.forEach((meta, index) => {
    for (const tag of meta.tags) {
      if (!tagBitsets[tag]) {
        tagBitsets[tag] = Array.from({
          length: words
        }).map(() => 0);
      }
      const word = Math.floor(index / 32);
      const offset = index % 32;
      tagBitsets[tag]![word] = (tagBitsets[tag]![word] ?? 0) | (1 << offset);
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      allTags.add(tag);
    }
  });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    count: entriesMeta.length,
    entriesMeta,
    allTags: [...allTags].sort(),
    tagCounts,
    tagBitsets
  };
};

describe('filterClassesWithIndex', () => {
  it('filters by kind + class + tag + name query', () => {
    const index = buildTestIndex();
    const result = filterClassesWithIndex({
      index,
      query: 'evocation',
      selectedTags: ['has:features'],
      kindFilter: 'SUBCLASS',
      classFilter: 'wizard',
      offset: 0,
      limit: 20
    });

    expect(result.total).toBe(1);
    expect(result.ids).toEqual(['wizard--school-of-evocation']);
  });
});
