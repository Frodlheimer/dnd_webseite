import { describe, expect, it } from 'vitest';

import { buildFeatsPackFromContentEntries, type SourceFeatJson } from './parseFeatsContentJson';

describe('buildFeatsPackFromContentEntries', () => {
  it('builds feat entries and strips wikidot links', () => {
    const entries: Array<{ fileName: string; payload: SourceFeatJson }> = [
      {
        fileName: 'Feats_Published_actor_actor.json',
        payload: {
          kind: 'FEAT',
          group: 'Feats',
          collection: 'Published',
          slug: 'actor',
          page_title: 'actor',
          content: {
            tree: [
              {
                type: 'element',
                tag: 'p',
                children: [{ type: 'text', text: 'Source: Player\'s Handbook https://dnd5e.wikidot.com/feat:actor' }]
              },
              {
                type: 'element',
                tag: 'p',
                children: [{ type: 'text', text: 'Prerequisite: Elf or Half-Elf' }]
              },
              {
                type: 'element',
                tag: 'ul',
                children: [
                  {
                    type: 'element',
                    tag: 'li',
                    children: [{ type: 'text', text: 'Increase your Charisma score by 1, to a maximum of 20.' }]
                  },
                  {
                    type: 'element',
                    tag: 'li',
                    children: [{ type: 'text', text: 'Gain mimicry benefits.' }]
                  }
                ]
              }
            ]
          }
        }
      }
    ];

    const pack = buildFeatsPackFromContentEntries(entries);
    expect(pack.index.count).toBe(1);

    const actor = pack.details[0];
    expect(actor).toBeDefined();
    expect(actor?.id).toBe('actor');
    expect(actor?.quickFacts.source).toBe("Player's Handbook");
    expect(actor?.quickFacts.prerequisite).toBe('Elf or Half-Elf');
    expect(actor?.quickFacts.racePrerequisites).toEqual(['Half-Elf', 'Elf']);
    expect(actor?.quickFacts.abilityIncrease.mode).toBe('FIXED');
    expect(actor?.quickFacts.abilityIncrease.abilities).toEqual(['CHA']);

    const serialized = JSON.stringify(pack).toLowerCase();
    expect(serialized).not.toContain('wikidot');
    expect(serialized).not.toContain('https://');
  });

  it('extracts ability:all for feats that allow any ability score choice', () => {
    const entries: Array<{ fileName: string; payload: SourceFeatJson }> = [
      {
        fileName: 'Feats_Published_custom.json',
        payload: {
          kind: 'FEAT',
          group: 'Feats',
          collection: 'Published',
          slug: 'custom',
          page_title: 'custom',
          content: {
            tree: [
              {
                type: 'element',
                tag: 'p',
                children: [{ type: 'text', text: 'Source: Test Book' }]
              },
              {
                type: 'element',
                tag: 'ul',
                children: [
                  {
                    type: 'element',
                    tag: 'li',
                    children: [
                      {
                        type: 'text',
                        text: 'Increase one ability score of your choice by 1, to a maximum of 20.'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      }
    ];

    const pack = buildFeatsPackFromContentEntries(entries);
    const detail = pack.details[0];
    expect(detail?.quickFacts.abilityIncrease.mode).toBe('CHOICE');
    expect(detail?.quickFacts.abilityIncrease.abilities).toEqual(['ALL']);
    expect(detail?.tags).toContain('ability:all');
  });
});
