import { describe, expect, it } from 'vitest';

import { CharacterRepository } from './characterRepository';

const deleteDatabase = async (name: string): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onerror = () => reject(request.error ?? new Error('deleteDatabase failed'));
    request.onblocked = () => resolve();
    request.onsuccess = () => resolve();
  });
};

describe('CharacterRepository', () => {
  it('creates, saves, lists, and deletes characters', async () => {
    const dbName = `test-character-repo-${Date.now()}-1`;
    await deleteDatabase(dbName);
    const repository = new CharacterRepository(dbName);

    const created = await repository.createCharacter();
    expect(created.id).toBeTruthy();

    const updatedName = 'Repository Hero';
    created.meta.name = updatedName;
    const saved = await repository.saveCharacter(created);
    expect(saved.meta.name).toBe(updatedName);

    const loaded = await repository.getCharacter(saved.id);
    expect(loaded?.meta.name).toBe(updatedName);

    const list = await repository.listCharacters();
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe(saved.id);

    await repository.deleteCharacter(saved.id);
    const afterDelete = await repository.getCharacter(saved.id);
    expect(afterDelete).toBeNull();
  });

  it('duplicates characters and keeps records independent', async () => {
    const dbName = `test-character-repo-${Date.now()}-2`;
    await deleteDatabase(dbName);
    const repository = new CharacterRepository(dbName);

    const original = await repository.createCharacter();
    original.meta.name = 'Original';
    await repository.saveCharacter(original);

    const duplicate = await repository.duplicateCharacter(original.id);
    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.meta.name).toContain('Original');

    duplicate.meta.name = 'Duplicate';
    await repository.saveCharacter(duplicate);

    const loadedOriginal = await repository.getCharacter(original.id);
    const loadedDuplicate = await repository.getCharacter(duplicate.id);
    expect(loadedOriginal?.meta.name).toBe('Original');
    expect(loadedDuplicate?.meta.name).toBe('Duplicate');
  });
});

