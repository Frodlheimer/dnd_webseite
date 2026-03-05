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
});
