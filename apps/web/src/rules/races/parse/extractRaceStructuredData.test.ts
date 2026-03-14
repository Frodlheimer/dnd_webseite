import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { raceRulesFacade } from '../../../characterBuilder/rules/raceRulesFacade';
import { loadSrdJson, normalizeSrdBlocks } from '../../srd/parse/srdJsonLoader';
import { extractRacesFromSrd } from './extractRacesFromSrd';
import { extractRaceStructuredData } from './extractRaceStructuredData';
import { installPublicFetchMock } from '../../../test/mockPublicFetch';

installPublicFetchMock();

const sourcePath = resolve(process.cwd(), '../../content/SRD_CC_v5.1.json');

const structuredById = new Map<string, ReturnType<typeof extractRaceStructuredData>>();

beforeAll(() => {
  const source = loadSrdJson(sourcePath);
  const normalized = normalizeSrdBlocks(source);
  const extracted = extractRacesFromSrd(normalized);
  extracted.entries.forEach((entry) => {
    structuredById.set(entry.id, extractRaceStructuredData(entry));
  });
});

describe('extractRaceStructuredData', () => {
  it('extracts core dwarf facts', () => {
    const dwarf = structuredById.get('dwarf');
    expect(dwarf).toBeTruthy();
    expect(dwarf?.abilities.bonuses.con).toBe(2);
    expect(dwarf?.basics.speedWalk).toBe(25);
    expect(dwarf?.senses.darkvision).toBe(60);
    expect(dwarf?.languages.granted).toContain('Common');
    expect(dwarf?.languages.granted).toContain('Dwarvish');
    expect(dwarf?.proficiencies.weapons).toEqual(
      expect.arrayContaining(['battleaxe', 'handaxe', 'light hammer', 'warhammer'])
    );
    expect(dwarf?.proficiencies.toolChoices).toEqual({
      choose: 1,
      from: ["smith's tools", "brewer's supplies", "mason's tools"]
    });
    expect(dwarf?.traits.length).toBeGreaterThan(6);
    expect(dwarf?.traits.some((trait) => trait.name === 'Dwarven Resilience')).toBe(true);
  });

  it('extracts hill dwarf, elf, high elf, and human facts', () => {
    const hillDwarf = structuredById.get('hill-dwarf');
    const elf = structuredById.get('elf');
    const highElf = structuredById.get('high-elf');
    const human = structuredById.get('human');

    expect(hillDwarf?.abilities.bonuses.wis).toBe(1);
    expect(elf?.abilities.bonuses.dex).toBe(2);
    expect(highElf?.abilities.bonuses.int).toBe(1);
    expect(human?.abilities.bonuses).toMatchObject({
      str: 1,
      dex: 1,
      con: 1,
      int: 1,
      wis: 1,
      cha: 1
    });
  });

  it('merges parent race and subrace data for the builder facade', async () => {
    const combined = await raceRulesFacade.getCombinedRaceData('dwarf', 'hill-dwarf');
    expect(combined).toBeTruthy();
    expect(combined?.abilityBonuses).toMatchObject({
      con: 2,
      wis: 1
    });
    expect(combined?.speed.walk).toBe(25);
    expect(combined?.senses.darkvision).toBe(60);
    expect(combined?.languagesGranted).toEqual(expect.arrayContaining(['Common', 'Dwarvish']));
    expect(combined?.traits.map((trait) => trait.name)).toEqual(
      expect.arrayContaining(['Dwarven Resilience', 'Dwarven Toughness'])
    );
  });
});
