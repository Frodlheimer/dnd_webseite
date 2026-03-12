import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { CharacterId, CharacterRecord, CharacterSummary } from '../model/character';
import { createEmptyCharacter } from '../model/character';

const DB_NAME = 'dnd-vtt-characters-v1';
const DB_VERSION = 1;
const AUTOSAVE_DEBOUNCE_MS = 600;

type CharacterAutosaveSnapshot = {
  id: string;
  characterId: CharacterId;
  createdAt: number;
  state: CharacterRecord;
};

type CharacterIndexRecord = CharacterSummary & {
  characterId: CharacterId;
};

type CharactersDb = DBSchema & {
  characters: {
    key: CharacterId;
    value: CharacterRecord;
    indexes: {
      byUpdatedAt: number;
      byStatus: string;
    };
  };
  characterSnapshots: {
    key: string;
    value: CharacterAutosaveSnapshot;
    indexes: {
      byCharacterUpdatedAt: [CharacterId, number];
    };
  };
  characterIndex: {
    key: CharacterId;
    value: CharacterIndexRecord;
    indexes: {
      byUpdatedAt: number;
      byStatus: string;
    };
  };
};

const cloneCharacter = (character: CharacterRecord): CharacterRecord => {
  return structuredClone(character);
};

const createSnapshotId = (): string => {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `snapshot-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

const createSummaryFromCharacter = (character: CharacterRecord): CharacterSummary => {
  const abilityFinal = ABILITY_KEYS.reduce<Record<(typeof ABILITY_KEYS)[number], number>>((acc, key) => {
    acc[key] = character.derived.abilityFinal[key] ?? 8;
    return acc;
  }, {} as Record<(typeof ABILITY_KEYS)[number], number>);

  const completionLabel =
    character.status === 'ready'
      ? 'Ready'
      : character.status === 'invalid'
        ? 'Invalid'
        : character.validation.pendingDecisions.length > 0
          ? `${character.validation.pendingDecisions.length} pending`
          : 'In progress';

  return {
    id: character.id,
    name: character.meta.name.trim() || 'Unnamed Character',
    className: null,
    subclassName: null,
    level: character.progression.level,
    raceOrSpeciesName: null,
    backgroundName: null,
    abilityFinal,
    armorClass: character.derived.armorClass ?? null,
    hitPointsMax: character.derived.hitPointsMax ?? null,
    initiative: character.derived.initiative ?? null,
    proficiencyBonus: character.derived.proficiencyBonus ?? null,
    status: character.status,
    completionLabel,
    updatedAt: character.updatedAt,
    createdAt: character.createdAt
  };
};

export class CharacterRepository {
  private dbPromise: Promise<IDBPDatabase<CharactersDb>>;
  private saveTimersByCharacterId = new Map<CharacterId, number>();
  private lastSerializedByCharacterId = new Map<CharacterId, string>();

  constructor(dbName = DB_NAME) {
    this.dbPromise = openDB<CharactersDb>(dbName, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('characters')) {
          const characters = db.createObjectStore('characters', {
            keyPath: 'id'
          });
          characters.createIndex('byUpdatedAt', 'updatedAt');
          characters.createIndex('byStatus', 'status');
        }

        if (!db.objectStoreNames.contains('characterSnapshots')) {
          const snapshots = db.createObjectStore('characterSnapshots', {
            keyPath: 'id'
          });
          snapshots.createIndex('byCharacterUpdatedAt', ['characterId', 'createdAt']);
        }

        if (!db.objectStoreNames.contains('characterIndex')) {
          const index = db.createObjectStore('characterIndex', {
            keyPath: 'characterId'
          });
          index.createIndex('byUpdatedAt', 'updatedAt');
          index.createIndex('byStatus', 'status');
        }
      }
    });
  }

  async listCharacters(): Promise<CharacterRecord[]> {
    const db = await this.dbPromise;
    const rows = await db.getAll('characters');
    return rows.sort((a, b) => b.updatedAt - a.updatedAt).map((row) => cloneCharacter(row));
  }

  async getCharacter(id: CharacterId): Promise<CharacterRecord | null> {
    const db = await this.dbPromise;
    const row = await db.get('characters', id);
    return row ? cloneCharacter(row) : null;
  }

  async createCharacter(): Promise<CharacterRecord> {
    const db = await this.dbPromise;
    const character = createEmptyCharacter();
    await db.put('characters', cloneCharacter(character));
    await db.put('characterIndex', {
      characterId: character.id,
      ...createSummaryFromCharacter(character)
    });
    this.lastSerializedByCharacterId.set(character.id, JSON.stringify(character));
    return cloneCharacter(character);
  }

  async saveCharacter(character: CharacterRecord): Promise<CharacterRecord> {
    const db = await this.dbPromise;
    const now = Date.now();
    const next: CharacterRecord = {
      ...cloneCharacter(character),
      updatedAt: now
    };
    await db.put('characters', next);
    await db.put('characterIndex', {
      characterId: next.id,
      ...createSummaryFromCharacter(next)
    });
    this.lastSerializedByCharacterId.set(next.id, JSON.stringify(next));
    return cloneCharacter(next);
  }

  saveCharacterDebounced(character: CharacterRecord): void {
    const serialized = JSON.stringify(character);
    const previousSerialized = this.lastSerializedByCharacterId.get(character.id);
    if (serialized === previousSerialized) {
      return;
    }

    const existingTimer = this.saveTimersByCharacterId.get(character.id);
    if (typeof existingTimer === 'number') {
      window.clearTimeout(existingTimer);
    }

    const timerId = window.setTimeout(() => {
      this.saveTimersByCharacterId.delete(character.id);
      void this.saveCharacter(character);
    }, AUTOSAVE_DEBOUNCE_MS);

    this.saveTimersByCharacterId.set(character.id, timerId);
  }

  async flushDebouncedSave(characterId: CharacterId): Promise<void> {
    const existingTimer = this.saveTimersByCharacterId.get(characterId);
    if (typeof existingTimer !== 'number') {
      return;
    }
    window.clearTimeout(existingTimer);
    this.saveTimersByCharacterId.delete(characterId);
    const character = await this.getCharacter(characterId);
    if (character) {
      await this.saveCharacter(character);
    }
  }

  async deleteCharacter(id: CharacterId): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(['characters', 'characterSnapshots', 'characterIndex'], 'readwrite');
    await tx.objectStore('characters').delete(id);
    await tx.objectStore('characterIndex').delete(id);

    const range = IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);
    const snapshots = await tx.objectStore('characterSnapshots').index('byCharacterUpdatedAt').getAll(range);
    for (const snapshot of snapshots) {
      await tx.objectStore('characterSnapshots').delete(snapshot.id);
    }

    await tx.done;
    this.lastSerializedByCharacterId.delete(id);
  }

  async duplicateCharacter(id: CharacterId): Promise<CharacterRecord> {
    const source = await this.getCharacter(id);
    if (!source) {
      throw new Error(`Character not found: ${id}`);
    }

    const now = Date.now();
    const duplicate = createEmptyCharacter();
    duplicate.createdAt = now;
    duplicate.updatedAt = now;
    duplicate.meta = {
      ...source.meta,
      name: source.meta.name ? `${source.meta.name} (Copy)` : 'Character Copy'
    };
    duplicate.progression = cloneCharacter(source).progression;
    duplicate.origin = cloneCharacter(source).origin;
    duplicate.abilities = cloneCharacter(source).abilities;
    duplicate.proficiencies = cloneCharacter(source).proficiencies;
    duplicate.equipment = cloneCharacter(source).equipment;
    duplicate.spells = cloneCharacter(source).spells;
    duplicate.featsAndAsi = cloneCharacter(source).featsAndAsi;
    duplicate.features = cloneCharacter(source).features;
    duplicate.derived = cloneCharacter(source).derived;
    duplicate.validation = cloneCharacter(source).validation;
    duplicate.status = source.status;
    const exportState = cloneCharacter(source).exportState;
    if (exportState) {
      duplicate.exportState = exportState;
    }

    return await this.saveCharacter(duplicate);
  }

  async listCharacterSummaries(): Promise<CharacterSummary[]> {
    const db = await this.dbPromise;
    const indexRows = await db.getAll('characterIndex');
    if (indexRows.length > 0) {
      return indexRows
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((row) => ({
          id: row.characterId,
          name: row.name,
          className: row.className,
          subclassName: row.subclassName,
          level: row.level,
          raceOrSpeciesName: row.raceOrSpeciesName,
          backgroundName: row.backgroundName,
          abilityFinal: row.abilityFinal,
          armorClass: row.armorClass,
          hitPointsMax: row.hitPointsMax,
          initiative: row.initiative,
          proficiencyBonus: row.proficiencyBonus,
          status: row.status,
          completionLabel: row.completionLabel,
          updatedAt: row.updatedAt,
          createdAt: row.createdAt
        }));
    }

    const characters = await this.listCharacters();
    return characters.map((character) => createSummaryFromCharacter(character));
  }

  async saveAutosaveSnapshot(id: CharacterId, state: CharacterRecord): Promise<void> {
    const db = await this.dbPromise;
    const snapshot: CharacterAutosaveSnapshot = {
      id: createSnapshotId(),
      characterId: id,
      createdAt: Date.now(),
      state: cloneCharacter(state)
    };
    await db.put('characterSnapshots', snapshot);

    const range = IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);
    const rows = await db
      .transaction('characterSnapshots')
      .objectStore('characterSnapshots')
      .index('byCharacterUpdatedAt')
      .getAll(range);
    const stale = rows.sort((a, b) => b.createdAt - a.createdAt).slice(20);
    if (stale.length === 0) {
      return;
    }

    const tx = db.transaction('characterSnapshots', 'readwrite');
    for (const row of stale) {
      await tx.objectStore('characterSnapshots').delete(row.id);
    }
    await tx.done;
  }

  async getLatestSnapshot(id: CharacterId): Promise<CharacterRecord | null> {
    const db = await this.dbPromise;
    const range = IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);
    const rows = await db
      .transaction('characterSnapshots')
      .objectStore('characterSnapshots')
      .index('byCharacterUpdatedAt')
      .getAll(range);
    if (rows.length === 0) {
      return null;
    }
    const latest = rows.sort((a, b) => b.createdAt - a.createdAt)[0];
    return latest ? cloneCharacter(latest.state) : null;
  }
}

export const characterRepository = new CharacterRepository();
