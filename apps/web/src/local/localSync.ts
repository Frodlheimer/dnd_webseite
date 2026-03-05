import type {
  HostEvent,
  ImageRef,
  LocalSessionSettings,
  MapEditElement,
  MapEditOperation,
  MapEditSnapshot,
  MapRef,
  RoomSnapshot,
  TokenMovePolicy,
  MapEditPolicy,
  MapEditUserOverride,
  VttToken
} from '@dnd-vtt/shared';

import type { BoardSettings } from '../components/boardTypes';
import { LOCAL_CHAT_MAX_MESSAGES, appendChatMessageToSnapshot, chatMessageFromHostEvent } from './chatHost';

const cloneElement = (element: MapEditElement): MapEditElement => {
  return JSON.parse(JSON.stringify(element)) as MapEditElement;
};

const cloneElements = (elements: MapEditElement[]): MapEditElement[] => elements.map((element) => cloneElement(element));

const DEFAULT_LOCAL_MANIFEST_MIME = 'application/octet-stream';

type LocalAssetRefInfo = {
  hash: string;
  kind: RoomSnapshot['assetsManifest']['byHash'][string]['kind'];
};

const collectHashFromImageRef = (imageRef: ImageRef | null | undefined, collector: Set<string>): void => {
  if (!imageRef || imageRef.kind !== 'LOCAL_ASSET') {
    return;
  }

  collector.add(imageRef.hash);
};

const collectHashFromMapRef = (mapRef: MapRef | null | undefined, collector: Set<string>): void => {
  if (!mapRef || mapRef.kind !== 'LOCAL_ASSET') {
    return;
  }

  collector.add(mapRef.hash);
};

const collectHashesFromMapEditElements = (elements: MapEditElement[], collector: Set<string>): void => {
  for (const element of elements) {
    if (element.type !== 'IMAGE') {
      continue;
    }

    collectHashFromImageRef(element.imageRef, collector);
  }
};

const collectAssetRefsFromMapEditElements = (elements: MapEditElement[], collector: Map<string, LocalAssetRefInfo>): void => {
  for (const element of elements) {
    if (element.type !== 'IMAGE' || element.imageRef.kind !== 'LOCAL_ASSET') {
      continue;
    }

    if (!collector.has(element.imageRef.hash)) {
      collector.set(element.imageRef.hash, {
        hash: element.imageRef.hash,
        kind: 'MAP_EDIT_IMAGE'
      });
    }
  }
};

const collectLocalAssetRefsFromSnapshot = (snapshot: RoomSnapshot): LocalAssetRefInfo[] => {
  const refs = new Map<string, LocalAssetRefInfo>();

  if (snapshot.currentMapRef?.kind === 'LOCAL_ASSET') {
    refs.set(snapshot.currentMapRef.hash, {
      hash: snapshot.currentMapRef.hash,
      kind: 'MAP'
    });
  }

  for (const token of snapshot.tokens) {
    if (token.imageRef?.kind !== 'LOCAL_ASSET') {
      continue;
    }

    if (!refs.has(token.imageRef.hash)) {
      refs.set(token.imageRef.hash, {
        hash: token.imageRef.hash,
        kind: 'TOKEN_IMAGE'
      });
    }
  }

  collectAssetRefsFromMapEditElements(snapshot.mapEdit.document.elements, refs);

  return [...refs.values()];
};

const collectLocalAssetRefsFromHostEvent = (event: HostEvent): LocalAssetRefInfo[] => {
  const refs = new Map<string, LocalAssetRefInfo>();

  if ((event.type === 'TOKEN_CREATED' || event.type === 'TOKEN_UPDATED') && event.token.imageRef?.kind === 'LOCAL_ASSET') {
    refs.set(event.token.imageRef.hash, {
      hash: event.token.imageRef.hash,
      kind: 'TOKEN_IMAGE'
    });
  } else if (event.type === 'MAP_ACTIVE_SET' && event.mapRef?.kind === 'LOCAL_ASSET') {
    refs.set(event.mapRef.hash, {
      hash: event.mapRef.hash,
      kind: 'MAP'
    });
  } else if (event.type === 'MAPEDIT_OPS_APPLIED') {
    for (const operation of event.ops) {
      if (operation.kind !== 'UPSERT') {
        continue;
      }

      collectAssetRefsFromMapEditElements(operation.elements, refs);
    }
  }

  return [...refs.values()];
};

const ensureSnapshotAssetManifest = (snapshot: RoomSnapshot, refs: LocalAssetRefInfo[]): RoomSnapshot => {
  if (refs.length === 0) {
    return snapshot;
  }

  const existingManifest = snapshot.assetsManifest ?? {
    hashes: [],
    byHash: {}
  };
  const nextHashes = new Set(existingManifest.hashes);
  const nextByHash: RoomSnapshot['assetsManifest']['byHash'] = {
    ...existingManifest.byHash
  };
  let changed = false;

  for (const ref of refs) {
    if (!nextHashes.has(ref.hash)) {
      nextHashes.add(ref.hash);
      changed = true;
    }

    const existing = nextByHash[ref.hash];
    if (!existing) {
      nextByHash[ref.hash] = {
        mime: DEFAULT_LOCAL_MANIFEST_MIME,
        size: 0,
        kind: ref.kind
      };
      changed = true;
      continue;
    }

    if (existing.kind === 'OTHER' && ref.kind !== 'OTHER') {
      nextByHash[ref.hash] = {
        ...existing,
        kind: ref.kind
      };
      changed = true;
    }
  }

  if (!changed) {
    return snapshot;
  }

  return {
    ...snapshot,
    assetsManifest: {
      hashes: [...nextHashes],
      byHash: nextByHash
    }
  };
};

export const defaultLocalSessionSettings = (boardSettings: BoardSettings): LocalSessionSettings => ({
  tokenMovePolicy: 'ALL',
  tokenEditPolicy: 'DM_ONLY',
  mapEditPolicy: 'DM_ONLY',
  mapEditUserOverrides: [],
  autoExportEnabled: true,
  autoExportIntervalMinutes: 30,
  gridType: boardSettings.gridType,
  cellSizePx: boardSettings.cellSizePx,
  cellDistance: boardSettings.cellDistance,
  cellUnit: boardSettings.cellUnit,
  gridOriginX: boardSettings.gridOriginX,
  gridOriginY: boardSettings.gridOriginY,
  gridOriginZ: boardSettings.gridOriginZ,
  snapToGrid: boardSettings.snapToGrid,
  stackDisplay: boardSettings.stackDisplay,
  mapOffsetX: boardSettings.mapOffsetX,
  mapOffsetY: boardSettings.mapOffsetY,
  mapScale: boardSettings.mapScale,
  mapRotationDeg: boardSettings.mapRotationDeg
});

export const toBoardSettingsFromLocal = (
  settings: LocalSessionSettings,
  previous: BoardSettings
): BoardSettings => {
  return {
    ...previous,
    gridType: settings.gridType,
    cellSizePx: settings.cellSizePx,
    cellDistance: settings.cellDistance,
    cellUnit: settings.cellUnit,
    gridOriginX: settings.gridOriginX,
    gridOriginY: settings.gridOriginY,
    gridOriginZ: settings.gridOriginZ,
    snapToGrid: settings.snapToGrid,
    stackDisplay: settings.stackDisplay,
    mapOffsetX: settings.mapOffsetX,
    mapOffsetY: settings.mapOffsetY,
    mapScale: settings.mapScale,
    mapRotationDeg: settings.mapRotationDeg
  };
};

export const buildLocalSnapshot = (args: {
  roomId: string;
  hostUserId: string;
  settings: LocalSessionSettings;
  currentMapRef?: MapRef | null;
  tokens?: VttToken[];
  mapEditElements?: MapEditElement[];
  mapEditRev?: number;
  chat?: RoomSnapshot['chat'];
  assetsManifest?: RoomSnapshot['assetsManifest'];
}): RoomSnapshot => {
  return {
    snapshotVersion: 1,
    roomId: args.roomId,
    generatedAt: new Date().toISOString(),
    hostUserId: args.hostUserId,
    settings: args.settings,
    currentMapRef: args.currentMapRef ?? null,
    tokens: args.tokens ?? [],
    mapEdit: {
      rev: args.mapEditRev ?? 0,
      document: {
        elements: cloneElements(args.mapEditElements ?? [])
      }
    },
    chat:
      args.chat ??
      ({
        messages: [],
        maxMessages: LOCAL_CHAT_MAX_MESSAGES
      } satisfies RoomSnapshot['chat']),
    assetsManifest:
      args.assetsManifest ??
      ({
        hashes: [],
        byHash: {}
      } satisfies RoomSnapshot['assetsManifest'])
  };
};

const applyMapEditOperations = (elements: MapEditElement[], operations: MapEditOperation[]): MapEditElement[] => {
  let next = [...elements];

  for (const operation of operations) {
    if (operation.kind === 'CLEAR') {
      next = [];
      continue;
    }

    if (operation.kind === 'DELETE') {
      const ids = new Set(operation.elementIds);
      next = next.filter((element) => !ids.has(element.id));
      continue;
    }

    const byId = new Map(next.map((element, index) => [element.id, index]));
    for (const element of operation.elements) {
      const index = byId.get(element.id);
      if (index === undefined) {
        next.push(cloneElement(element));
      } else {
        next[index] = cloneElement(element);
      }
    }
  }

  return next;
};

export const applyHostEventToSnapshot = (snapshot: RoomSnapshot, event: HostEvent): RoomSnapshot => {
  let nextSnapshot = snapshot;

  if (event.type === 'TOKEN_CREATED') {
    nextSnapshot = {
      ...snapshot,
      generatedAt: new Date().toISOString(),
      tokens: [...snapshot.tokens.filter((token) => token.id !== event.token.id), event.token]
    };
  } else if (event.type === 'TOKEN_MOVED') {
    nextSnapshot = {
      ...snapshot,
      generatedAt: new Date().toISOString(),
      tokens: snapshot.tokens.map((token) =>
        token.id === event.tokenId
          ? {
              ...token,
              x: event.x,
              y: event.y
            }
          : token
      )
    };
  } else if (event.type === 'TOKEN_UPDATED') {
    nextSnapshot = {
      ...snapshot,
      generatedAt: new Date().toISOString(),
      tokens: snapshot.tokens.map((token) => (token.id === event.token.id ? event.token : token))
    };
  } else if (event.type === 'TOKEN_DELETED') {
    nextSnapshot = {
      ...snapshot,
      generatedAt: new Date().toISOString(),
      tokens: snapshot.tokens.filter((token) => token.id !== event.tokenId)
    };
  } else if (event.type === 'ROOM_SETTINGS_UPDATED') {
    nextSnapshot = {
      ...snapshot,
      generatedAt: new Date().toISOString(),
      settings: event.settings
    };
  } else if (event.type === 'MAP_ACTIVE_SET') {
    nextSnapshot = {
      ...snapshot,
      generatedAt: new Date().toISOString(),
      currentMapRef: event.mapRef
    };
  } else if (event.type === 'MAPEDIT_OPS_APPLIED') {
    nextSnapshot = {
      ...snapshot,
      generatedAt: new Date().toISOString(),
      mapEdit: {
        rev: event.toRev,
        document: {
          elements: applyMapEditOperations(snapshot.mapEdit.document.elements, event.ops)
        }
      }
    };
  } else if (
    event.type === 'CHAT_MESSAGE_PUBLIC' ||
    event.type === 'CHAT_MESSAGE_WHISPER' ||
    event.type === 'CHAT_MESSAGE_DM_NOTE'
  ) {
    nextSnapshot = appendChatMessageToSnapshot(snapshot, chatMessageFromHostEvent(event));
  }

  return ensureSnapshotAssetManifest(nextSnapshot, collectLocalAssetRefsFromHostEvent(event));
};

export const normalizeSnapshotAssetManifest = (snapshot: RoomSnapshot): RoomSnapshot => {
  return ensureSnapshotAssetManifest(snapshot, collectLocalAssetRefsFromSnapshot(snapshot));
};

export const collectLocalAssetHashesFromSnapshot = (snapshot: RoomSnapshot): string[] => {
  const collector = new Set<string>();

  collectHashFromMapRef(snapshot.currentMapRef, collector);

  for (const token of snapshot.tokens) {
    collectHashFromImageRef(token.imageRef ?? null, collector);
  }

  collectHashesFromMapEditElements(snapshot.mapEdit.document.elements, collector);

  for (const hash of snapshot.assetsManifest.hashes) {
    collector.add(hash);
  }

  return [...collector];
};

export const collectLocalAssetHashesFromHostEvent = (event: HostEvent): string[] => {
  return collectLocalAssetRefsFromHostEvent(event).map((entry) => entry.hash);
};

export const toMapEditSnapshot = (snapshot: RoomSnapshot): MapEditSnapshot => ({
  revision: snapshot.mapEdit.rev,
  elements: cloneElements(snapshot.mapEdit.document.elements)
});

export const chunkJsonString = (json: string, maxChars = 180_000): string[] => {
  if (json.length <= maxChars) {
    return [json];
  }

  const chunks: string[] = [];
  for (let index = 0; index < json.length; index += maxChars) {
    chunks.push(json.slice(index, index + maxChars));
  }

  return chunks;
};

export const encodeRoomSnapshotChunks = (snapshot: RoomSnapshot, transferId: string): Array<{
  type: 'HOST_SNAPSHOT_CHUNK';
  transferId: string;
  seq: number;
  total: number;
  bytesBase64: string;
}> => {
  const snapshotJson = JSON.stringify(snapshot);
  const parts = chunkJsonString(snapshotJson);
  const total = parts.length;

  return parts.map((part, seq) => ({
    type: 'HOST_SNAPSHOT_CHUNK',
    transferId,
    seq,
    total,
    bytesBase64: btoa(unescape(encodeURIComponent(part)))
  }));
};

export const decodeSnapshotChunk = (chunkBase64: string): string => {
  return decodeURIComponent(escape(atob(chunkBase64)));
};

export const buildDefaultPolicies = (): {
  tokenMovePolicy: TokenMovePolicy;
  tokenEditPolicy: TokenMovePolicy;
  mapEditPolicy: MapEditPolicy;
  mapEditUserOverrides: MapEditUserOverride[];
} => ({
  tokenMovePolicy: 'ALL',
  tokenEditPolicy: 'DM_ONLY',
  mapEditPolicy: 'DM_ONLY',
  mapEditUserOverrides: []
});
