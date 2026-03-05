import { describe, expect, it } from 'vitest';

import type { SpellsPack } from '../types';
import { buildTagGroups, filterSpellsWithPack } from './filterSpells';

const mockPack: SpellsPack = {
  generatedAt: '2026-03-04T00:00:00.000Z',
  count: 5,
  metas: [
    {
      slug: 'acid-splash',
      name: 'Acid Splash',
      source: "Player's Handbook",
      level: 0,
      levelLabel: 'Conjuration cantrip',
      school: 'Conjuration',
      castingTime: '1 action',
      range: '60 feet',
      duration: 'Instantaneous',
      components: 'V, S',
      classes: ['Sorcerer', 'Wizard'],
      flags: {
        ritual: false,
        dunamancy: false,
        dunamancyGraviturgy: false,
        dunamancyChronurgy: false,
        technomagic: false
      },
      flagCodes: [],
      tags: [
        'cantrip',
        'school:conjuration',
        'class:wizard',
        'concentration:no',
        'target:single'
      ],
      nameNormalized: 'acid splash'
    },
    {
      slug: 'alarm',
      name: 'Alarm',
      source: "Player's Handbook",
      level: 1,
      levelLabel: '1st-level Abjuration',
      school: 'Abjuration',
      castingTime: '1 minute',
      range: '30 feet',
      duration: '8 hours',
      components: 'V, S, M',
      classes: ['Wizard'],
      flags: {
        ritual: true,
        dunamancy: false,
        dunamancyGraviturgy: false,
        dunamancyChronurgy: false,
        technomagic: false
      },
      flagCodes: ['R'],
      tags: [
        'level:1',
        'school:abjuration',
        'class:wizard',
        'ritual',
        'concentration:no',
        'target:single'
      ],
      nameNormalized: 'alarm'
    },
    {
      slug: 'gift-of-alacrity',
      name: 'Gift Of Alacrity',
      source: "Explorer's Guide to Wildemount",
      level: 1,
      levelLabel: '1st-level Divination',
      school: 'Divination',
      castingTime: '1 minute',
      range: 'Touch',
      duration: '8 hours',
      components: 'V, S',
      classes: ['Wizard (Dunamancy)'],
      flags: {
        ritual: false,
        dunamancy: true,
        dunamancyGraviturgy: false,
        dunamancyChronurgy: true,
        technomagic: false
      },
      flagCodes: ['D', 'DC'],
      tags: [
        'level:1',
        'school:divination',
        'class:wizard',
        'dunamancy',
        'dunamancy:chronurgy',
        'concentration:no',
        'target:single'
      ],
      nameNormalized: 'gift of alacrity'
    },
    {
      slug: 'bless',
      name: 'Bless',
      source: "Player's Handbook",
      level: 1,
      levelLabel: '1st-level Enchantment',
      school: 'Enchantment',
      castingTime: '1 action',
      range: '30 feet',
      duration: 'Concentration, up to 1 minute',
      components: 'V, S, M',
      classes: ['Cleric', 'Paladin'],
      flags: {
        ritual: false,
        dunamancy: false,
        dunamancyGraviturgy: false,
        dunamancyChronurgy: false,
        technomagic: false
      },
      flagCodes: [],
      tags: [
        'level:1',
        'school:enchantment',
        'class:cleric',
        'concentration:yes',
        'target:single'
      ],
      nameNormalized: 'bless'
    },
    {
      slug: 'thunderwave',
      name: 'Thunderwave',
      source: "Player's Handbook",
      level: 1,
      levelLabel: '1st-level Evocation',
      school: 'Evocation',
      castingTime: '1 action',
      range: 'Self (15-foot cube)',
      duration: 'Instantaneous',
      components: 'V, S',
      classes: ['Bard', 'Druid', 'Sorcerer', 'Wizard'],
      flags: {
        ritual: false,
        dunamancy: false,
        dunamancyGraviturgy: false,
        dunamancyChronurgy: false,
        technomagic: false
      },
      flagCodes: [],
      tags: [
        'level:1',
        'school:evocation',
        'class:wizard',
        'concentration:no',
        'target:area'
      ],
      nameNormalized: 'thunderwave'
    }
  ],
  detailsBySlug: {},
  allTags: [
    'cantrip',
    'level:1',
    'school:conjuration',
    'school:abjuration',
    'school:divination',
    'school:enchantment',
    'school:evocation',
    'class:wizard',
    'class:cleric',
    'ritual',
    'dunamancy',
    'dunamancy:chronurgy',
    'concentration:yes',
    'concentration:no',
    'target:area',
    'target:single'
  ],
  tagBitsets: {
    cantrip: [1],
    'level:1': [30],
    'school:conjuration': [1],
    'school:abjuration': [2],
    'school:divination': [4],
    'school:enchantment': [8],
    'school:evocation': [16],
    'class:wizard': [23],
    'class:cleric': [8],
    ritual: [2],
    dunamancy: [4],
    'dunamancy:chronurgy': [4],
    'concentration:yes': [8],
    'concentration:no': [23],
    'target:area': [16],
    'target:single': [15]
  },
  tagCounts: {
    cantrip: 1,
    'level:1': 4,
    'school:conjuration': 1,
    'school:abjuration': 1,
    'school:divination': 1,
    'school:enchantment': 1,
    'school:evocation': 1,
    'class:wizard': 4,
    'class:cleric': 1,
    ritual: 1,
    dunamancy: 1,
    'dunamancy:chronurgy': 1,
    'concentration:yes': 1,
    'concentration:no': 4,
    'target:area': 1,
    'target:single': 4
  }
};

describe('filterSpellsWithPack', () => {
  it('filters by tag and then name query', () => {
    const result = filterSpellsWithPack({
      pack: mockPack,
      query: 'gift',
      tags: ['dunamancy'],
      offset: 0,
      limit: 10
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.slug).toBe('gift-of-alacrity');
  });

  it('supports pagination', () => {
    const result = filterSpellsWithPack({
      pack: mockPack,
      query: '',
      tags: ['class:wizard'],
      offset: 1,
      limit: 1
    });

    expect(result.total).toBe(4);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.slug).toBe('alarm');
  });

  it('filters by concentration and target tags', () => {
    const concentrationYes = filterSpellsWithPack({
      pack: mockPack,
      query: '',
      tags: ['concentration:yes'],
      offset: 0,
      limit: 10
    });

    expect(concentrationYes.total).toBe(1);
    expect(concentrationYes.items[0]?.slug).toBe('bless');

    const areaOnly = filterSpellsWithPack({
      pack: mockPack,
      query: '',
      tags: ['target:area'],
      offset: 0,
      limit: 10
    });

    expect(areaOnly.total).toBe(1);
    expect(areaOnly.items[0]?.slug).toBe('thunderwave');
  });

  it('groups tags for UI sections', () => {
    const groups = buildTagGroups(mockPack.allTags);

    expect(groups.flags).toContain('ritual');
    expect(groups.levels[0]).toBe('cantrip');
    expect(groups.classes).toContain('class:wizard');
    expect(groups.concentrations).toContain('concentration:yes');
    expect(groups.targets).toContain('target:area');
  });
});
