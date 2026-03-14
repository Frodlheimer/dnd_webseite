import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadBackgroundPage } from './extractBackgrounds';
import { extractStructuredBackgroundData } from './extractStructuredBackgroundData';

const backgroundsDir = resolve(process.cwd(), '../../content/background');

const readBackground = (filename: string) => {
  const page = loadBackgroundPage(resolve(backgroundsDir, filename));
  return extractStructuredBackgroundData(page);
};

describe('extractStructuredBackgroundData', () => {
  it('extracts acolyte skills, language choices, equipment, and feature data', () => {
    const acolyte = readBackground('acolyte_acolyte.json');

    expect(acolyte.name).toBe('Acolyte');
    expect(acolyte.grants.skills).toEqual(['Insight', 'Religion']);
    expect(acolyte.grants.languageChoices).toMatchObject({
      choose: 2
    });
    expect(acolyte.grants.languageChoices?.from).toContain('Elvish');
    expect(acolyte.equipment.fixedItems.map((item) => item.name)).toEqual(
      expect.arrayContaining(['holy symbol (a gift to you when you entered the priesthood)', 'vestments'])
    );
    expect(acolyte.equipment.choiceGroups[0]).toMatchObject({
      choose: 1,
      options: [{ name: 'prayer book' }, { name: 'prayer wheel' }]
    });
    expect(acolyte.feature.name).toBe('Shelter of the Faithful');
    expect(acolyte.feature.rulesText).toContain('free healing and care');
  });

  it('extracts criminal proficiencies, aliases, variants, and equipment', () => {
    const criminal = readBackground('criminal_criminal.json');

    expect(criminal.aliases).toEqual(expect.arrayContaining(['Criminal', 'Spy', 'Spy (variant)']));
    expect(criminal.grants.skills).toEqual(['Deception', 'Stealth']);
    expect(criminal.grants.tools).toContain("Thieves' tools");
    expect(criminal.grants.toolChoices).toEqual({
      choose: 1,
      from: ['Dice set', 'Dragonchess set', 'Playing card set', 'Three-Dragon Ante set']
    });
    expect(criminal.feature.name).toBe('Criminal Contact');
    expect(criminal.equipment.fixedItems.map((item) => item.name)).toEqual(
      expect.arrayContaining(['crowbar', 'set of dark common clothes including a hood'])
    );
    expect(
      criminal.structuredSections.some((section) => section.kind === 'variant' && section.title === 'Spy')
    ).toBe(true);
  });

  it('prefers the actual named feature when a setup subsection precedes it', () => {
    const charlatan = readBackground('charlatan_charlatan.json');

    expect(charlatan.feature.name).toBe('False Identity');
    expect(charlatan.feature.rulesText).toContain('forge documents');
    expect(charlatan.equipment.rawText).toContain('signet ring');
  });
});
