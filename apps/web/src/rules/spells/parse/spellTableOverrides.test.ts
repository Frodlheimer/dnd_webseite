import { describe, expect, it } from 'vitest';

import { buildDescriptionBlocks, hasTableLikeSignature } from './spellTableOverrides';

describe('spellTableOverrides', () => {
  it('restores table blocks for animate-objects', () => {
    const input =
      'Intro text. Animated Object Statistics Size HP AC Attack Ability Scores Tiny 20 18 +8 to hit, 1d4 + 4 damage Str: 4, Dex: 18 Huge 80 10 +8 to hit, 2d12 + 4 damage Str: 18, Dex: 6 An animated object is a construct with AC and more text.';

    const restored = buildDescriptionBlocks({
      slug: 'animate-objects',
      description: input
    });

    expect(restored.restored).toBe(true);
    expect(restored.blocks.some((block) => block.type === 'table')).toBe(true);

    const table = restored.blocks.find((block) => block.type === 'table');
    expect(table?.type).toBe('table');
    if (table?.type === 'table') {
      expect(table.title).toBe('Animated Object Statistics');
      expect(table.columns).toEqual(['Size', 'HP', 'AC', 'Attack', 'Ability Scores']);
      expect(table.rows[0]?.[0]).toBe('Tiny');
    }
  });

  it('flags table-like text signatures', () => {
    expect(
      hasTableLikeSignature(
        'The DM rolls d100 and consults the table. Familiarity Mishap Similar Area Off Target On Target'
      )
    ).toBe(true);
    expect(
      hasTableLikeSignature(
        'On a hit, the target takes 2d8 + 1d6 damage. d8 Damage Type 1 Acid 2 Cold 3 Fire 4 Force.'
      )
    ).toBe(true);
    expect(
      hasTableLikeSignature(
        'When you cast this spell, choose one of the options below. Death. Each target must make a Constitution saving throw.'
      )
    ).toBe(true);
    expect(hasTableLikeSignature('A simple paragraph without tabular data.')).toBe(false);
  });

  it('restores list blocks for symbol', () => {
    const input =
      'You can choose one of the options below. Death. Each target must make a Constitution saving throw, taking 10d10 necrotic damage on a failed save, or half as much damage on a successful save. Discord. Each target must make a Constitution saving throw. Stunning. Each target must make a Wisdom saving throw and becomes stunned for 1 minute on a failed save. The spell ends.';

    const restored = buildDescriptionBlocks({
      slug: 'symbol',
      description: input
    });

    expect(restored.restored).toBe(true);
    const list = restored.blocks.find((block) => block.type === 'list');
    expect(list?.type).toBe('list');
    if (list?.type === 'list') {
      expect(list.title).toBe('Symbol Effects');
      expect(list.items).toHaveLength(8);
      expect(list.items[0]).toContain('Death.');
      expect(list.items[7]).toContain('Stunning.');
    }
  });
});
