import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

const DB_NAME = 'dnd-vtt-dm-data-v1';
const DB_VERSION = 1;

export type Npc = {
  id: string;
  name: string;
  initiativeMod: number;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
};

export type UpsertNpcInput = {
  id?: string;
  name: string;
  initiativeMod?: number;
  tags?: string[];
};

type DmDataDb = DBSchema & {
  npcs: {
    key: string;
    value: Npc;
    indexes: {
      byName: string;
      byUpdatedAt: number;
    };
  };
};

const createNpcId = (): string => {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `npc-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const normalizeInitiativeMod = (value: number | undefined): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.trunc(value ?? 0);
};

export class NpcsRepository {
  private dbPromise: Promise<IDBPDatabase<DmDataDb>>;

  constructor(dbName = DB_NAME) {
    this.dbPromise = openDB<DmDataDb>(dbName, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('npcs')) {
          const npcs = db.createObjectStore('npcs', {
            keyPath: 'id'
          });
          npcs.createIndex('byName', 'name');
          npcs.createIndex('byUpdatedAt', 'updatedAt');
        }
      }
    });
  }

  async listNpcs(): Promise<Npc[]> {
    const db = await this.dbPromise;
    const records = await db.getAll('npcs');
    return records.sort((left, right) => left.name.localeCompare(right.name));
  }

  async upsertNpc(npc: UpsertNpcInput): Promise<void> {
    const db = await this.dbPromise;
    const id = npc.id?.trim() || createNpcId();
    const existing = await db.get('npcs', id);
    const now = Date.now();
    const name = npc.name.trim();

    if (!name) {
      throw new Error('NPC name is required.');
    }

    const normalizedTags = npc.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [];
    const record: Npc = {
      id,
      name,
      initiativeMod: normalizeInitiativeMod(npc.initiativeMod),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(normalizedTags.length > 0 ? { tags: normalizedTags } : {})
    };

    await db.put('npcs', record);
  }

  async deleteNpc(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('npcs', id);
  }
}

export const npcsRepository = new NpcsRepository();
