import { describe, expect, it } from 'vitest';

import { buildClassesPackFromContentEntries, type SourceEntryJson } from './parseClassesContentJson';

describe('buildClassesPackFromContentEntries', () => {
  it('builds class/subclass entries from structured JSON and strips wikidot/urls', () => {
    const entries: Array<{ fileName: string; payload: SourceEntryJson }> = [
      {
        fileName: 'CLASS__Wizard.json',
        payload: {
          type: 'CLASS',
          name: 'Wizard',
          parent_class: null,
          content: {
            tree: [
              {
                type: 'element',
                tag: 'p',
                children: [{ type: 'text', text: 'Hit Dice: 1d6 per wizard level Saving Throws: Intelligence, Wisdom.' }]
              },
              {
                type: 'element',
                tag: 'table',
                children: [
                  {
                    type: 'element',
                    tag: 'tr',
                    children: [
                      { type: 'element', tag: 'th', children: [{ type: 'text', text: 'Level' }] },
                      { type: 'element', tag: 'th', children: [{ type: 'text', text: 'Features' }] },
                      { type: 'element', tag: 'th', children: [{ type: 'text', text: '1st' }] }
                    ]
                  },
                  {
                    type: 'element',
                    tag: 'tr',
                    children: [
                      { type: 'element', tag: 'td', children: [{ type: 'text', text: '1st' }] },
                      { type: 'element', tag: 'td', children: [{ type: 'text', text: 'Spellcasting' }] },
                      { type: 'element', tag: 'td', children: [{ type: 'text', text: '2' }] }
                    ]
                  }
                ]
              },
              {
                type: 'element',
                tag: 'h3',
                children: [{ type: 'text', text: 'Spellcasting' }]
              },
              {
                type: 'element',
                tag: 'p',
                children: [
                  {
                    type: 'text',
                    text: 'See https://dnd5e.wikidot.com/spells:wizard for details.'
                  }
                ]
              }
            ]
          }
        }
      },
      {
        fileName: 'SUBCLASS_Wizard_School_of_Evocation.json',
        payload: {
          type: 'SUBCLASS',
          name: 'School of Evocation',
          parent_class: 'Wizard',
          content: {
            tree: [
              {
                type: 'element',
                tag: 'h3',
                children: [{ type: 'text', text: '2nd-level Evocation feature' }]
              },
              {
                type: 'element',
                tag: 'table',
                children: [
                  {
                    type: 'element',
                    tag: 'tr',
                    children: [
                      { type: 'element', tag: 'th', children: [{ type: 'text', text: 'Wizard Level' }] },
                      { type: 'element', tag: 'th', children: [{ type: 'text', text: 'Spells' }] }
                    ]
                  },
                  {
                    type: 'element',
                    tag: 'tr',
                    children: [
                      { type: 'element', tag: 'td', children: [{ type: 'text', text: '2nd' }] },
                      { type: 'element', tag: 'td', children: [{ type: 'text', text: 'Magic Missile, Shield' }] }
                    ]
                  }
                ]
              }
            ]
          }
        }
      }
    ];

    const pack = buildClassesPackFromContentEntries(entries, {
      spellSlugByName: new Map([
        ['magic missile', 'magic-missile'],
        ['shield', 'shield']
      ])
    });

    expect(pack.index.count).toBe(2);

    const serialized = JSON.stringify(pack);
    expect(serialized.toLowerCase()).not.toContain('wikidot');
    expect(serialized).not.toContain('https://');

    const wizard = pack.details.find((entry) => entry.id === 'wizard');
    expect(wizard).toBeTruthy();
    expect(wizard?.extracted.hitDie).toBe('1d6 per wizard level');
    expect(wizard?.extracted.savingThrows).toEqual(['Intelligence', 'Wisdom']);

    const evocation = pack.details.find((entry) => entry.id === 'wizard--school-of-evocation');
    expect(evocation).toBeTruthy();
    expect(evocation?.parentClassId).toBe('wizard');
    expect(evocation?.extracted.subclassLevelStart).toBe(2);
    expect(evocation?.extracted.grantedSpellRefs[2]).toEqual([
      { name: 'Magic Missile', slug: 'magic-missile' },
      { name: 'Shield', slug: 'shield' }
    ]);
  });
});
