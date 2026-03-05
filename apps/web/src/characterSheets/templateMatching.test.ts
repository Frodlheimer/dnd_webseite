import { describe, expect, it } from 'vitest';

import { calculateTemplateMatch, pickBestTemplateMatch } from './templateMatching';

describe('template matching', () => {
  it('calculates overlap score', () => {
    const result = calculateTemplateMatch({
      uploadedFieldNames: ['Character Name', 'Level', 'AC'],
      templateFieldNames: ['character name', 'level', 'hit points', 'ac'],
      templateId: 'wizard-sheet'
    });

    expect(result.templateId).toBe('wizard-sheet');
    expect(result.overlapCount).toBe(3);
    expect(result.score).toBeCloseTo(0.75, 6);
  });

  it('picks the template with strongest overlap', () => {
    const best = pickBestTemplateMatch({
      uploadedFieldNames: ['Character Name', 'Strength', 'Dexterity', 'Wisdom'],
      templates: [
        {
          summary: {
            id: 'fighter',
            title: 'Fighter',
            className: 'Fighter',
            pdfUrl: '/character_sheets/fighter.pdf',
            pageCount: 2,
            updatedAt: '2026-01-01T00:00:00.000Z'
          },
          fieldNames: ['character name', 'strength', 'dexterity']
        },
        {
          summary: {
            id: 'wizard',
            title: 'Wizard',
            className: 'Wizard',
            pdfUrl: '/character_sheets/wizard.pdf',
            pageCount: 2,
            updatedAt: '2026-01-01T00:00:00.000Z'
          },
          fieldNames: ['character name', 'intelligence', 'spell save dc']
        }
      ],
      minScore: 0.1
    });

    expect(best?.templateId).toBe('fighter');
    expect(best?.overlapCount).toBe(3);
  });
});
