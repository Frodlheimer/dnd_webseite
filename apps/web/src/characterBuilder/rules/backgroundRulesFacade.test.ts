import { describe, expect, it } from 'vitest';

import { installPublicFetchMock } from '../../test/mockPublicFetch';
import { backgroundRulesFacade } from './backgroundRulesFacade';

installPublicFetchMock();

describe('backgroundRulesFacade', () => {
  it('lists playable backgrounds from the generated lookup', () => {
    const backgrounds = backgroundRulesFacade.listPlayableBackgrounds();

    expect(backgrounds.length).toBeGreaterThan(5);
    expect(backgrounds.find((entry) => entry.id === 'acolyte')).toMatchObject({
      name: 'Acolyte',
      skillProficiencies: ['Insight', 'Religion']
    });
  });

  it('resolves canonical backgrounds by variant alias', () => {
    const criminal = backgroundRulesFacade.getBackgroundByAlias('Spy');

    expect(criminal).toBeTruthy();
    expect(criminal?.id).toBe('criminal');
    expect(criminal?.name).toBe('Criminal');
  });

  it('returns normalized grants, feature data, and equipment choices for builder consumption', async () => {
    const acolyte = await backgroundRulesFacade.getBackgroundGrantedData('acolyte');
    const criminal = await backgroundRulesFacade.getBackgroundGrantedData('criminal');

    expect(acolyte).toBeTruthy();
    expect(acolyte?.skills).toEqual(['Insight', 'Religion']);
    expect(acolyte?.languageChoices).toMatchObject({
      choose: 2
    });
    expect(acolyte?.feature.name).toBe('Shelter of the Faithful');
    expect(acolyte?.equipment.choiceGroups).toHaveLength(1);

    expect(criminal).toBeTruthy();
    expect(criminal?.tools).toContain("Thieves' tools");
    expect(criminal?.toolChoices).toEqual({
      choose: 1,
      from: ['Dice set', 'Dragonchess set', 'Playing card set', 'Three-Dragon Ante set']
    });
    expect(criminal?.equipment.fixedItems.map((item) => item.name)).toContain('crowbar');
    expect(criminal?.structuredSections.some((section) => section.kind === 'variant')).toBe(true);
  });
});
