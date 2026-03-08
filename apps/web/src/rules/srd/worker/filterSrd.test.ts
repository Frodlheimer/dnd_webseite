import { describe, expect, it } from 'vitest';

import type { SrdBitsetsIndex, SrdPackIndex } from '../types';
import { filterSrdWithIndex } from './filterSrd';

const categories = [
  'races',
  'equipment',
  'adventuring',
  'combat',
  'spellcasting',
  'conditions',
  'magic-items',
  'monsters'
] as const;

const buildFixture = (): { index: SrdPackIndex; bitsets: SrdBitsetsIndex } => {
  const monstersMeta: SrdPackIndex['monstersMeta'] = [
    {
      id: 'monster-ape',
      title: 'Ape',
      category: 'monsters',
      section: 'Monsters',
      tags: ['category:monsters', 'source:srd51', 'type:beast', 'size:medium', 'cr:1/2'],
      nameFolded: 'ape',
      summary: 'Medium beast.',
      detailUrl: '/rules/srd/monsters/monster-ape.json',
      sourcePageRange: 'p.261',
      extra: {
        sourcePageStart: 261,
        sourcePageEnd: 261,
        monsterType: 'beast',
        size: 'medium',
        challengeRating: '1/2'
      }
    },
    {
      id: 'monster-zombie',
      title: 'Zombie',
      category: 'monsters',
      section: 'Monsters',
      tags: ['category:monsters', 'source:srd51', 'type:undead', 'size:medium', 'cr:1/4'],
      nameFolded: 'zombie',
      summary: 'Medium undead.',
      detailUrl: '/rules/srd/monsters/monster-zombie.json',
      sourcePageRange: 'p.341',
      extra: {
        sourcePageStart: 341,
        sourcePageEnd: 341,
        monsterType: 'undead',
        size: 'medium',
        challengeRating: '1/4'
      }
    },
    {
      id: 'monster-adult-red-dragon',
      title: 'Adult Red Dragon',
      category: 'monsters',
      section: 'Monsters',
      tags: ['category:monsters', 'source:srd51', 'type:dragon', 'size:huge', 'cr:17'],
      nameFolded: 'adult red dragon',
      summary: 'Huge dragon.',
      detailUrl: '/rules/srd/monsters/monster-adult-red-dragon.json',
      sourcePageRange: 'p.274',
      extra: {
        sourcePageStart: 274,
        sourcePageEnd: 274,
        monsterType: 'dragon',
        size: 'huge',
        challengeRating: '17'
      }
    }
  ];

  const makeTagBitsets = (metas: SrdPackIndex['monstersMeta']): Record<string, number[]> => {
    const words = Math.ceil(metas.length / 32);
    const index: Record<string, number[]> = {};
    metas.forEach((meta, rowIndex) => {
      meta.tags.forEach((tag) => {
        if (!index[tag]) {
          index[tag] = Array.from({ length: words }).map(() => 0);
        }
        const word = Math.floor(rowIndex / 32);
        const bit = 1 << (rowIndex % 32);
        index[tag]![word] = (index[tag]![word] ?? 0) | bit;
      });
    });
    return index;
  };

  const monstersTags = Array.from(new Set(monstersMeta.flatMap((meta) => meta.tags))).sort();
  const monstersTagCounts = monstersTags.reduce<Record<string, number>>((accumulator, tag) => {
    accumulator[tag] = monstersMeta.filter((meta) => meta.tags.includes(tag)).length;
    return accumulator;
  }, {});

  const byCategory = Object.fromEntries(
    categories.map((category) => [category, category === 'monsters' ? monstersMeta : []])
  ) as SrdPackIndex['byCategory'];

  const tagsByCategory = Object.fromEntries(
    categories.map((category) => [category, category === 'monsters' ? monstersTags : []])
  ) as SrdPackIndex['tagsByCategory'];

  const tagCountsByCategory = Object.fromEntries(
    categories.map((category) => [category, category === 'monsters' ? monstersTagCounts : {}])
  ) as SrdPackIndex['tagCountsByCategory'];

  const index: SrdPackIndex = {
    version: 1,
    generatedAt: new Date().toISOString(),
    racesMeta: [],
    equipmentMeta: [],
    magicItemsMeta: [],
    conditionsMeta: [],
    rulesChaptersMeta: [],
    monstersMeta,
    byCategory,
    tagsByCategory,
    tagCountsByCategory
  };

  const bitsets = Object.fromEntries(
    categories.map((category) => [
      category,
      {
        allCount: category === 'monsters' ? monstersMeta.length : 0,
        tagToBitset: category === 'monsters' ? makeTagBitsets(monstersMeta) : {}
      }
    ])
  ) as SrdBitsetsIndex;

  return {
    index,
    bitsets
  };
};

describe('filterSrdWithIndex', () => {
  it('filters monsters by query + type + cr', () => {
    const { index, bitsets } = buildFixture();

    const filtered = filterSrdWithIndex({
      category: 'monsters',
      index,
      bitsets,
      query: 'dragon',
      selectedTags: [],
      monsterTypeFilter: 'dragon',
      monsterCrFilter: '17',
      offset: 0,
      limit: 20
    });

    expect(filtered.total).toBe(1);
    expect(filtered.ids).toEqual(['monster-adult-red-dragon']);
  });
});
