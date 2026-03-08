import { describe, expect, it } from 'vitest';

import { formatInitiativeAsMarkdown, formatInitiativeAsTsv, rollInitiative } from './initiative';

const createRollSequence = (values: number[]) => {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    return value ?? 1;
  };
};

describe('rollInitiative', () => {
  it('applies modifiers and sorts by total, then d20, then name', () => {
    const rows = rollInitiative(
      [
        { name: 'Goblin', count: 2, initiativeMod: 2 },
        { name: 'Orc', count: 1, initiativeMod: 3 }
      ],
      {
        createIndividualEntries: true,
        globalModifier: 1,
        rollDie: createRollSequence([10, 5, 9])
      }
    );

    expect(rows).toHaveLength(3);
    expect(rows[0]?.name).toBe('Goblin #1');
    expect(rows[0]?.modifier).toBe(3);
    expect(rows[0]?.total).toBe(13);

    expect(rows[1]?.name).toBe('Orc');
    expect(rows[1]?.modifier).toBe(4);
    expect(rows[1]?.total).toBe(13);
    expect(rows[1]?.d20).toBe(9);

    expect(rows[2]?.name).toBe('Goblin #2');
    expect(rows[2]?.total).toBe(8);
  });

  it('supports grouped mode with count labels', () => {
    const rows = rollInitiative(
      [
        { name: 'Skeleton', count: 4, initiativeMod: 2 },
        { name: 'Zombie', count: 1, initiativeMod: -1 }
      ],
      {
        createIndividualEntries: false,
        rollDie: createRollSequence([12, 6])
      }
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: 'Skeleton x4',
      d20: 12,
      modifier: 2,
      total: 14,
      count: 4
    });
    expect(rows[1]).toMatchObject({
      name: 'Zombie',
      d20: 6,
      modifier: -1,
      total: 5,
      count: 1
    });
  });

  it('formats initiative tables for copy output', () => {
    const rows = [
      {
        id: 'a',
        name: 'A',
        baseName: 'A',
        d20: 14,
        modifier: 2,
        total: 16,
        count: 1
      },
      {
        id: 'b',
        name: 'B',
        baseName: 'B',
        d20: 5,
        modifier: 0,
        total: 5,
        count: 1
      }
    ];

    const tsv = formatInitiativeAsTsv(rows);
    const markdown = formatInitiativeAsMarkdown(rows);

    expect(tsv).toContain('Name\td20\tModifier\tTotal');
    expect(tsv).toContain('A\t14\t+2\t16');
    expect(markdown).toContain('| Name | d20 | Mod | Total |');
    expect(markdown).toContain('| A | 14 | +2 | 16 |');
  });
});
