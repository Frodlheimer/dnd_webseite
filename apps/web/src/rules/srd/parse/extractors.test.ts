import { describe, expect, it } from 'vitest';

import { extractSrdSections } from './extractors';
import { normalizeSrdBlocks } from './srdJsonLoader';

describe('extractSrdSections', () => {
  it('parses minimal SRD blocks into structured sections', () => {
    const fixture = {
      pages: [
        {
          page_number: 1,
          blocks: [
            {
              type: 'paragraph',
              text: 'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1").'
            }
          ]
        },
        {
          page_number: 3,
          blocks: [
            {
              type: 'heading',
              level: 2,
              text: 'Dwarf'
            },
            {
              type: 'paragraph',
              text: 'Ability Score Increase. Your Constitution score increases by 2.'
            }
          ]
        },
        {
          page_number: 8,
          blocks: [
            {
              type: 'heading',
              level: 2,
              text: 'Barbarian'
            }
          ]
        },
        {
          page_number: 62,
          blocks: [
            {
              type: 'heading',
              level: 2,
              text: 'Equipment'
            },
            {
              type: 'heading',
              level: 3,
              text: 'Adventuring Gear'
            },
            {
              type: 'table',
              header_texts: ['Name', 'Cost'],
              rows_text: [['Rope', '1 gp']]
            }
          ]
        },
        {
          page_number: 75,
          blocks: [
            {
              type: 'heading',
              level: 2,
              text: 'Feats'
            }
          ]
        },
        {
          page_number: 76,
          blocks: [
            {
              type: 'heading',
              level: 2,
              text: 'Using Ability Scores'
            }
          ]
        },
        {
          page_number: 90,
          blocks: [
            {
              type: 'heading',
              level: 3,
              text: 'Surprise'
            }
          ]
        },
        {
          page_number: 100,
          blocks: [
            {
              type: 'heading',
              level: 3,
              text: 'Spellcasting'
            }
          ]
        },
        {
          page_number: 105,
          blocks: [
            {
              type: 'heading',
              level: 2,
              text: 'Spell Lists'
            }
          ]
        },
        {
          page_number: 207,
          blocks: [
            {
              type: 'heading',
              level: 2,
              text: 'Magic Items A-Z'
            },
            {
              type: 'heading',
              level: 3,
              text: 'Potion of Healing, potion, common'
            },
            {
              type: 'paragraph',
              text: 'You regain hit points.'
            }
          ]
        },
        {
          page_number: 252,
          blocks: [
            {
              type: 'heading',
              level: 2,
              text: 'Artifacts'
            }
          ]
        },
        {
          page_number: 261,
          blocks: [
            {
              type: 'heading',
              level: 2,
              text: 'Monsters (A)'
            },
            {
              type: 'heading',
              level: 3,
              text: 'Ape'
            },
            {
              type: 'paragraph',
              text: 'Medium beast, unaligned'
            },
            {
              type: 'paragraph',
              text: 'Armor Class 12'
            },
            {
              type: 'paragraph',
              text: 'Hit Points 19 (3d8 + 6)'
            },
            {
              type: 'paragraph',
              text: 'Speed 30 ft., climb 30 ft.'
            },
            {
              type: 'paragraph',
              text: 'Challenge 1/2 (100 XP)'
            },
            {
              type: 'paragraph',
              text: '16 (+3) 14 (+2) 14 (+2) 6 (-2) 12 (+1) 7 (-2)'
            }
          ]
        },
        {
          page_number: 358,
          blocks: [
            {
              type: 'heading',
              level: 2,
              text: 'Appendix PH-A: Conditions'
            },
            {
              type: 'paragraph',
              text: 'The conditions alter a creature in a variety of ways.'
            },
            {
              type: 'paragraph',
              text: 'Blinded • A blinded creature can\'t see and automatically fails any ability check that requires sight. • Attack rolls against the creature have advantage.'
            }
          ]
        },
        {
          page_number: 359,
          blocks: [
            {
              type: 'heading',
              level: 2,
              text: 'Appendix PH-B: Gods'
            }
          ]
        }
      ]
    };

    const normalized = normalizeSrdBlocks(fixture);
    const parsed = extractSrdSections(normalized);

    const blinded = parsed.byCategory.conditions.find((entry) => entry.id === 'condition-blinded');
    expect(blinded).toBeTruthy();
    expect(blinded?.contentBlocks[1]).toEqual({
      type: 'ul',
      items: [
        'A blinded creature can\'t see and automatically fails any ability check that requires sight.',
        'Attack rolls against the creature have advantage.'
      ]
    });

    const equipmentEntry = parsed.byCategory.equipment.find((entry) => entry.title === 'Adventuring Gear');
    expect(equipmentEntry).toBeTruthy();
    expect(equipmentEntry?.extra.equipmentRows).toEqual([
      ['Name', 'Cost'],
      ['Rope', '1 gp']
    ]);

    expect(parsed.byCategory.monsters[0]?.extra.initiativeMod).toBe(2);
    expect(parsed.attributionStatement).toContain('System Reference Document 5.1');
  });
});
