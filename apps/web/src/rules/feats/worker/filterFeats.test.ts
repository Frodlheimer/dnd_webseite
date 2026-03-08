import { describe, expect, it } from 'vitest';

import type { FeatsPackIndex } from '../types';
import { filterFeatsWithIndex } from './filterFeats';

const buildTestIndex = (): FeatsPackIndex => {
  const entriesMeta: FeatsPackIndex['entriesMeta'] = [
    {
      id: 'actor',
      slug: 'actor',
      name: 'Actor',
      group: 'Feats',
      collection: 'Published',
      tags: ['kind:feat', 'collection:published', 'ability:cha', 'has:ability-increase'],
      nameFolded: 'actor',
      summary: 'Mimicry and social manipulation.',
      detailUrl: '/rules/feats/entries/actor.json',
      quickFacts: {
        source: "Player's Handbook",
        racePrerequisites: [],
        abilityIncrease: {
          amount: 1,
          mode: 'FIXED',
          abilities: ['CHA'],
          description: 'Increase your Charisma score by 1.'
        }
      }
    },
    {
      id: 'dragon-fear',
      slug: 'dragon-fear',
      name: 'Dragon Fear',
      group: 'Racial Feats',
      collection: 'Published',
      tags: ['kind:feat', 'collection:published', 'race:dragonborn', 'ability:str', 'ability:con', 'ability:cha', 'has:prerequisite', 'has:ability-increase'],
      nameFolded: 'dragon fear',
      summary: 'Dragonborn roar feat.',
      detailUrl: '/rules/feats/entries/dragon-fear.json',
      quickFacts: {
        source: "Xanathar's Guide to Everything",
        prerequisite: 'Dragonborn',
        racePrerequisites: ['Dragonborn'],
        abilityIncrease: {
          amount: 1,
          mode: 'CHOICE',
          abilities: ['STR', 'CON', 'CHA'],
          description: 'Increase your Strength, Constitution, or Charisma score by 1.'
        }
      }
    },
    {
      id: 'resilient',
      slug: 'resilient',
      name: 'Resilient',
      group: 'Feats',
      collection: 'Published',
      tags: ['kind:feat', 'collection:published', 'ability:all', 'has:ability-increase'],
      nameFolded: 'resilient',
      summary: 'Increase any ability score by 1.',
      detailUrl: '/rules/feats/entries/resilient.json',
      quickFacts: {
        source: "Player's Handbook",
        racePrerequisites: [],
        abilityIncrease: {
          amount: 1,
          mode: 'CHOICE',
          abilities: ['ALL'],
          description: 'Increase one ability score of your choice by 1.'
        }
      }
    }
  ];

  const words = Math.ceil(entriesMeta.length / 32);
  const tagBitsets: Record<string, number[]> = {};
  const tagCounts: Record<string, number> = {};
  const allTags = new Set<string>();

  entriesMeta.forEach((meta, index) => {
    for (const tag of meta.tags) {
      if (!tagBitsets[tag]) {
        tagBitsets[tag] = Array.from({ length: words }).map(() => 0);
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

describe('filterFeatsWithIndex', () => {
  it('filters by race + ability + query', () => {
    const index = buildTestIndex();
    const result = filterFeatsWithIndex({
      index,
      query: 'dragon',
      selectedTags: [],
      raceFilter: 'dragonborn',
      abilityFilter: 'cha',
      offset: 0,
      limit: 20
    });

    expect(result.total).toBe(1);
    expect(result.ids).toEqual(['dragon-fear']);
  });
});
