import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import type { RoomSnapshot } from '@dnd-vtt/shared';

import { LocalSessionRepository } from './sessionRepository';
import { sha256Hex } from './hash';

const buildSnapshot = (roomId: string, hash: string): RoomSnapshot => ({
  snapshotVersion: 1,
  roomId,
  generatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  hostUserId: 'host-user-1',
  settings: {
    tokenMovePolicy: 'ALL',
    tokenEditPolicy: 'DM_ONLY',
    mapEditPolicy: 'DM_ONLY',
    mapEditUserOverrides: [],
    autoExportEnabled: true,
    autoExportIntervalMinutes: 30,
    gridType: 'SQUARE',
    cellSizePx: 48,
    cellDistance: 5,
    cellUnit: 'ft',
    gridOriginX: 0,
    gridOriginY: 0,
    gridOriginZ: 0,
    snapToGrid: true,
    stackDisplay: 'FAN',
    mapOffsetX: 0,
    mapOffsetY: 0,
    mapScale: 1,
    mapRotationDeg: 0
  },
  currentMapRef: {
    kind: 'LOCAL_ASSET',
    hash
  },
  tokens: [],
  mapEdit: {
    rev: 0,
    document: {
      elements: []
    }
  },
  chat: {
    messages: [],
    maxMessages: 500
  },
  assetsManifest: {
    hashes: [hash],
    byHash: {
      [hash]: {
        mime: 'image/png',
        size: 4,
        kind: 'MAP'
      }
    }
  }
});

describe('LocalSessionRepository', () => {
  it('saves and loads snapshots by room id', async () => {
    const repository = new LocalSessionRepository();
    const hash = 'a'.repeat(64);
    const roomId = `room-${Date.now().toString(36)}-snapshot`;
    const snapshot = buildSnapshot(roomId, hash);

    await repository.saveSnapshot(roomId, snapshot);
    const loaded = await repository.loadSnapshot(roomId);

    expect(loaded).toEqual(snapshot);
  });

  it('stores and loads assets by hash', async () => {
    const repository = new LocalSessionRepository();
    const hash = 'b'.repeat(64);
    const roomId = `room-${Date.now().toString(36)}-asset`;
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });

    await repository.putAsset({
      hash,
      blob,
      mime: 'image/png',
      size: 4,
      kind: 'MAP',
      roomId,
      label: 'Test Map'
    });

    const loadedBlob = await repository.getAsset(hash);
    const missing = await repository.hasAssets([hash, 'c'.repeat(64)]);
    const roomAssets = await repository.listRoomAssets(roomId, 'MAP');

    expect(loadedBlob).not.toBeNull();
    expect(missing).toEqual(['c'.repeat(64)]);
    expect(roomAssets).toHaveLength(1);
    expect(roomAssets[0]?.hash).toBe(hash);
  });

  it('hashes and stores chat file blobs by SHA-256 hash', async () => {
    const repository = new LocalSessionRepository();
    const roomId = `room-${Date.now().toString(36)}-chat-hash`;
    const bytes = new TextEncoder().encode('hello-chat-file');
    const blob = new Blob([bytes], { type: 'text/plain' });
    const hash = await sha256Hex(bytes.buffer);

    await repository.putAsset({
      hash,
      blob,
      mime: 'text/plain',
      size: blob.size,
      kind: 'CHAT_FILE',
      roomId,
      label: 'hello.txt'
    });

    const stored = await repository.getAsset(hash);
    expect(stored).not.toBeNull();
  });

  it('exports/imports chat file assets without adding them to assets manifest', async () => {
    const repository = new LocalSessionRepository();
    const mapHash = 'd'.repeat(64);
    const chatHash = 'e'.repeat(64);
    const roomId = `room-${Date.now().toString(36)}-bundle`;

    const snapshot = buildSnapshot(roomId, mapHash);
    snapshot.chat.messages = [
      {
        kind: 'PUBLIC',
        id: 'chat-1',
        ts: Date.now(),
        fromUserId: 'host-user-1',
        fromName: 'DM',
        text: 'see attachment',
        attachments: [
          {
            hash: chatHash,
            name: 'note.txt',
            mime: 'text/plain',
            size: 4,
            seedUserId: 'host-user-1'
          }
        ]
      }
    ];
    snapshot.assetsManifest = {
      hashes: [mapHash],
      byHash: {
        [mapHash]: {
          mime: 'image/png',
          size: 4,
          kind: 'MAP'
        }
      }
    };

    await repository.saveSnapshot(roomId, snapshot);
    await repository.putAsset({
      hash: mapHash,
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }),
      mime: 'image/png',
      size: 4,
      kind: 'MAP',
      roomId
    });
    await repository.putAsset({
      hash: chatHash,
      blob: new Blob([new Uint8Array([9, 8, 7, 6])], { type: 'text/plain' }),
      mime: 'text/plain',
      size: 4,
      kind: 'CHAT_FILE',
      roomId,
      label: 'note.txt'
    });

    const bundleBlob = await repository.exportBundle(roomId);

    const importedRepository = new LocalSessionRepository();
    const imported = await importedRepository.importBundle(bundleBlob);
    expect(imported.snapshot.assetsManifest.hashes).toContain(mapHash);
    expect(imported.snapshot.assetsManifest.hashes).not.toContain(chatHash);

    const importedMapBlob = await importedRepository.getAsset(mapHash);
    const importedChatBlob = await importedRepository.getAsset(chatHash);
    expect(importedMapBlob).not.toBeNull();
    expect(importedChatBlob).not.toBeNull();
  });

});
