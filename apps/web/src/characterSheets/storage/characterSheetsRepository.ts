import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { CharacterSheetInstance, CharacterSheetValues } from '../types';

const DB_NAME = 'dnd-vtt-character-sheets-v1';
const DB_VERSION = 1;

type CharacterSheetDb = DBSchema & {
  instances: {
    key: string;
    value: CharacterSheetInstance;
    indexes: {
      byTemplateUpdatedAt: [string, string];
      byUpdatedAt: string;
    };
  };
  recent: {
    key: string;
    value: {
      templateId: string;
      instanceId: string;
      updatedAt: string;
    };
  };
};

const createInstanceId = (): string => {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `sheet-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

export class CharacterSheetsRepository {
  private dbPromise: Promise<IDBPDatabase<CharacterSheetDb>>;

  constructor(dbName = DB_NAME) {
    this.dbPromise = openDB<CharacterSheetDb>(dbName, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('instances')) {
          const instances = db.createObjectStore('instances', {
            keyPath: 'instanceId'
          });
          instances.createIndex('byTemplateUpdatedAt', ['templateId', 'updatedAt']);
          instances.createIndex('byUpdatedAt', 'updatedAt');
        }

        if (!db.objectStoreNames.contains('recent')) {
          db.createObjectStore('recent', {
            keyPath: 'templateId'
          });
        }
      }
    });
  }

  async createInstance(args: {
    templateId: string;
    title: string;
    values?: CharacterSheetValues;
  }): Promise<CharacterSheetInstance> {
    const db = await this.dbPromise;
    const now = new Date().toISOString();
    const instance: CharacterSheetInstance = {
      instanceId: createInstanceId(),
      templateId: args.templateId,
      title: args.title,
      createdAt: now,
      updatedAt: now,
      values: args.values ?? {}
    };

    await db.put('instances', instance);
    await db.put('recent', {
      templateId: args.templateId,
      instanceId: instance.instanceId,
      updatedAt: now
    });
    return instance;
  }

  async getInstance(instanceId: string): Promise<CharacterSheetInstance | null> {
    const db = await this.dbPromise;
    const record = await db.get('instances', instanceId);
    return record ?? null;
  }

  async saveValues(instanceId: string, values: CharacterSheetValues): Promise<CharacterSheetInstance> {
    const db = await this.dbPromise;
    const existing = await db.get('instances', instanceId);
    if (!existing) {
      throw new Error(`Character sheet instance not found: ${instanceId}`);
    }

    const updatedAt = new Date().toISOString();
    const next: CharacterSheetInstance = {
      ...existing,
      values,
      updatedAt
    };

    await db.put('instances', next);
    await db.put('recent', {
      templateId: existing.templateId,
      instanceId: existing.instanceId,
      updatedAt
    });

    return next;
  }

  async updateTitle(instanceId: string, title: string): Promise<CharacterSheetInstance> {
    const db = await this.dbPromise;
    const existing = await db.get('instances', instanceId);
    if (!existing) {
      throw new Error(`Character sheet instance not found: ${instanceId}`);
    }

    const updatedAt = new Date().toISOString();
    const next: CharacterSheetInstance = {
      ...existing,
      title,
      updatedAt
    };

    await db.put('instances', next);
    return next;
  }

  async listRecentInstances(limit = 20): Promise<CharacterSheetInstance[]> {
    const db = await this.dbPromise;
    const records = await db.getAll('instances');
    return records
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, Math.max(1, limit));
  }

  async listRecentInstancesForTemplate(templateId: string, limit = 6): Promise<CharacterSheetInstance[]> {
    const db = await this.dbPromise;
    const records = await db.getAllFromIndex('instances', 'byTemplateUpdatedAt', IDBKeyRange.bound([templateId, ''], [templateId, '\uffff']));
    return records
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, Math.max(1, limit));
  }

  async getLastInstanceIdForTemplate(templateId: string): Promise<string | null> {
    const db = await this.dbPromise;
    const record = await db.get('recent', templateId);
    return record?.instanceId ?? null;
  }
}

export const characterSheetsRepository = new CharacterSheetsRepository();
