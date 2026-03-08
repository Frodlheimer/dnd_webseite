import { describe, expect, it } from 'vitest';

import { getFeatAllowedPlusOneAbilities, getFeatMeta } from './featsData';

describe('featsData', () => {
  it('resolves plus-one ability options for known feats', () => {
    const actor = getFeatMeta('actor');
    expect(actor).not.toBeNull();

    const actorAbilities = getFeatAllowedPlusOneAbilities('actor');
    expect(actorAbilities).toContain('CHA');

    const alertAbilities = getFeatAllowedPlusOneAbilities('alert');
    expect(alertAbilities).toEqual([]);
  });
});
