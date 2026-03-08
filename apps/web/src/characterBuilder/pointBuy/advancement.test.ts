import { describe, expect, it } from 'vitest';

import {
  getAsiOpportunityInfoForClassDistribution,
  getAsiOpportunityLevelsForPreset,
  getAsiOpportunityLevelsFromFeaturesMap,
  isAsiFeatureName
} from './advancement';

describe('pointBuy advancement', () => {
  it('detects ASI features from class progression data', () => {
    const levels = getAsiOpportunityLevelsFromFeaturesMap(
      {
        1: ['Spellcasting'],
        4: ['Ability Score Improvement'],
        8: ['Ability\nScore Improvement'],
        12: ['Feat choice']
      },
      10
    );

    expect(levels).toEqual([4, 8]);
    expect(isAsiFeatureName('ABILITY SCORE IMPROVEMENT')).toBe(true);
  });

  it('uses fighter fallback preset progression correctly', () => {
    const levels = getAsiOpportunityLevelsForPreset('FIGHTER', 14);
    expect(levels).toEqual([4, 6, 8, 12, 14]);
  });

  it('aggregates ASI opportunities across multiclass distribution', () => {
    const info = getAsiOpportunityInfoForClassDistribution([
      { classId: 'fighter', level: 6 },
      { classId: 'rogue', level: 4 }
    ]);

    expect(info.count).toBe(3);
    expect(info.slots.map((slot) => slot.label)).toEqual(['Fighter 4', 'Fighter 6', 'Rogue 4']);
  });
});
