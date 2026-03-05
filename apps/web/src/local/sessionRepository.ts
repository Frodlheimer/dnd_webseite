import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { LocalAssetKind, RoomSnapshot } from '@dnd-vtt/shared';

const DB_NAME = 'dnd-vtt-local-sessions-v1';
const DB_VERSION = 1;

type SnapshotRecord = {
  roomId: string;
  snapshot: RoomSnapshot;
  updatedAt: string;
};

export type LocalSnapshotSummary = {
  roomId: string;
  updatedAt: string;
  generatedAt: string;
};

type AssetRecord = {
  hash: string;
  blob: Blob;
  mime: string;
  size: number;
  kind: LocalAssetKind;
  label?: string;
  updatedAt: string;
};

type RoomAssetRefRecord = {
  id: string;
  roomId: string;
  hash: string;
  kind: LocalAssetKind;
  label?: string;
  createdAt: string;
};

type LocalSessionBundle = {
  version: 1;
  roomId: string;
  exportedAt: string;
  snapshot: RoomSnapshot;
  assets: Array<{
    hash: string;
    mime: string;
    size: number;
    kind: LocalAssetKind;
    label?: string;
    bytesBase64: string;
  }>;
};

type SessionDb = DBSchema & {
  snapshots: {
    key: string;
    value: SnapshotRecord;
  };
  assets: {
    key: string;
    value: AssetRecord;
  };
  roomAssets: {
    key: string;
    value: RoomAssetRefRecord;
    indexes: {
      byRoom: string;
      byRoomKind: [string, LocalAssetKind];
    };
  };
};

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const arrayBuffer =
    typeof blob.arrayBuffer === 'function'
      ? await blob.arrayBuffer()
      : await new Response(blob as BlobPart).arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }

  return btoa(binary);
};

const base64ToBlob = (value: string, mime: string): Blob => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], {
    type: mime
  });
};

const blobToText = async (blob: Blob): Promise<string> => {
  if (typeof blob.text === 'function') {
    return await blob.text();
  }

  if (typeof FileReader !== 'undefined') {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }

        reject(new Error('Could not read bundle text'));
      };
      reader.onerror = () => {
        reject(reader.error ?? new Error('Could not read bundle text'));
      };
      reader.readAsText(blob as unknown as Blob);
    });
  }

  return await new Response(blob as BlobPart).text();
};

const roomAssetKey = (roomId: string, hash: string): string => `${roomId}:${hash}`;

const collectChatAttachmentMetaFromSnapshot = (
  snapshot: RoomSnapshot
): Map<string, { mime: string; size: number; name: string }> => {
  const byHash = new Map<string, { mime: string; size: number; name: string }>();

  for (const message of snapshot.chat.messages) {
    for (const attachment of message.attachments ?? []) {
      if (!byHash.has(attachment.hash)) {
        byHash.set(attachment.hash, {
          mime: attachment.mime,
          size: attachment.size,
          name: attachment.name
        });
      }
    }
  }

  return byHash;
};

export type PutLocalAssetArgs = {
  hash: string;
  blob: Blob;
  mime: string;
  size: number;
  kind: LocalAssetKind;
  label?: string;
  roomId?: string;
};

export class LocalSessionRepository {
  private dbPromise: Promise<IDBPDatabase<SessionDb>>;

  constructor() {
    this.dbPromise = openDB<SessionDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', {
            keyPath: 'roomId'
          });
        }

        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', {
            keyPath: 'hash'
          });
        }

        if (!db.objectStoreNames.contains('roomAssets')) {
          const roomAssets = db.createObjectStore('roomAssets', {
            keyPath: 'id'
          });
          roomAssets.createIndex('byRoom', 'roomId');
          roomAssets.createIndex('byRoomKind', ['roomId', 'kind']);
        }
      }
    });
  }

  async saveSnapshot(roomId: string, snapshot: RoomSnapshot): Promise<void> {
    const db = await this.dbPromise;
    await db.put('snapshots', {
      roomId,
      snapshot,
      updatedAt: new Date().toISOString()
    });
  }

  async loadSnapshot(roomId: string): Promise<RoomSnapshot | null> {
    const db = await this.dbPromise;
    const record = await db.get('snapshots', roomId);
    return record?.snapshot ?? null;
  }

  async listRecentSnapshotSummaries(limit = 12): Promise<LocalSnapshotSummary[]> {
    const db = await this.dbPromise;
    const records = await db.getAll('snapshots');
    const normalized = records
      .map((record) => ({
        roomId: record.roomId,
        updatedAt: record.updatedAt,
        generatedAt: record.snapshot.generatedAt
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, Math.max(1, limit));

    return normalized;
  }

  async putAsset(args: PutLocalAssetArgs): Promise<void> {
    const db = await this.dbPromise;
    const assetRecord: AssetRecord = {
      hash: args.hash,
      blob: args.blob,
      mime: args.mime,
      size: args.size,
      kind: args.kind,
      updatedAt: new Date().toISOString()
    };

    if (args.label !== undefined) {
      assetRecord.label = args.label;
    }

    await db.put('assets', assetRecord);

    if (args.roomId) {
      const roomAssetRecord: RoomAssetRefRecord = {
        id: roomAssetKey(args.roomId, args.hash),
        roomId: args.roomId,
        hash: args.hash,
        kind: args.kind,
        createdAt: new Date().toISOString()
      };

      if (args.label !== undefined) {
        roomAssetRecord.label = args.label;
      }

      await db.put('roomAssets', roomAssetRecord);
    }
  }

  async getAsset(hash: string): Promise<Blob | null> {
    const db = await this.dbPromise;
    const record = await db.get('assets', hash);
    return record?.blob ?? null;
  }

  async getAssetMeta(hash: string): Promise<Omit<AssetRecord, 'blob'> | null> {
    const db = await this.dbPromise;
    const record = await db.get('assets', hash);
    if (!record) {
      return null;
    }

    const meta: Omit<AssetRecord, 'blob'> = {
      hash: record.hash,
      mime: record.mime,
      size: record.size,
      kind: record.kind,
      updatedAt: record.updatedAt
    };

    if (record.label !== undefined) {
      meta.label = record.label;
    }

    return meta;
  }

  async hasAssets(hashes: string[]): Promise<string[]> {
    const db = await this.dbPromise;
    const missing: string[] = [];

    await Promise.all(
      hashes.map(async (hash) => {
        const existing = await db.getKey('assets', hash);
        if (!existing) {
          missing.push(hash);
        }
      })
    );

    return missing;
  }

  async listRoomAssets(roomId: string, kind?: LocalAssetKind): Promise<RoomAssetRefRecord[]> {
    const db = await this.dbPromise;
    const store = db.transaction('roomAssets').store;

    if (!kind) {
      return store.index('byRoom').getAll(roomId);
    }

    return store.index('byRoomKind').getAll([roomId, kind]);
  }

  async exportBundle(roomId: string): Promise<Blob> {
    const db = await this.dbPromise;
    const snapshotRecord = await db.get('snapshots', roomId);
    if (!snapshotRecord) {
      throw new Error('No local snapshot available for this room');
    }

    const chatAttachmentMetaByHash = collectChatAttachmentMetaFromSnapshot(snapshotRecord.snapshot);
    const hashes = [...new Set([...snapshotRecord.snapshot.assetsManifest.hashes, ...chatAttachmentMetaByHash.keys()])];
    const assets: LocalSessionBundle['assets'] = [];

    for (const hash of hashes) {
      const record = await db.get('assets', hash);
      if (!record) {
        continue;
      }

      const exportedAsset: LocalSessionBundle['assets'][number] = {
        hash,
        mime: record.mime,
        size: record.size,
        kind: record.kind,
        bytesBase64: await blobToBase64(record.blob)
      };

      const chatMeta = chatAttachmentMetaByHash.get(hash);
      if (record.label !== undefined) {
        exportedAsset.label = record.label;
      } else if (chatMeta) {
        exportedAsset.label = chatMeta.name;
      }

      assets.push(exportedAsset);
    }

    const bundle: LocalSessionBundle = {
      version: 1,
      roomId,
      exportedAt: new Date().toISOString(),
      snapshot: snapshotRecord.snapshot,
      assets
    };

    return new Blob([JSON.stringify(bundle)], {
      type: 'application/json'
    });
  }

  async importBundle(file: Blob): Promise<{ roomId: string; snapshot: RoomSnapshot }> {
    const text = await blobToText(file);
    const parsed = JSON.parse(text) as Partial<LocalSessionBundle>;

    if (parsed.version !== 1 || typeof parsed.roomId !== 'string' || !parsed.snapshot) {
      throw new Error('Invalid session bundle format');
    }

    const roomId = parsed.roomId;
    const incomingSnapshot = parsed.snapshot as RoomSnapshot;
    const manifestHashes = new Set<string>(incomingSnapshot.assetsManifest?.hashes ?? []);
    const manifestByHash = {
      ...(incomingSnapshot.assetsManifest?.byHash ?? {})
    } as RoomSnapshot['assetsManifest']['byHash'];

    for (const asset of parsed.assets ?? []) {
      if (!asset.hash || !asset.mime || !asset.kind || !Number.isFinite(asset.size)) {
        continue;
      }

      if (asset.kind !== 'CHAT_FILE') {
        manifestHashes.add(asset.hash);
        manifestByHash[asset.hash] = {
          mime: asset.mime,
          size: asset.size,
          kind: asset.kind
        };
      }
    }

    const snapshot: RoomSnapshot = {
      ...incomingSnapshot,
      assetsManifest: {
        hashes: [...manifestHashes],
        byHash: manifestByHash
      }
    };

    await this.saveSnapshot(roomId, snapshot);

    for (const asset of parsed.assets ?? []) {
      if (!asset.hash || !asset.mime || !asset.bytesBase64 || !asset.kind || !asset.size) {
        continue;
      }

      const putArgs: PutLocalAssetArgs = {
        hash: asset.hash,
        blob: base64ToBlob(asset.bytesBase64, asset.mime),
        mime: asset.mime,
        size: asset.size,
        kind: asset.kind,
        roomId
      };

      if (asset.label !== undefined) {
        putArgs.label = asset.label;
      }

      await this.putAsset({
        ...putArgs
      });
    }

    return {
      roomId,
      snapshot
    };
  }
}

export const localSessionRepository = new LocalSessionRepository();
