import { describe, expect, it } from 'vitest';

import { CharacterSheetsRepository } from './characterSheetsRepository';

describe('CharacterSheetsRepository', () => {
  it('creates, loads, and saves instances', async () => {
    const repository = new CharacterSheetsRepository(
      `dnd-vtt-character-sheets-test-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    const created = await repository.createInstance({
      templateId: 'wizard',
      title: 'Wizard Sheet'
    });

    expect(created.templateId).toBe('wizard');
    expect(created.values).toEqual({});

    const loaded = await repository.getInstance(created.instanceId);
    expect(loaded?.instanceId).toBe(created.instanceId);

    await repository.saveValues(created.instanceId, {
      CharacterName: 'Elara',
      IsInspiration: true
    });

    const updated = await repository.getInstance(created.instanceId);
    expect(updated?.values.CharacterName).toBe('Elara');
    expect(updated?.values.IsInspiration).toBe(true);
  });

  it('saves, lists, loads, and deletes imported sheet records locally', async () => {
    const repository = new CharacterSheetsRepository(
      `dnd-vtt-character-sheets-test-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );

    const saved = await repository.saveImportedSheet({
      sourceFileName: 'wizard-filled.pdf',
      templateId: 'wizard-eu-a4',
      templateTitle: 'Wizard Character Sheet',
      importStatus: 'warning',
      validationSummary: {
        errors: 1,
        warnings: 2
      },
      parsedData: {
        identity: {
          character_name: 'Elara'
        },
        coreStats: {
          str_score: 15
        },
        combat: {
          ac: 17
        },
        skills: {},
        spellcasting: {},
        featuresNotes: {}
      },
      extractedFields: [
        {
          fieldName: 'Front_Character Name',
          label: 'Character Name',
          rawValue: 'Elara',
          parsedValue: 'Elara',
          section: 'Identity',
          status: 'ok'
        }
      ]
    });

    const loaded = await repository.getImportedSheetRecord(saved.id);
    expect(loaded?.id).toBe(saved.id);
    expect(loaded?.sourceFileName).toBe('wizard-filled.pdf');
    expect(loaded?.validationSummary.warnings).toBe(2);

    const listed = await repository.listImportedSheetRecords();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(saved.id);

    await repository.deleteImportedSheetRecord(saved.id);
    const afterDelete = await repository.getImportedSheetRecord(saved.id);
    expect(afterDelete).toBeNull();
  });
});
