import { describe, expect, it } from 'vitest';

import type { LineagesPackIndex } from '../types';
import { filterLineagesWithIndex } from './filterLineages';

const buildTestIndex = (): LineagesPackIndex => {
  const entriesMeta: LineagesPackIndex['entriesMeta'] = [
    {
      id: 'elf',
      slug: 'elf',
      name: 'Elf',
      group: 'Standard Lineages',
      groupSlug: 'standard-lineages',
      tags: ['kind:lineage', 'group:standard-lineages', 'setting:none', 'has:traits', 'size:medium'],
      nameFolded: 'elf',
      summary: 'Graceful fey lineage.',
      detailUrl: '/rules/lineages/entries/elf.json',
      quickFacts: {
        size: 'Medium'
      }
    },
    {
      id: 'elf-astral',
      slug: 'elf-astral',
      name: 'Elf Astral',
      group: 'Setting Specific Lineages',
      groupSlug: 'setting-specific-lineages',
      setting: 'Spelljammer',
      settingSlug: 'spelljammer',
      tags: [
        'kind:lineage',
        'group:setting-specific-lineages',
        'setting:spelljammer',
        'has:traits',
        'has:darkvision',
        'size:medium'
      ],
      nameFolded: 'elf astral',
      summary: 'Astral adaptation of elf.',
      detailUrl: '/rules/lineages/entries/elf-astral.json',
      quickFacts: {
        darkvision: '60 feet'
      }
    },
    {
      id: 'bugbear',
      slug: 'bugbear',
      name: 'Bugbear',
      group: 'Monstrous Lineages',
      groupSlug: 'monstrous-lineages',
      tags: ['kind:lineage', 'group:monstrous-lineages', 'setting:none', 'has:traits', 'size:medium'],
      nameFolded: 'bugbear',
      summary: 'Stealthy brute.',
      detailUrl: '/rules/lineages/entries/bugbear.json',
      quickFacts: {}
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

describe('filterLineagesWithIndex', () => {
  it('filters by group + setting + selected tag + name query', () => {
    const index = buildTestIndex();
    const result = filterLineagesWithIndex({
      index,
      query: 'astral',
      selectedTags: ['has:darkvision'],
      groupFilter: 'setting-specific-lineages',
      settingFilter: 'spelljammer',
      offset: 0,
      limit: 20
    });

    expect(result.total).toBe(1);
    expect(result.ids).toEqual(['elf-astral']);
  });
});
