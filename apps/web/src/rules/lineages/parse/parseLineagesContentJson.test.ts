import { describe, expect, it } from 'vitest';

import { buildLineagesPackFromContentEntries, type SourceLineageJson } from './parseLineagesContentJson';

describe('buildLineagesPackFromContentEntries', () => {
  it('builds lineage entries with structured blocks and strips wikidot/urls', () => {
    const entries: Array<{ fileName: string; payload: SourceLineageJson }> = [
      {
        fileName: 'Standard_Lineages__elf_elf.json',
        payload: {
          kind: 'LINEAGE',
          group: 'Standard Lineages',
          setting: null,
          slug: 'elf',
          page_title: 'elf',
          content: {
            tree: [
              {
                type: 'element',
                tag: 'p',
                children: [{ type: 'text', text: 'Source: Player Handbook https://dnd5e.wikidot.com/lineage:elf' }]
              },
              {
                type: 'element',
                tag: 'ul',
                children: [
                  {
                    type: 'element',
                    tag: 'li',
                    children: [
                      { type: 'element', tag: 'strong', children: [{ type: 'text', text: 'Ability Score Increase.' }] },
                      { type: 'text', text: ' Your Dexterity score increases by 2.' }
                    ]
                  }
                ]
              },
              {
                type: 'element',
                tag: 'ul',
                children: [
                  {
                    type: 'element',
                    tag: 'li',
                    children: [
                      { type: 'element', tag: 'strong', children: [{ type: 'text', text: 'Speed.' }] },
                      { type: 'text', text: ' Your walking speed is 30 feet.' }
                    ]
                  }
                ]
              },
              {
                type: 'element',
                tag: 'table',
                children: [
                  {
                    type: 'element',
                    tag: 'tr',
                    children: [
                      { type: 'element', tag: 'th', children: [{ type: 'text', text: 'Trait' }] },
                      { type: 'element', tag: 'th', children: [{ type: 'text', text: 'Value' }] }
                    ]
                  },
                  {
                    type: 'element',
                    tag: 'tr',
                    children: [
                      { type: 'element', tag: 'td', children: [{ type: 'text', text: 'Size' }] },
                      { type: 'element', tag: 'td', children: [{ type: 'text', text: 'Medium' }] }
                    ]
                  }
                ]
              }
            ]
          }
        }
      }
    ];

    const pack = buildLineagesPackFromContentEntries(entries);
    expect(pack.index.count).toBe(1);

    const serialized = JSON.stringify(pack).toLowerCase();
    expect(serialized).not.toContain('wikidot');
    expect(serialized).not.toContain('https://');

    const elf = pack.details[0];
    expect(elf?.id).toBe('elf');
    expect(elf?.group).toBe('Standard Lineages');
    expect(elf?.quickFacts.abilityScoreIncrease).toBe('Your Dexterity score increases by 2.');
    expect(elf?.quickFacts.speedFeet).toBe(30);
    expect(elf?.documentBlocks.some((block) => block.type === 'ul')).toBe(true);
    expect(elf?.documentBlocks.some((block) => block.type === 'table')).toBe(true);
  });
});
