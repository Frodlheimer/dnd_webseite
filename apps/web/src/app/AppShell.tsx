import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent
} from 'react';

import {
  LocalSessionSettingsSchema,
  RoomSnapshotSchema,
  type ClientToServerMessage,
  type ChatAttachment,
  type ChatSendKind,
  type DirectFromHostMessage,
  type HostDirect,
  type HostEvent,
  type HostRequest,
  type ImageRef,
  type LocalAssetKind,
  type LocalSessionSettings,
  type LocalSessionSettingsPatch,
  type MapRef,
  type MapEditOperation,
  type MapEditOpsAppliedMessage,
  type MapEditPolicy,
  type MapEditSnapshot,
  type MapEditUserOverride,
  type Role,
  type RoomAsset,
  type RoomSettings,
  type RoomSnapshot,
  type StorageMode,
  type TokenKind,
  type TokenMovePolicy,
  type VttToken,
  type RelayFromUserMessage,
  ServerToClientMessageSchema
} from '@dnd-vtt/shared';

import {
  buildAssetUrl,
  createRoom,
  joinRoom,
  listRoomAssets,
  uploadMapAsset,
  uploadRoomAsset
} from './apiClient';
import { getOrCreateClientId } from './clientId';
import { useAppStore } from './store';
import { BoardCanvas } from '../components/BoardCanvas';
import { ChatPanel } from '../components/ChatPanel';
import {
  DEFAULT_BOARD_SETTINGS,
  sanitizeBoardSettings,
  type BoardSettings,
  type TokenDraft
} from '../components/boardTypes';
import { localAssetUrlResolver } from '../local/assetUrlResolver';
import { sha256Hex } from '../local/hash';
import {
  LOCAL_CHAT_CLIENT_RATE_LIMIT_MS,
  LOCAL_CHAT_MAX_TEXT_LENGTH,
  appendChatMessageToSnapshot,
  chatMessageFromHostDirect,
  filterSnapshotForUser,
  processChatSendRequest
} from '../local/chatHost';
import {
  applyHostEventToSnapshot,
  buildDefaultPolicies,
  buildLocalSnapshot,
  collectLocalAssetHashesFromHostEvent,
  collectLocalAssetHashesFromSnapshot,
  decodeSnapshotChunk,
  defaultLocalSessionSettings,
  encodeRoomSnapshotChunks,
  normalizeSnapshotAssetManifest,
  toBoardSettingsFromLocal,
  toMapEditSnapshot
} from '../local/localSync';
import { localSessionRepository } from '../local/sessionRepository';
import { FileTransferManager, type OutboundFileSignal } from '../p2p/fileTransfer';

const tokenMovePolicies: TokenMovePolicy[] = ['ALL', 'OWNED_ONLY', 'DM_ONLY'];
const tokenEditPolicies: TokenMovePolicy[] = ['DM_ONLY', 'OWNED_ONLY', 'ALL'];
const mapEditPolicies: MapEditPolicy[] = ['DM_ONLY', 'PLAYERS'];
const THEME_STORAGE_KEY = 'dnd-vtt-theme';
const BOARD_SETTINGS_STORAGE_PREFIX = 'dnd-vtt-board-settings';
const LOCAL_ASSET_ID_PREFIX = 'local:';
const LOCAL_ASSET_CHUNK_SIZE = 48_000;
const LOCAL_SETTINGS_SYNC_INTERVAL_MS = 150;
const HOST_CONFIRMATION_SLOW_MS = 5_000;
const AUTO_EXPORT_DIRECTORY_NAME_STORAGE_PREFIX = 'dnd-vtt-auto-export-directory-name';
const MAX_LOCAL_CHAT_REQUEST_BYTES = 230 * 1024;

const formatExportTimestamp = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}_${hour}-${minute}-${second}`;
};

const createLocalEntityId = (prefix: string): string => {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
};

const createTransferId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return createLocalEntityId('transfer');
};

const isLocalAssetId = (value: string | null | undefined): value is string => {
  return typeof value === 'string' && value.startsWith(LOCAL_ASSET_ID_PREFIX);
};

const toLocalAssetId = (hash: string): string => `${LOCAL_ASSET_ID_PREFIX}${hash}`;
const localAssetHashFromId = (assetId: string): string =>
  assetId.slice(LOCAL_ASSET_ID_PREFIX.length);

const defaultColorForKind = (kind: TokenKind): string => {
  if (kind === 'ALLY') {
    return '#22c55e';
  }

  if (kind === 'ENEMY') {
    return '#ef4444';
  }

  return '#7dd3fc';
};

const isTokenOwnedByUser = (token: VttToken, userId: string | null): boolean => {
  if (!userId) {
    return false;
  }

  if (token.controlledBy.mode === 'ALL') {
    return true;
  }

  return token.controlledBy.userIds.includes(userId);
};

const resolveMapEditAccess = (args: {
  role: Role | null;
  settings: RoomSettings | null;
  userId: string | null;
}): boolean => {
  if (!args.role || !args.settings || !args.userId) {
    return false;
  }

  if (args.role === 'DM') {
    return true;
  }

  const override = args.settings.mapEditUserOverrides.find((entry) => entry.userId === args.userId);

  if (override) {
    return override.enabled;
  }

  if (args.role === 'PLAYER') {
    return args.settings.mapEditPolicy === 'PLAYERS';
  }

  return false;
};

const resolveMapEditAccessForMember = (args: {
  memberRole: Role;
  memberUserId: string;
  settings: RoomSettings;
}): boolean => {
  return resolveMapEditPolicyAccess({
    memberRole: args.memberRole,
    memberUserId: args.memberUserId,
    mapEditPolicy: args.settings.mapEditPolicy,
    mapEditUserOverrides: args.settings.mapEditUserOverrides
  });
};

const resolveMapEditPolicyAccess = (args: {
  memberRole: Role;
  memberUserId: string;
  mapEditPolicy: MapEditPolicy;
  mapEditUserOverrides: MapEditUserOverride[];
}): boolean => {
  if (args.memberRole === 'DM') {
    return true;
  }

  const override = args.mapEditUserOverrides.find((entry) => entry.userId === args.memberUserId);
  if (override) {
    return override.enabled;
  }

  if (args.memberRole === 'PLAYER') {
    return args.mapEditPolicy === 'PLAYERS';
  }

  return false;
};

const canLocalMemberMoveToken = (args: {
  requesterRole: Role;
  requesterUserId: string;
  tokenMovePolicy: TokenMovePolicy;
  token: VttToken;
}): boolean => {
  if (args.requesterRole === 'DM') {
    return true;
  }

  if (args.requesterRole !== 'PLAYER') {
    return false;
  }

  if (args.tokenMovePolicy === 'DM_ONLY') {
    return false;
  }

  if (args.tokenMovePolicy === 'ALL') {
    return true;
  }

  return isTokenOwnedByUser(args.token, args.requesterUserId);
};

const canLocalMemberEditToken = (args: {
  requesterRole: Role;
  requesterUserId: string;
  tokenEditPolicy: TokenMovePolicy;
  token: VttToken;
}): boolean => {
  if (args.requesterRole === 'DM') {
    return true;
  }

  if (args.requesterRole !== 'PLAYER') {
    return false;
  }

  if (args.tokenEditPolicy === 'DM_ONLY') {
    return false;
  }

  if (args.tokenEditPolicy === 'ALL') {
    return true;
  }

  return isTokenOwnedByUser(args.token, args.requesterUserId);
};

const snapPointToGrid = (
  x: number,
  y: number,
  settings: Pick<BoardSettings, 'gridType' | 'cellSizePx' | 'gridOriginX' | 'gridOriginY'>
): { x: number; y: number } => {
  const cellSize = Math.max(1, settings.cellSizePx);

  if (settings.gridType === 'HEX') {
    const radius = Math.max(8, cellSize / 2);
    const hexWidth = Math.sqrt(3) * radius;
    const rowHeight = radius * 1.5;
    const localX = x - settings.gridOriginX;
    const localY = y - settings.gridOriginY;
    const row = Math.round(localY / rowHeight);
    const rowOffset = row % 2 === 0 ? 0 : hexWidth / 2;
    const col = Math.round((localX - rowOffset) / hexWidth);

    return {
      x: settings.gridOriginX + col * hexWidth + rowOffset,
      y: settings.gridOriginY + row * rowHeight
    };
  }

  const cellX = settings.gridOriginX + Math.floor((x - settings.gridOriginX) / cellSize) * cellSize;
  const cellY = settings.gridOriginY + Math.floor((y - settings.gridOriginY) / cellSize) * cellSize;

  return {
    x: cellX + cellSize / 2,
    y: cellY + cellSize / 2
  };
};

type MapCoordinateFrame = {
  widthPx: number;
  heightPx: number;
  mapOffsetX: number;
  mapOffsetY: number;
  mapScale: number;
  mapRotationDeg: number;
};

type PendingHostConfirmationKind = 'TOKEN' | 'SETTINGS' | 'MAP' | 'MAP_EDIT' | 'CHAT';

type ChatAttachmentTransferStatus = 'available' | 'not_downloaded' | 'downloading' | 'failed';

type ChatAttachmentTransferState = {
  status: ChatAttachmentTransferStatus;
  progress: number;
  error?: string;
};

const resolvePendingKindsForHostEvent = (event: HostEvent): PendingHostConfirmationKind[] => {
  if (
    event.type === 'TOKEN_CREATED' ||
    event.type === 'TOKEN_MOVED' ||
    event.type === 'TOKEN_UPDATED' ||
    event.type === 'TOKEN_DELETED'
  ) {
    return ['TOKEN'];
  }

  if (event.type === 'ROOM_SETTINGS_UPDATED') {
    return ['SETTINGS'];
  }

  if (event.type === 'MAP_ACTIVE_SET') {
    return ['MAP'];
  }

  if (event.type === 'MAPEDIT_OPS_APPLIED') {
    return ['MAP_EDIT'];
  }

  if (
    event.type === 'CHAT_MESSAGE_PUBLIC' ||
    event.type === 'CHAT_MESSAGE_WHISPER' ||
    event.type === 'CHAT_MESSAGE_DM_NOTE'
  ) {
    return ['CHAT'];
  }

  return [];
};

const degToRad = (deg: number): number => {
  return (deg * Math.PI) / 180;
};

const toMapLocalPoint = (
  x: number,
  y: number,
  mapFrame: MapCoordinateFrame | null
): { x: number; y: number } | null => {
  if (!mapFrame) {
    return null;
  }

  if (
    !Number.isFinite(mapFrame.widthPx) ||
    !Number.isFinite(mapFrame.heightPx) ||
    mapFrame.widthPx <= 0 ||
    mapFrame.heightPx <= 0
  ) {
    return null;
  }

  const scale = Math.max(0.0001, Math.abs(mapFrame.mapScale));
  const radians = degToRad(mapFrame.mapRotationDeg);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const normalizedX = (x - mapFrame.mapOffsetX) / scale;
  const normalizedY = (y - mapFrame.mapOffsetY) / scale;

  return {
    x: cos * normalizedX + sin * normalizedY,
    y: -sin * normalizedX + cos * normalizedY
  };
};

const toGridCoordinates = (
  x: number,
  y: number,
  elevation: number,
  settings: Pick<
    BoardSettings,
    'gridType' | 'cellSizePx' | 'gridOriginX' | 'gridOriginY' | 'gridOriginZ'
  >,
  mapFrame: MapCoordinateFrame | null = null
): { x: number; y: number; z: number } => {
  const cellSize = Math.max(1, settings.cellSizePx);
  const mapLocalPoint = toMapLocalPoint(x, y, mapFrame);

  if (mapLocalPoint && mapFrame) {
    if (settings.gridType === 'HEX') {
      const radius = Math.max(8, cellSize / 2);
      const hexWidth = Math.sqrt(3) * radius;
      const rowHeight = radius * 1.5;
      const localX = mapLocalPoint.x;
      const localYFromBottom = mapFrame.heightPx - mapLocalPoint.y;
      const row = Math.round(localYFromBottom / rowHeight);
      const rowOffset = row % 2 === 0 ? 0 : hexWidth / 2;
      const col = Math.round((localX - rowOffset) / hexWidth);

      return {
        x: col,
        y: row,
        z: settings.gridOriginZ + elevation
      };
    }

    return {
      x: Math.floor(mapLocalPoint.x / cellSize),
      y: Math.floor((mapFrame.heightPx - mapLocalPoint.y) / cellSize),
      z: settings.gridOriginZ + elevation
    };
  }

  if (settings.gridType === 'HEX') {
    const radius = Math.max(8, cellSize / 2);
    const hexWidth = Math.sqrt(3) * radius;
    const rowHeight = radius * 1.5;
    const localX = x - settings.gridOriginX;
    const localY = y - settings.gridOriginY;
    const row = Math.round(localY / rowHeight);
    const rowOffset = row % 2 === 0 ? 0 : hexWidth / 2;
    const col = Math.round((localX - rowOffset) / hexWidth);

    return {
      x: col,
      y: -row,
      z: settings.gridOriginZ + elevation
    };
  }

  return {
    x: Math.floor((x - settings.gridOriginX) / cellSize),
    y: -Math.floor((y - settings.gridOriginY) / cellSize),
    z: settings.gridOriginZ + elevation
  };
};

const stripSourceUrlFromMapEditOperation = (operation: MapEditOperation): MapEditOperation => {
  if (operation.kind !== 'UPSERT') {
    return operation;
  }

  return {
    ...operation,
    elements: operation.elements.map((element) => {
      if (element.type !== 'IMAGE' || !element.sourceUrl) {
        return element;
      }

      const { sourceUrl: _removedSourceUrl, ...withoutSourceUrl } = element;
      return withoutSourceUrl;
    })
  };
};

export const AppShell = () => {
  const [createRoomName, setCreateRoomName] = useState('New Adventure Room');
  const [createDisplayName, setCreateDisplayName] = useState('DM');
  const [createStorageMode, setCreateStorageMode] = useState<StorageMode>('LOCAL');
  const [joinSecretInput, setJoinSecretInput] = useState('');
  const [joinDisplayName, setJoinDisplayName] = useState('Player');
  const [joinRoleDesired, setJoinRoleDesired] = useState<'PLAYER' | 'SPECTATOR'>('PLAYER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mapAssets, setMapAssets] = useState<RoomAsset[]>([]);
  const [isUploadingMap, setIsUploadingMap] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [boardSettings, setBoardSettings] = useState<BoardSettings>(DEFAULT_BOARD_SETTINGS);
  const [activeMapPixelSize, setActiveMapPixelSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isRoomSettingsOpen, setIsRoomSettingsOpen] = useState(false);
  const [mapCalibrationPointA, setMapCalibrationPointA] = useState<{ x: number; y: number } | null>(
    null
  );
  const [editingToken, setEditingToken] = useState<{
    tokenId: string;
    draft: TokenDraft;
    imageFile: File | null;
  } | null>(null);
  const [tokenEditRequest, setTokenEditRequest] = useState<{
    tokenId: string;
    requestId: string;
  } | null>(null);
  const [autoExportDirectoryName, setAutoExportDirectoryName] = useState<string | null>(null);
  const [isSavingTokenEdit, setIsSavingTokenEdit] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const wsDisconnectedErrorShownRef = useRef(false);
  const importSessionInputRef = useRef<HTMLInputElement | null>(null);
  const autoExportDirectoryHandleRef = useRef<unknown>(null);
  const moveThrottleRef = useRef(0);
  const chatSendThrottleRef = useRef(0);
  const mapEditFlushTimerRef = useRef<number | null>(null);
  const mapEditPendingOpsRef = useRef<MapEditOperation[]>([]);
  const localSettingsSyncTimerRef = useRef<number | null>(null);
  const localSettingsSyncPendingRef = useRef<LocalSessionSettings | null>(null);
  const localSettingsSyncLastSentAtRef = useRef(0);
  const [mapEditSnapshot, setMapEditSnapshot] = useState<MapEditSnapshot>({
    revision: 0,
    elements: []
  });
  const [mapEditRemoteEvents, setMapEditRemoteEvents] = useState<
    MapEditOpsAppliedMessage['payload'][]
  >([]);
  const [localSnapshot, setLocalSnapshot] = useState<RoomSnapshot | null>(null);
  const localSnapshotRef = useRef<RoomSnapshot | null>(null);
  const localSnapshotSaveTimerRef = useRef<number | null>(null);
  const snapshotChunkBufferRef = useRef<
    Map<
      string,
      {
        total: number;
        chunks: Map<number, string>;
      }
    >
  >(new Map());
  const assetChunkBufferRef = useRef<
    Map<
      string,
      {
        total: number;
        chunks: Map<number, string>;
      }
    >
  >(new Map());
  const snapshotSentUsersRef = useRef<Set<string>>(new Set());
  const [localAssetUrlByHash, setLocalAssetUrlByHash] = useState<Record<string, string>>({});
  const [chatAttachmentTransferByHash, setChatAttachmentTransferByHash] = useState<
    Record<string, ChatAttachmentTransferState>
  >({});
  const chatAttachmentTransferRef = useRef<Record<string, ChatAttachmentTransferState>>({});
  chatAttachmentTransferRef.current = chatAttachmentTransferByHash;
  const pendingFileTransferByIdRef = useRef<
    Map<
      string,
      {
        hash: string;
      }
    >
  >(new Map());
  const fileTransferManagerRef = useRef<FileTransferManager | null>(null);
  const hostConfirmationPendingSinceRef = useRef<
    Partial<Record<PendingHostConfirmationKind, number>>
  >({});
  const [showSlowHostConfirmationHint, setShowSlowHostConfirmationHint] = useState(false);
  const [slowHostConfirmationSeconds, setSlowHostConfirmationSeconds] = useState(0);

  const {
    clientId,
    userId,
    displayName,
    roomId,
    storageMode,
    hostUserId,
    joinSecret,
    wsUrl,
    role,
    settings,
    currentMapAssetId,
    currentMapAsset,
    tokens,
    chatMessages,
    chatComposeKind,
    chatComposeRecipients,
    members,
    membersOnline,
    connectionStatus,
    lastError,
    setClientId,
    setDisplayName,
    setConnectionStatus,
    setLastError,
    clearRoom,
    applyCreateRoomResponse,
    applyJoinRoomResponse,
    applyWelcomeMessage,
    applyWelcomeLocalMessage,
    setCurrentMapState,
    setMembersOnline,
    setTokens,
    setChatMessages,
    appendChatMessage,
    setChatComposeKind,
    setChatComposeRecipients,
    resetChatCompose,
    upsertToken,
    removeToken,
    updateTokenPositionLocal,
    setSettings
  } = useAppStore();

  localSnapshotRef.current = localSnapshot;
  const storageModeRef = useRef<StorageMode | null>(storageMode);
  storageModeRef.current = storageMode;
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;
  const hostUserIdRef = useRef<string | null>(hostUserId);
  hostUserIdRef.current = hostUserId;

  const markHostConfirmationPending = useCallback((kind: PendingHostConfirmationKind): void => {
    if (hostConfirmationPendingSinceRef.current[kind] !== undefined) {
      return;
    }

    hostConfirmationPendingSinceRef.current[kind] = Date.now();
  }, []);

  const clearHostConfirmationPending = useCallback(
    (kinds?: PendingHostConfirmationKind[]): void => {
      if (!kinds || kinds.length === 0) {
        hostConfirmationPendingSinceRef.current = {};
        return;
      }

      const next = { ...hostConfirmationPendingSinceRef.current };
      for (const kind of kinds) {
        delete next[kind];
      }
      hostConfirmationPendingSinceRef.current = next;
    },
    []
  );

  useEffect(() => {
    const resolvedClientId = getOrCreateClientId();
    setClientId(resolvedClientId);
  }, [setClientId]);

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const darkEnabled = savedTheme ? savedTheme === 'dark' : prefersDark;

    setIsDarkMode(darkEnabled);
    document.documentElement.classList.toggle('dark', darkEnabled);
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const inviteFromUrl = searchParams.get('join');
    const displayNameFromUrl = searchParams.get('name');
    const roleFromUrl = searchParams.get('role');

    if (inviteFromUrl) {
      setJoinSecretInput(inviteFromUrl.toUpperCase());
    }

    if (displayNameFromUrl && displayNameFromUrl.trim().length > 0) {
      setJoinDisplayName(displayNameFromUrl.trim().slice(0, 60));
    }

    if (roleFromUrl === 'PLAYER' || roleFromUrl === 'SPECTATOR') {
      setJoinRoleDesired(roleFromUrl);
    }
  }, []);

  useEffect(() => {
    if (!roomId) {
      setBoardSettings(DEFAULT_BOARD_SETTINGS);
      setIsRoomSettingsOpen(false);
      setMapCalibrationPointA(null);
      return;
    }

    const storageKey = `${BOARD_SETTINGS_STORAGE_PREFIX}:${roomId}`;
    const raw = localStorage.getItem(storageKey);

    if (!raw) {
      setBoardSettings(DEFAULT_BOARD_SETTINGS);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<BoardSettings>;
      setBoardSettings(
        sanitizeBoardSettings({
          ...parsed,
          mapCalibrationMode: false
        })
      );
    } catch {
      setBoardSettings(DEFAULT_BOARD_SETTINGS);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    const storageKey = `${BOARD_SETTINGS_STORAGE_PREFIX}:${roomId}`;
    localStorage.setItem(storageKey, JSON.stringify(boardSettings));
  }, [boardSettings, roomId]);

  useEffect(() => {
    if (!roomId) {
      autoExportDirectoryHandleRef.current = null;
      setAutoExportDirectoryName(null);
      return;
    }

    const storageKey = `${AUTO_EXPORT_DIRECTORY_NAME_STORAGE_PREFIX}:${roomId}`;
    const savedName = localStorage.getItem(storageKey);
    setAutoExportDirectoryName(savedName);
  }, [roomId]);

  const inviteLink = useMemo(() => {
    if (!joinSecret) {
      return null;
    }

    return `${window.location.origin}/?join=${joinSecret}`;
  }, [joinSecret]);

  const upsertMapAsset = useCallback((asset: RoomAsset) => {
    setMapAssets((previousAssets) => {
      const existingIndex = previousAssets.findIndex(
        (existingAsset) => existingAsset.id === asset.id
      );

      if (existingIndex < 0) {
        return [asset, ...previousAssets];
      }

      const nextAssets = [...previousAssets];
      nextAssets[existingIndex] = asset;
      return nextAssets;
    });
  }, []);

  const upsertLocalAssetUrl = useCallback((hash: string, url: string) => {
    setLocalAssetUrlByHash((previous) => {
      if (previous[hash] === url) {
        return previous;
      }

      return {
        ...previous,
        [hash]: url
      };
    });
  }, []);

  const ensureLocalAssetUrl = useCallback(
    async (hash: string): Promise<string | null> => {
      const existing = localAssetUrlByHash[hash];
      if (existing) {
        return existing;
      }

      const url = await localAssetUrlResolver.resolve(hash);
      if (!url) {
        return null;
      }

      upsertLocalAssetUrl(hash, url);
      return url;
    },
    [localAssetUrlByHash, upsertLocalAssetUrl]
  );

  const setChatAttachmentTransferState = useCallback(
    (hash: string, next: ChatAttachmentTransferState) => {
      setChatAttachmentTransferByHash((previous) => {
        const current = previous[hash];
        if (
          current &&
          current.status === next.status &&
          current.progress === next.progress &&
          current.error === next.error
        ) {
          return previous;
        }

        return {
          ...previous,
          [hash]: next
        };
      });
    },
    []
  );

  const registerLocalAsset = useCallback(
    async (args: {
      blob: Blob;
      kind: LocalAssetKind;
      label?: string;
    }): Promise<{ hash: string; assetId: string; url: string | null }> => {
      if (!roomId) {
        throw new Error('No active room');
      }

      const hash = await sha256Hex(args.blob);
      const putArgs: Parameters<typeof localSessionRepository.putAsset>[0] = {
        hash,
        blob: args.blob,
        mime: args.blob.type || 'application/octet-stream',
        size: args.blob.size,
        kind: args.kind,
        roomId
      };

      if (args.label !== undefined) {
        putArgs.label = args.label;
      }

      await localSessionRepository.putAsset(putArgs);

      const url = await ensureLocalAssetUrl(hash);
      return {
        hash,
        assetId: toLocalAssetId(hash),
        url
      };
    },
    [ensureLocalAssetUrl, roomId]
  );

  const upsertAssetIntoLocalManifest = useCallback(
    (args: { hash: string; mime: string; size: number; kind: LocalAssetKind }) => {
      const previous = localSnapshotRef.current;
      if (!previous) {
        return;
      }

      const existing = previous.assetsManifest.byHash[args.hash];
      const alreadyKnown =
        existing &&
        existing.mime === args.mime &&
        existing.size === args.size &&
        existing.kind === args.kind &&
        previous.assetsManifest.hashes.includes(args.hash);

      if (alreadyKnown) {
        return;
      }

      const hashes = previous.assetsManifest.hashes.includes(args.hash)
        ? previous.assetsManifest.hashes
        : [...previous.assetsManifest.hashes, args.hash];

      const nextSnapshot: RoomSnapshot = {
        ...previous,
        generatedAt: new Date().toISOString(),
        assetsManifest: {
          hashes,
          byHash: {
            ...previous.assetsManifest.byHash,
            [args.hash]: {
              mime: args.mime,
              size: args.size,
              kind: args.kind
            }
          }
        }
      };

      localSnapshotRef.current = nextSnapshot;
      setLocalSnapshot(nextSnapshot);
    },
    []
  );

  const refreshMapAssets = useCallback(async () => {
    if (!roomId || !clientId) {
      setMapAssets([]);
      return;
    }

    try {
      if (storageMode === 'LOCAL') {
        const localRefs = await localSessionRepository.listRoomAssets(roomId, 'MAP');
        const localAssets: RoomAsset[] = [];

        for (const entry of localRefs) {
          const meta = await localSessionRepository.getAssetMeta(entry.hash);
          if (!meta) {
            continue;
          }

          localAssets.push({
            id: toLocalAssetId(entry.hash),
            roomId,
            ownerUserId: hostUserId,
            type: 'MAP',
            mime: meta.mime,
            size: meta.size,
            originalName: entry.label || meta.label || entry.hash.slice(0, 12),
            storageKey: entry.hash,
            createdAt: entry.createdAt
          });
        }

        setMapAssets(
          localAssets.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        );
        return;
      }

      const assets = await listRoomAssets({
        roomId,
        clientId,
        type: 'MAP'
      });

      setMapAssets(assets);
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Could not load map assets');
    }
  }, [clientId, hostUserId, roomId, setLastError, storageMode]);

  const currentMapUrl = useMemo(() => {
    if (storageMode === 'LOCAL') {
      const localRef = localSnapshot?.currentMapRef;
      if (!localRef || localRef.kind !== 'LOCAL_ASSET') {
        return null;
      }

      return localAssetUrlByHash[localRef.hash] ?? null;
    }

    if (!currentMapAssetId || !clientId) {
      return null;
    }

    return buildAssetUrl(currentMapAssetId, clientId);
  }, [clientId, currentMapAssetId, localAssetUrlByHash, localSnapshot?.currentMapRef, storageMode]);

  useEffect(() => {
    if (!currentMapUrl) {
      setActiveMapPixelSize(null);
      return;
    }

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (cancelled) {
        return;
      }

      const nextWidth = Math.max(1, image.naturalWidth || image.width || 1);
      const nextHeight = Math.max(1, image.naturalHeight || image.height || 1);
      setActiveMapPixelSize({
        width: nextWidth,
        height: nextHeight
      });
    };

    image.onerror = () => {
      if (!cancelled) {
        setActiveMapPixelSize(null);
      }
    };

    image.src = currentMapUrl;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [currentMapUrl]);

  const mapCoordinateFrame = useMemo<MapCoordinateFrame | null>(() => {
    if (!activeMapPixelSize) {
      return null;
    }

    return {
      widthPx: activeMapPixelSize.width,
      heightPx: activeMapPixelSize.height,
      mapOffsetX: boardSettings.mapOffsetX,
      mapOffsetY: boardSettings.mapOffsetY,
      mapScale: boardSettings.mapScale,
      mapRotationDeg: boardSettings.mapRotationDeg
    };
  }, [
    activeMapPixelSize,
    boardSettings.mapOffsetX,
    boardSettings.mapOffsetY,
    boardSettings.mapRotationDeg,
    boardSettings.mapScale
  ]);

  const sendClientMessage = useCallback(
    (message: ClientToServerMessage): boolean => {
      const socket = wsRef.current;

      if (!socket || socket.readyState !== WebSocket.OPEN) {
        if (!wsDisconnectedErrorShownRef.current) {
          wsDisconnectedErrorShownRef.current = true;
          setLastError('WebSocket is not connected');
        }
        return false;
      }

      wsDisconnectedErrorShownRef.current = false;
      socket.send(JSON.stringify(message));
      return true;
    },
    [setLastError]
  );

  const requestMissingLocalAssets = useCallback(
    async (hashes: string[]): Promise<void> => {
      if (hashes.length === 0) {
        return;
      }

      const uniqueHashes = [...new Set(hashes)];
      const missing = await localSessionRepository.hasAssets(uniqueHashes);
      if (missing.length === 0) {
        return;
      }

      sendClientMessage({
        type: 'ASSET_REQUEST',
        payload: {
          toHost: true,
          hashes: missing
        }
      });
    },
    [sendClientMessage]
  );

  const sendRelayToHost = useCallback(
    (payload: HostRequest): boolean => {
      return sendClientMessage({
        type: 'RELAY_TO_HOST',
        payload
      });
    },
    [sendClientMessage]
  );

  const sendRelayToHostWithPending = useCallback(
    (payload: HostRequest, pendingKind?: PendingHostConfirmationKind): boolean => {
      const sent = sendRelayToHost(payload);
      if (sent && pendingKind) {
        markHostConfirmationPending(pendingKind);
      }

      return sent;
    },
    [markHostConfirmationPending, sendRelayToHost]
  );

  const sendRelayBroadcast = useCallback(
    (payload: HostEvent): boolean => {
      return sendClientMessage({
        type: 'RELAY_BROADCAST',
        payload
      });
    },
    [sendClientMessage]
  );

  const sendRelayToUser = useCallback(
    (targetUserId: string, payload: HostDirect): boolean => {
      return sendClientMessage({
        type: 'RELAY_TO_USER',
        payload: {
          userId: targetUserId,
          payload
        }
      });
    },
    [sendClientMessage]
  );

  const sendFileSignal = useCallback(
    (signal: OutboundFileSignal): void => {
      if (storageMode !== 'LOCAL' || !userId || !hostUserId) {
        return;
      }

      if (userId === hostUserId) {
        sendRelayToUser(signal.toUserId, {
          type: 'FILE_SIGNAL',
          fromUserId: userId,
          transferId: signal.transferId,
          hash: signal.hash,
          kind: signal.kind,
          data: signal.data
        });
        return;
      }

      sendRelayToHost({
        type: 'FILE_SIGNAL',
        toUserId: signal.toUserId,
        transferId: signal.transferId,
        hash: signal.hash,
        kind: signal.kind,
        data: signal.data
      });
    },
    [hostUserId, sendRelayToHost, sendRelayToUser, storageMode, userId]
  );

  const startFileTransferSend = useCallback(
    async (args: {
      transferId: string;
      remoteUserId: string;
      hash: string;
      name: string;
      mime: string;
      size: number;
    }): Promise<void> => {
      const manager = fileTransferManagerRef.current;
      if (!manager) {
        throw new Error('WebRTC file transfer is not available in this browser');
      }

      const blob = await localSessionRepository.getAsset(args.hash);
      if (!blob) {
        throw new Error('Attachment is not available locally');
      }

      await manager.startSending({
        transferId: args.transferId,
        hash: args.hash,
        remoteUserId: args.remoteUserId,
        blob,
        name: args.name,
        mime: args.mime,
        size: args.size
      });
    },
    []
  );

  const prepareChatAttachment = useCallback(
    async (file: File): Promise<ChatAttachment> => {
      if (storageMode !== 'LOCAL' || !roomId) {
        throw new Error('Attachments are currently only available in LOCAL mode');
      }

      const mime = file.type || 'application/octet-stream';
      const hash = await sha256Hex(file);
      await localSessionRepository.putAsset({
        hash,
        blob: file,
        mime,
        size: file.size,
        kind: 'CHAT_FILE',
        roomId,
        label: file.name
      });
      await ensureLocalAssetUrl(hash);
      setChatAttachmentTransferState(hash, {
        status: 'available',
        progress: 100
      });

      return {
        hash,
        name: file.name,
        mime,
        size: file.size,
        seedUserId: userId ?? undefined
      };
    },
    [ensureLocalAssetUrl, roomId, setChatAttachmentTransferState, storageMode, userId]
  );

  const openChatAttachment = useCallback(
    async (attachment: ChatAttachment, options?: { download?: boolean }): Promise<void> => {
      const url = await ensureLocalAssetUrl(attachment.hash);
      if (!url) {
        setLastError('Attachment is not available locally. Request download first.');
        return;
      }

      setChatAttachmentTransferState(attachment.hash, {
        status: 'available',
        progress: 100
      });

      if (options?.download) {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = attachment.name;
        anchor.rel = 'noopener noreferrer';
        anchor.click();
        return;
      }

      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [ensureLocalAssetUrl, setChatAttachmentTransferState, setLastError]
  );

  const requestChatAttachmentDownload = useCallback(
    async (attachment: ChatAttachment): Promise<void> => {
      const existing = await localSessionRepository.getAsset(attachment.hash);
      if (existing) {
        await ensureLocalAssetUrl(attachment.hash);
        setChatAttachmentTransferState(attachment.hash, {
          status: 'available',
          progress: 100
        });
        return;
      }

      if (storageMode !== 'LOCAL' || !userId || !hostUserId) {
        setLastError('Attachments can currently only be downloaded in LOCAL mode');
        return;
      }

      const waitingForHostSnapshot =
        storageMode === 'LOCAL' &&
        roomId !== null &&
        role !== null &&
        role !== 'DM' &&
        localSnapshotRef.current === null;
      if (waitingForHostSnapshot) {
        setLastError('Waiting for host snapshot...');
        return;
      }

      const hostOnline = membersOnline.some((memberOnline) => memberOnline.userId === hostUserId);
      const blockedByOfflineHost = userId !== hostUserId && !hostOnline;
      if (blockedByOfflineHost) {
        setLastError('Host (DM) is currently offline');
        return;
      }

      const transferId = createTransferId();
      pendingFileTransferByIdRef.current.set(transferId, {
        hash: attachment.hash
      });
      setChatAttachmentTransferState(attachment.hash, {
        status: 'downloading',
        progress: 0
      });

      const seedUserId =
        attachment.seedUserId && attachment.seedUserId.trim().length > 0
          ? attachment.seedUserId
          : hostUserId;

      if (userId === hostUserId) {
        if (seedUserId === hostUserId) {
          setLastError('Attachment is missing on host');
          setChatAttachmentTransferState(attachment.hash, {
            status: 'failed',
            progress: 0,
            error: 'Attachment is missing on host'
          });
          pendingFileTransferByIdRef.current.delete(transferId);
          return;
        }

        sendRelayToUser(seedUserId, {
          type: 'FILE_REQUEST',
          fromUserId: userId,
          fromName: displayName || userId,
          transferId,
          hash: attachment.hash,
          name: attachment.name,
          mime: attachment.mime,
          size: attachment.size,
          seedUserId
        });
        return;
      }

      const sent = sendRelayToHost({
        type: 'FILE_REQUEST',
        transferId,
        hash: attachment.hash,
        name: attachment.name,
        mime: attachment.mime,
        size: attachment.size,
        seedUserId
      });

      if (!sent) {
        pendingFileTransferByIdRef.current.delete(transferId);
        setChatAttachmentTransferState(attachment.hash, {
          status: 'failed',
          progress: 0,
          error: 'WebSocket is not connected'
        });
      }
    },
    [
      displayName,
      ensureLocalAssetUrl,
      hostUserId,
      membersOnline,
      role,
      roomId,
      sendRelayToHost,
      sendRelayToUser,
      setChatAttachmentTransferState,
      setLastError,
      storageMode,
      userId
    ]
  );

  useEffect(() => {
    if (typeof RTCPeerConnection === 'undefined') {
      return;
    }

    const manager = new FileTransferManager({
      onSignal: (signal) => {
        sendFileSignal(signal);
      },
      onProgress: (progress) => {
        if (progress.direction !== 'receive') {
          return;
        }

        setChatAttachmentTransferState(progress.hash, {
          status: 'downloading',
          progress: progress.percent
        });
      },
      onComplete: (payload) => {
        pendingFileTransferByIdRef.current.delete(payload.transferId);

        void (async () => {
          const putAssetArgs: Parameters<typeof localSessionRepository.putAsset>[0] = {
            hash: payload.hash,
            blob: payload.blob,
            mime: payload.mime,
            size: payload.size,
            kind: 'CHAT_FILE',
            label: payload.name
          };

          if (roomId) {
            putAssetArgs.roomId = roomId;
          }

          await localSessionRepository.putAsset(putAssetArgs);
          await ensureLocalAssetUrl(payload.hash);
          setChatAttachmentTransferState(payload.hash, {
            status: 'available',
            progress: 100
          });
        })();
      },
      onError: (payload) => {
        pendingFileTransferByIdRef.current.delete(payload.transferId);
        setChatAttachmentTransferState(payload.hash, {
          status: 'failed',
          progress: 0,
          error: payload.message
        });
      }
    });

    fileTransferManagerRef.current = manager;

    return () => {
      manager.dispose();
      fileTransferManagerRef.current = null;
    };
  }, [ensureLocalAssetUrl, roomId, sendFileSignal, setChatAttachmentTransferState]);

  const flushMapEditOperations = useCallback(() => {
    if (mapEditPendingOpsRef.current.length === 0) {
      return;
    }

    if (mapEditFlushTimerRef.current !== null) {
      window.clearTimeout(mapEditFlushTimerRef.current);
      mapEditFlushTimerRef.current = null;
    }

    const operations = mapEditPendingOpsRef.current;
    mapEditPendingOpsRef.current = [];

    if (storageMode === 'LOCAL') {
      if (!userId || !hostUserId) {
        return;
      }

      if (userId === hostUserId) {
        const currentSnapshot = localSnapshotRef.current;
        if (!currentSnapshot) {
          return;
        }

        const fromRev = currentSnapshot.mapEdit.rev;
        const toRev = fromRev + 1;
        const event: HostEvent = {
          type: 'MAPEDIT_OPS_APPLIED',
          fromRev,
          toRev,
          ops: operations
        };

        const nextSnapshot = applyHostEventToSnapshot(currentSnapshot, event);
        setLocalSnapshot(nextSnapshot);
        void sendRelayBroadcast(event);
        return;
      }

      const baseRev = localSnapshotRef.current?.mapEdit.rev ?? 0;
      const sentToHost = sendRelayToHostWithPending(
        {
          type: 'REQUEST_MAPEDIT_OPS',
          baseRev,
          ops: operations
        },
        'MAP_EDIT'
      );

      if (!sentToHost) {
        mapEditPendingOpsRef.current = [...operations, ...mapEditPendingOpsRef.current];
      }
      return;
    }

    const sent = sendClientMessage({
      type: 'MAP_EDIT_OPS',
      payload: {
        operations
      }
    });

    if (!sent) {
      mapEditPendingOpsRef.current = [...operations, ...mapEditPendingOpsRef.current];
    }
  }, [
    hostUserId,
    sendClientMessage,
    sendRelayBroadcast,
    sendRelayToHostWithPending,
    storageMode,
    userId
  ]);

  const queueMapEditOperations = useCallback(
    (operations: MapEditOperation[], options?: { immediate?: boolean }) => {
      if (operations.length === 0) {
        return;
      }

      mapEditPendingOpsRef.current.push(...operations);

      const shouldFlushNow = options?.immediate || mapEditPendingOpsRef.current.length >= 16;
      if (shouldFlushNow) {
        flushMapEditOperations();
        return;
      }

      if (mapEditFlushTimerRef.current !== null) {
        return;
      }

      mapEditFlushTimerRef.current = window.setTimeout(() => {
        mapEditFlushTimerRef.current = null;
        flushMapEditOperations();
      }, 80);
    },
    [flushMapEditOperations]
  );

  const applySnapshotToUi = useCallback(
    async (snapshot: RoomSnapshot) => {
      setLocalSnapshot(snapshot);
      setSettings({
        roomId: snapshot.roomId,
        tokenMovePolicy: snapshot.settings.tokenMovePolicy,
        mapEditPolicy: snapshot.settings.mapEditPolicy,
        mapEditUserOverrides: snapshot.settings.mapEditUserOverrides
      });
      setTokens(snapshot.tokens);
      setChatMessages(snapshot.chat.messages);
      const mapEditSnapshotValue = toMapEditSnapshot(snapshot);
      const hydratedMapEditElements = await Promise.all(
        mapEditSnapshotValue.elements.map(async (element) => {
          if (element.type !== 'IMAGE') {
            return element;
          }

          if (element.sourceUrl) {
            return element;
          }

          if (element.imageRef.kind === 'LOCAL_ASSET') {
            const resolved = await ensureLocalAssetUrl(element.imageRef.hash);
            if (!resolved) {
              return element;
            }

            return {
              ...element,
              sourceUrl: resolved
            };
          }

          if (!clientId) {
            return element;
          }

          if (
            element.imageRef.assetId.startsWith('builtin:') ||
            element.imageRef.assetId.startsWith('inline:')
          ) {
            return element;
          }

          return {
            ...element,
            sourceUrl: buildAssetUrl(element.imageRef.assetId, clientId)
          };
        })
      );

      setMapEditSnapshot({
        revision: mapEditSnapshotValue.revision,
        elements: hydratedMapEditElements
      });
      setMapEditRemoteEvents([]);
      setBoardSettings((previous) =>
        sanitizeBoardSettings({
          ...toBoardSettingsFromLocal(snapshot.settings, previous),
          mapEditMode: previous.mapEditMode,
          mapCalibrationMode: false
        })
      );

      if (snapshot.currentMapRef?.kind === 'LOCAL_ASSET') {
        const mapUrl = await ensureLocalAssetUrl(snapshot.currentMapRef.hash);
        if (mapUrl) {
          setCurrentMapState(toLocalAssetId(snapshot.currentMapRef.hash), {
            id: toLocalAssetId(snapshot.currentMapRef.hash),
            roomId: snapshot.roomId,
            ownerUserId: snapshot.hostUserId,
            type: 'MAP',
            mime: snapshot.assetsManifest.byHash[snapshot.currentMapRef.hash]?.mime ?? 'image/png',
            size: snapshot.assetsManifest.byHash[snapshot.currentMapRef.hash]?.size ?? 0,
            originalName:
              snapshot.assetsManifest.byHash[snapshot.currentMapRef.hash]?.kind === 'MAP'
                ? 'Local Map'
                : 'Local Asset',
            storageKey: snapshot.currentMapRef.hash,
            createdAt: snapshot.generatedAt
          });
        }
      } else {
        setCurrentMapState(null, null);
      }

      await Promise.all(
        collectLocalAssetHashesFromSnapshot(snapshot).map((hash) => ensureLocalAssetUrl(hash))
      );
    },
    [clientId, ensureLocalAssetUrl, setChatMessages, setCurrentMapState, setSettings, setTokens]
  );

  const sendSnapshotToUser = useCallback(
    (targetUserId: string, snapshot: RoomSnapshot) => {
      const filteredSnapshot = filterSnapshotForUser(snapshot, targetUserId);
      const transferId = `${filteredSnapshot.roomId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const chunks = encodeRoomSnapshotChunks(filteredSnapshot, transferId);
      for (const chunk of chunks) {
        sendRelayToUser(targetUserId, chunk);
      }
    },
    [sendRelayToUser]
  );

  const resolveMemberRole = useCallback(
    (targetUserId: string): Role => {
      if (targetUserId === hostUserId) {
        return 'DM';
      }

      const memberRole = members.find((memberItem) => memberItem.userId === targetUserId)?.role;
      if (memberRole) {
        return memberRole;
      }

      const onlineRole = membersOnline.find(
        (memberItem) => memberItem.userId === targetUserId
      )?.role;
      return onlineRole ?? 'SPECTATOR';
    },
    [hostUserId, members, membersOnline]
  );

  const resolveMemberDisplayName = useCallback(
    (targetUserId: string): string => {
      const knownMember = members.find((memberItem) => memberItem.userId === targetUserId);
      if (knownMember) {
        return knownMember.displayName;
      }

      const knownOnline = membersOnline.find((memberItem) => memberItem.userId === targetUserId);
      if (knownOnline) {
        return knownOnline.displayName;
      }

      return targetUserId;
    },
    [members, membersOnline]
  );

  const applyLocalHostEvent = useCallback(
    async (event: HostEvent, options?: { broadcast?: boolean }) => {
      const snapshot = localSnapshotRef.current;
      if (!snapshot) {
        return;
      }

      const nextSnapshot = applyHostEventToSnapshot(snapshot, event);
      await applySnapshotToUi(nextSnapshot);

      if (options?.broadcast !== false) {
        sendRelayBroadcast(event);
      }
    },
    [applySnapshotToUi, sendRelayBroadcast]
  );

  const flushLocalSettingsSync = useCallback(() => {
    if (localSettingsSyncTimerRef.current !== null) {
      window.clearTimeout(localSettingsSyncTimerRef.current);
      localSettingsSyncTimerRef.current = null;
    }

    const pendingSettings = localSettingsSyncPendingRef.current;
    if (!pendingSettings) {
      return;
    }

    localSettingsSyncPendingRef.current = null;
    localSettingsSyncLastSentAtRef.current = Date.now();
    void applyLocalHostEvent({
      type: 'ROOM_SETTINGS_UPDATED',
      settings: pendingSettings
    });
  }, [applyLocalHostEvent]);

  const scheduleLocalSettingsSync = useCallback(
    (nextSettings: LocalSessionSettings) => {
      localSettingsSyncPendingRef.current = nextSettings;
      const elapsedMs = Date.now() - localSettingsSyncLastSentAtRef.current;

      if (
        elapsedMs >= LOCAL_SETTINGS_SYNC_INTERVAL_MS &&
        localSettingsSyncTimerRef.current === null
      ) {
        flushLocalSettingsSync();
        return;
      }

      if (localSettingsSyncTimerRef.current !== null) {
        return;
      }

      const waitMs = Math.max(20, LOCAL_SETTINGS_SYNC_INTERVAL_MS - elapsedMs);
      localSettingsSyncTimerRef.current = window.setTimeout(() => {
        localSettingsSyncTimerRef.current = null;
        flushLocalSettingsSync();
      }, waitMs);
    },
    [flushLocalSettingsSync]
  );

  const sendLocalDenied = useCallback(
    (targetUserId: string, code: string, message: string) => {
      sendRelayToUser(targetUserId, {
        type: 'DENIED',
        code,
        message
      });
    },
    [sendRelayToUser]
  );

  const encodeBlobToBase64Chunks = useCallback(async (blob: Blob): Promise<string[]> => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (const value of bytes) {
      binary += String.fromCharCode(value);
    }

    const base64 = btoa(binary);
    if (base64.length <= LOCAL_ASSET_CHUNK_SIZE) {
      return [base64];
    }

    const chunks: string[] = [];
    for (let index = 0; index < base64.length; index += LOCAL_ASSET_CHUNK_SIZE) {
      chunks.push(base64.slice(index, index + LOCAL_ASSET_CHUNK_SIZE));
    }
    return chunks;
  }, []);

  const streamAssetsToUser = useCallback(
    async (targetUserId: string, hashes: string[]) => {
      const uniqueHashes = [...new Set(hashes)];
      for (const hash of uniqueHashes) {
        const blob = await localSessionRepository.getAsset(hash);
        if (!blob) {
          continue;
        }

        const chunks = await encodeBlobToBase64Chunks(blob);
        const total = chunks.length;
        for (const [seq, bytesBase64] of chunks.entries()) {
          sendClientMessage({
            type: 'ASSET_CHUNK',
            payload: {
              toUserId: targetUserId,
              hash,
              seq,
              total,
              bytesBase64
            }
          });
        }
      }
    },
    [encodeBlobToBase64Chunks, sendClientMessage]
  );

  const handleRelayFromUser = useCallback(
    async (message: RelayFromUserMessage['payload']) => {
      if (!userId || !hostUserId || userId !== hostUserId) {
        return;
      }

      const snapshot = localSnapshotRef.current;
      if (!snapshot) {
        return;
      }

      if (message.payload.type === 'ASSET_REQUEST') {
        await streamAssetsToUser(message.fromUserId, message.payload.hashes);
        return;
      }

      const requesterRole = resolveMemberRole(message.fromUserId);
      const request = message.payload;

      if (request.type === 'REQUEST_TOKEN_CREATE') {
        const allowed =
          requesterRole === 'DM' ||
          (requesterRole === 'PLAYER' && snapshot.settings.tokenMovePolicy !== 'DM_ONLY');

        if (!allowed) {
          sendLocalDenied(message.fromUserId, 'FORBIDDEN', 'You are not allowed to create tokens');
          return;
        }

        const tokenDraft = request.tokenDraft ?? {};
        const imageRef = tokenDraft.imageRef ?? null;
        if (imageRef?.kind === 'LOCAL_ASSET') {
          const hasAsset = await localSessionRepository.getAsset(imageRef.hash);
          if (!hasAsset) {
            sendLocalDenied(
              message.fromUserId,
              'ASSET_MISSING',
              'Token image asset is missing on host'
            );
            return;
          }
        }

        const kind = tokenDraft.kind ?? 'NEUTRAL';
        const now = new Date().toISOString();
        const token: VttToken = {
          id: createLocalEntityId('token'),
          roomId: snapshot.roomId,
          name: tokenDraft.name?.trim() || 'Token',
          x: request.x,
          y: request.y,
          size: tokenDraft.size ?? 1,
          assetId:
            imageRef?.kind === 'LOCAL_ASSET'
              ? toLocalAssetId(imageRef.hash)
              : imageRef?.kind === 'CLOUD_ASSET'
                ? imageRef.assetId
                : null,
          imageRef,
          kind,
          color: tokenDraft.color ?? defaultColorForKind(kind),
          elevation: tokenDraft.elevation ?? 0,
          imageOffsetX: tokenDraft.imageOffsetX ?? 0,
          imageOffsetY: tokenDraft.imageOffsetY ?? 0,
          imageScale: tokenDraft.imageScale ?? 1,
          imageRotationDeg: tokenDraft.imageRotationDeg ?? 0,
          controlledBy:
            snapshot.settings.tokenMovePolicy === 'OWNED_ONLY' && requesterRole === 'PLAYER'
              ? {
                  mode: 'USERS',
                  userIds: [message.fromUserId]
                }
              : {
                  mode: 'ALL'
                },
          createdAt: now,
          updatedAt: now
        };

        await applyLocalHostEvent({
          type: 'TOKEN_CREATED',
          token
        });
        return;
      }

      if (request.type === 'REQUEST_TOKEN_MOVE') {
        const token = snapshot.tokens.find((entry) => entry.id === request.tokenId);
        if (!token) {
          sendLocalDenied(message.fromUserId, 'TOKEN_NOT_FOUND', 'Token does not exist');
          return;
        }

        if (
          !canLocalMemberEditToken({
            requesterRole,
            requesterUserId: message.fromUserId,
            tokenEditPolicy: snapshot.settings.tokenEditPolicy,
            token
          })
        ) {
          sendLocalDenied(
            message.fromUserId,
            'FORBIDDEN',
            'You are not allowed to move this token'
          );
          return;
        }

        await applyLocalHostEvent({
          type: 'TOKEN_MOVED',
          tokenId: request.tokenId,
          x: request.x,
          y: request.y
        });
        return;
      }

      if (request.type === 'REQUEST_TOKEN_UPDATE') {
        const token = snapshot.tokens.find((entry) => entry.id === request.tokenId);
        if (!token) {
          sendLocalDenied(message.fromUserId, 'TOKEN_NOT_FOUND', 'Token does not exist');
          return;
        }

        if (
          !canLocalMemberMoveToken({
            requesterRole,
            requesterUserId: message.fromUserId,
            tokenMovePolicy: snapshot.settings.tokenMovePolicy,
            token
          })
        ) {
          sendLocalDenied(
            message.fromUserId,
            'FORBIDDEN',
            'You are not allowed to update this token'
          );
          return;
        }

        const patch = request.patch;
        const hasImageRefPatch = Object.prototype.hasOwnProperty.call(patch, 'imageRef');
        let nextImageRef = token.imageRef ?? null;
        let nextAssetId = token.assetId;

        if (hasImageRefPatch) {
          nextImageRef = patch.imageRef ?? null;
          if (nextImageRef?.kind === 'LOCAL_ASSET') {
            const hasAsset = await localSessionRepository.getAsset(nextImageRef.hash);
            if (!hasAsset) {
              sendLocalDenied(
                message.fromUserId,
                'ASSET_MISSING',
                'Token image asset is missing on host'
              );
              return;
            }
          }

          nextAssetId =
            nextImageRef?.kind === 'LOCAL_ASSET'
              ? toLocalAssetId(nextImageRef.hash)
              : nextImageRef?.kind === 'CLOUD_ASSET'
                ? nextImageRef.assetId
                : null;
        }

        const updatedToken: VttToken = {
          ...token,
          name: patch.name?.trim() || token.name,
          imageRef: nextImageRef,
          assetId: nextAssetId,
          kind: patch.kind ?? token.kind,
          color: patch.color ?? token.color,
          elevation: patch.elevation ?? token.elevation,
          imageOffsetX: patch.imageOffsetX ?? token.imageOffsetX,
          imageOffsetY: patch.imageOffsetY ?? token.imageOffsetY,
          imageScale: patch.imageScale ?? token.imageScale,
          imageRotationDeg: patch.imageRotationDeg ?? token.imageRotationDeg,
          updatedAt: new Date().toISOString()
        };

        await applyLocalHostEvent({
          type: 'TOKEN_UPDATED',
          token: updatedToken
        });
        return;
      }

      if (request.type === 'REQUEST_TOKEN_DELETE') {
        const token = snapshot.tokens.find((entry) => entry.id === request.tokenId);
        if (!token) {
          sendLocalDenied(message.fromUserId, 'TOKEN_NOT_FOUND', 'Token does not exist');
          return;
        }

        if (
          !canLocalMemberMoveToken({
            requesterRole,
            requesterUserId: message.fromUserId,
            tokenMovePolicy: snapshot.settings.tokenMovePolicy,
            token
          })
        ) {
          sendLocalDenied(
            message.fromUserId,
            'FORBIDDEN',
            'You are not allowed to delete this token'
          );
          return;
        }

        await applyLocalHostEvent({
          type: 'TOKEN_DELETED',
          tokenId: request.tokenId
        });
        return;
      }

      if (request.type === 'REQUEST_MAP_SET_ACTIVE') {
        if (requesterRole !== 'DM') {
          sendLocalDenied(message.fromUserId, 'FORBIDDEN', 'Only DM can set active map');
          return;
        }

        if (request.mapRef?.kind === 'LOCAL_ASSET') {
          const hasAsset = await localSessionRepository.getAsset(request.mapRef.hash);
          if (!hasAsset) {
            sendLocalDenied(message.fromUserId, 'ASSET_MISSING', 'Map asset is missing on host');
            return;
          }
        }

        await applyLocalHostEvent({
          type: 'MAP_ACTIVE_SET',
          mapRef: request.mapRef
        });
        return;
      }

      if (request.type === 'REQUEST_ROOM_SETTINGS_UPDATE') {
        if (requesterRole !== 'DM') {
          sendLocalDenied(message.fromUserId, 'FORBIDDEN', 'Only DM can update room settings');
          return;
        }

        const nextSettings = LocalSessionSettingsSchema.parse({
          ...snapshot.settings,
          ...request.patch,
          mapEditUserOverrides:
            request.patch.mapEditUserOverrides ?? snapshot.settings.mapEditUserOverrides
        });

        await applyLocalHostEvent({
          type: 'ROOM_SETTINGS_UPDATED',
          settings: nextSettings
        });
        return;
      }

      if (request.type === 'REQUEST_CHAT_SEND') {
        if (requesterRole !== 'DM' && requesterRole !== 'PLAYER') {
          sendLocalDenied(
            message.fromUserId,
            'FORBIDDEN',
            'Only DM and players can send chat messages'
          );
          return;
        }

        const knownUserIds = new Set<string>([hostUserId, message.fromUserId]);
        for (const memberItem of members) {
          knownUserIds.add(memberItem.userId);
        }
        for (const memberOnline of membersOnline) {
          knownUserIds.add(memberOnline.userId);
        }

        const chatResult = processChatSendRequest({
          snapshot,
          request,
          fromUserId: message.fromUserId,
          fromName: resolveMemberDisplayName(message.fromUserId),
          fromRole: requesterRole,
          knownUserIds: [...knownUserIds]
        });

        if (!chatResult.ok) {
          sendLocalDenied(message.fromUserId, chatResult.code, chatResult.message);
          return;
        }

        await applySnapshotToUi(chatResult.nextSnapshot);

        if (chatResult.hostEvent.type === 'CHAT_MESSAGE_PUBLIC') {
          sendRelayBroadcast(chatResult.hostEvent);
          return;
        }

        if (chatResult.hostEvent.type === 'CHAT_MESSAGE_WHISPER') {
          const deliveredUsers = new Set<string>();

          for (const direct of chatResult.directMessages) {
            if (deliveredUsers.has(direct.userId)) {
              continue;
            }

            deliveredUsers.add(direct.userId);
            sendRelayToUser(direct.userId, direct.payload);
          }

          return;
        }

        return;
      }

      if (request.type === 'FILE_REQUEST') {
        const knownUserIds = new Set<string>([hostUserId]);
        for (const memberItem of members) {
          knownUserIds.add(memberItem.userId);
        }
        for (const memberOnline of membersOnline) {
          knownUserIds.add(memberOnline.userId);
        }

        const resolvedSeedUserId =
          request.seedUserId && request.seedUserId.trim().length > 0
            ? request.seedUserId
            : hostUserId;
        if (!knownUserIds.has(resolvedSeedUserId)) {
          sendLocalDenied(
            message.fromUserId,
            'INVALID_RECIPIENTS',
            'Attachment source user is not in this room'
          );
          return;
        }

        if (resolvedSeedUserId === hostUserId) {
          try {
            await startFileTransferSend({
              transferId: request.transferId,
              remoteUserId: message.fromUserId,
              hash: request.hash,
              name: request.name,
              mime: request.mime,
              size: request.size
            });
          } catch (error) {
            sendLocalDenied(
              message.fromUserId,
              'ASSET_MISSING',
              error instanceof Error ? error.message : 'Attachment is not available on host'
            );
          }
          return;
        }

        sendRelayToUser(resolvedSeedUserId, {
          type: 'FILE_REQUEST',
          fromUserId: message.fromUserId,
          fromName: resolveMemberDisplayName(message.fromUserId),
          transferId: request.transferId,
          hash: request.hash,
          name: request.name,
          mime: request.mime,
          size: request.size,
          seedUserId: resolvedSeedUserId
        });
        return;
      }

      if (request.type === 'FILE_SIGNAL') {
        sendRelayToUser(request.toUserId, {
          type: 'FILE_SIGNAL',
          fromUserId: message.fromUserId,
          transferId: request.transferId,
          hash: request.hash,
          kind: request.kind,
          data: request.data
        });
        return;
      }

      if (request.type === 'FILE_CANCEL') {
        sendRelayToUser(request.toUserId, {
          type: 'FILE_CANCEL',
          fromUserId: message.fromUserId,
          transferId: request.transferId,
          hash: request.hash,
          reason: request.reason
        });
        return;
      }

      if (request.type === 'REQUEST_MAPEDIT_OPS') {
        const allowed = resolveMapEditPolicyAccess({
          memberRole: requesterRole,
          memberUserId: message.fromUserId,
          mapEditPolicy: snapshot.settings.mapEditPolicy,
          mapEditUserOverrides: snapshot.settings.mapEditUserOverrides
        });

        if (!allowed) {
          sendLocalDenied(message.fromUserId, 'FORBIDDEN', 'You are not allowed to edit map');
          return;
        }

        if (request.baseRev !== snapshot.mapEdit.rev) {
          sendSnapshotToUser(message.fromUserId, snapshot);
          return;
        }

        await applyLocalHostEvent({
          type: 'MAPEDIT_OPS_APPLIED',
          fromRev: snapshot.mapEdit.rev,
          toRev: snapshot.mapEdit.rev + 1,
          ops: request.ops
        });
      }
    },
    [
      applyLocalHostEvent,
      applySnapshotToUi,
      hostUserId,
      members,
      membersOnline,
      resolveMemberRole,
      resolveMemberDisplayName,
      sendLocalDenied,
      sendRelayBroadcast,
      sendRelayToUser,
      sendSnapshotToUser,
      startFileTransferSend,
      streamAssetsToUser,
      userId
    ]
  );

  const decodeBase64ToBlob = (base64: string, mime: string): Blob => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: mime });
  };

  const handleDirectFromHost = useCallback(
    async (message: DirectFromHostMessage['payload']) => {
      if (message.type === 'HOST_SNAPSHOT' || message.type === 'HOST_RESYNC') {
        clearHostConfirmationPending();
        const normalizedSnapshot = normalizeSnapshotAssetManifest(message.snapshot);
        await applySnapshotToUi(normalizedSnapshot);
        await requestMissingLocalAssets(collectLocalAssetHashesFromSnapshot(normalizedSnapshot));
        return;
      }

      if (message.type === 'HOST_SNAPSHOT_CHUNK') {
        const transfer = snapshotChunkBufferRef.current.get(message.transferId) ?? {
          total: message.total,
          chunks: new Map<number, string>()
        };

        transfer.total = message.total;
        transfer.chunks.set(message.seq, decodeSnapshotChunk(message.bytesBase64));
        snapshotChunkBufferRef.current.set(message.transferId, transfer);

        if (transfer.chunks.size >= transfer.total) {
          const ordered: string[] = [];
          for (let index = 0; index < transfer.total; index += 1) {
            const chunk = transfer.chunks.get(index);
            if (!chunk) {
              return;
            }

            ordered.push(chunk);
          }

          snapshotChunkBufferRef.current.delete(message.transferId);
          let decodedSnapshot: unknown;
          try {
            decodedSnapshot = JSON.parse(ordered.join(''));
          } catch {
            setLastError('Could not decode host snapshot chunk payload');
            return;
          }

          const parsedSnapshot = RoomSnapshotSchema.safeParse(decodedSnapshot);
          if (!parsedSnapshot.success) {
            setLastError('Host snapshot does not match expected schema');
            return;
          }

          const normalizedSnapshot = normalizeSnapshotAssetManifest(parsedSnapshot.data);
          clearHostConfirmationPending();
          await applySnapshotToUi(normalizedSnapshot);
          await requestMissingLocalAssets(collectLocalAssetHashesFromSnapshot(normalizedSnapshot));
        }
        return;
      }

      if (message.type === 'ASSET_OFFER') {
        await requestMissingLocalAssets(message.hashes);
        return;
      }

      if (message.type === 'ASSET_CHUNK') {
        const transfer = assetChunkBufferRef.current.get(message.hash) ?? {
          total: message.total,
          chunks: new Map<number, string>()
        };

        transfer.total = message.total;
        transfer.chunks.set(message.seq, message.bytesBase64);
        assetChunkBufferRef.current.set(message.hash, transfer);

        if (transfer.chunks.size >= transfer.total) {
          const ordered: string[] = [];
          for (let index = 0; index < transfer.total; index += 1) {
            const chunk = transfer.chunks.get(index);
            if (!chunk) {
              return;
            }

            ordered.push(chunk);
          }

          assetChunkBufferRef.current.delete(message.hash);
          const manifestMeta = localSnapshotRef.current?.assetsManifest.byHash[message.hash];
          const mime = manifestMeta?.mime ?? 'application/octet-stream';
          const kind = manifestMeta?.kind ?? 'OTHER';
          const blob = decodeBase64ToBlob(ordered.join(''), mime);
          const size = manifestMeta?.size ?? blob.size;
          const putArgs: Parameters<typeof localSessionRepository.putAsset>[0] = {
            hash: message.hash,
            blob,
            mime,
            size,
            kind
          };

          if (roomId) {
            putArgs.roomId = roomId;
          }

          await localSessionRepository.putAsset(putArgs);
          upsertAssetIntoLocalManifest({
            hash: message.hash,
            mime,
            size,
            kind
          });
          await ensureLocalAssetUrl(message.hash);
          void refreshMapAssets();
        }
        return;
      }

      if (message.type === 'FILE_REQUEST') {
        try {
          await startFileTransferSend({
            transferId: message.transferId,
            remoteUserId: message.fromUserId,
            hash: message.hash,
            name: message.name,
            mime: message.mime,
            size: message.size
          });
        } catch (error) {
          const reason =
            error instanceof Error ? error.message : 'Attachment is not available locally';
          if (userId && hostUserId && userId === hostUserId) {
            sendRelayToUser(message.fromUserId, {
              type: 'FILE_CANCEL',
              fromUserId: userId,
              transferId: message.transferId,
              hash: message.hash,
              reason
            });
          } else {
            sendRelayToHost({
              type: 'FILE_CANCEL',
              toUserId: message.fromUserId,
              transferId: message.transferId,
              hash: message.hash,
              reason
            });
          }
        }
        return;
      }

      if (message.type === 'FILE_SIGNAL') {
        const manager = fileTransferManagerRef.current;
        if (!manager) {
          return;
        }

        try {
          await manager.handleSignal({
            fromUserId: message.fromUserId,
            transferId: message.transferId,
            hash: message.hash,
            kind: message.kind,
            data: message.data
          });
        } catch (error) {
          setChatAttachmentTransferState(message.hash, {
            status: 'failed',
            progress: 0,
            error: error instanceof Error ? error.message : 'Could not process file signal'
          });
        }
        return;
      }

      if (message.type === 'FILE_CANCEL') {
        fileTransferManagerRef.current?.cancelTransfer(message.transferId);
        pendingFileTransferByIdRef.current.delete(message.transferId);
        setChatAttachmentTransferState(message.hash, {
          status: 'failed',
          progress: 0,
          error: message.reason ?? 'Transfer was cancelled'
        });
        return;
      }

      if (message.type === 'FILE_OFFER') {
        const current = chatAttachmentTransferRef.current[message.hash];
        if (!current || current.status === 'not_downloaded') {
          setChatAttachmentTransferState(message.hash, {
            status: 'not_downloaded',
            progress: 0
          });
        }
        return;
      }

      if (message.type === 'CHAT_MESSAGE_WHISPER' || message.type === 'CHAT_MESSAGE_DM_NOTE') {
        clearHostConfirmationPending(['CHAT']);
        const chatMessage = chatMessageFromHostDirect(message);
        const snapshot = localSnapshotRef.current;
        if (!snapshot) {
          appendChatMessage(chatMessage);
          return;
        }

        const nextSnapshot = appendChatMessageToSnapshot(snapshot, chatMessage);
        setLocalSnapshot(nextSnapshot);
        setChatMessages(nextSnapshot.chat.messages);
        return;
      }

      if (message.type === 'DENIED') {
        clearHostConfirmationPending();
        setLastError(`${message.code}: ${message.message}`);
      }
    },
    [
      applySnapshotToUi,
      appendChatMessage,
      clearHostConfirmationPending,
      ensureLocalAssetUrl,
      hostUserId,
      refreshMapAssets,
      requestMissingLocalAssets,
      roomId,
      sendRelayToHost,
      sendRelayToUser,
      setChatAttachmentTransferState,
      setChatMessages,
      setLastError,
      startFileTransferSend,
      userId,
      upsertAssetIntoLocalManifest
    ]
  );

  const handleDirectFromHostRef = useRef(handleDirectFromHost);
  handleDirectFromHostRef.current = handleDirectFromHost;
  const handleRelayFromUserRef = useRef(handleRelayFromUser);
  handleRelayFromUserRef.current = handleRelayFromUser;
  const sendSnapshotToUserRef = useRef(sendSnapshotToUser);
  sendSnapshotToUserRef.current = sendSnapshotToUser;
  const requestMissingLocalAssetsRef = useRef(requestMissingLocalAssets);
  requestMissingLocalAssetsRef.current = requestMissingLocalAssets;
  const refreshMapAssetsRef = useRef(refreshMapAssets);
  refreshMapAssetsRef.current = refreshMapAssets;
  const applySnapshotToUiRef = useRef(applySnapshotToUi);
  applySnapshotToUiRef.current = applySnapshotToUi;

  useEffect(() => {
    void refreshMapAssets();
  }, [refreshMapAssets]);

  useEffect(() => {
    if (roomId) {
      return;
    }

    if (mapEditFlushTimerRef.current !== null) {
      window.clearTimeout(mapEditFlushTimerRef.current);
      mapEditFlushTimerRef.current = null;
    }

    mapEditPendingOpsRef.current = [];
    setMapEditSnapshot({
      revision: 0,
      elements: []
    });
    setMapEditRemoteEvents([]);
    setLocalSnapshot(null);
    snapshotChunkBufferRef.current.clear();
    assetChunkBufferRef.current.clear();
    snapshotSentUsersRef.current.clear();
    if (localSnapshotSaveTimerRef.current !== null) {
      window.clearTimeout(localSnapshotSaveTimerRef.current);
      localSnapshotSaveTimerRef.current = null;
    }
    if (localSettingsSyncTimerRef.current !== null) {
      window.clearTimeout(localSettingsSyncTimerRef.current);
      localSettingsSyncTimerRef.current = null;
    }
    localSettingsSyncPendingRef.current = null;
    localSettingsSyncLastSentAtRef.current = 0;
    localAssetUrlResolver.clear();
    setLocalAssetUrlByHash({});
    pendingFileTransferByIdRef.current.clear();
    setChatAttachmentTransferByHash({});
    setChatMessages([]);
    resetChatCompose();
  }, [resetChatCompose, roomId, setChatMessages]);

  useEffect(() => {
    if (storageMode !== 'LOCAL') {
      setChatAttachmentTransferByHash({});
      return;
    }

    const attachmentHashes = new Set<string>();
    for (const message of chatMessages) {
      for (const attachment of message.attachments ?? []) {
        attachmentHashes.add(attachment.hash);
      }
    }

    if (attachmentHashes.size === 0) {
      setChatAttachmentTransferByHash({});
      return;
    }

    let cancelled = false;
    const hashes = [...attachmentHashes];

    void (async () => {
      const availableHashes = new Set<string>();
      for (const hash of hashes) {
        const blob = await localSessionRepository.getAsset(hash);
        if (!blob) {
          continue;
        }

        availableHashes.add(hash);
        await ensureLocalAssetUrl(hash);
      }

      if (cancelled) {
        return;
      }

      setChatAttachmentTransferByHash((previous) => {
        const next: Record<string, ChatAttachmentTransferState> = {};

        for (const hash of hashes) {
          if (availableHashes.has(hash)) {
            next[hash] = {
              status: 'available',
              progress: 100
            };
            continue;
          }

          const current = previous[hash];
          if (current?.status === 'downloading' || current?.status === 'failed') {
            next[hash] = current;
            continue;
          }

          next[hash] = {
            status: 'not_downloaded',
            progress: 0
          };
        }

        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [chatMessages, ensureLocalAssetUrl, storageMode]);

  useEffect(() => {
    return () => {
      if (mapEditFlushTimerRef.current !== null) {
        window.clearTimeout(mapEditFlushTimerRef.current);
      }

      if (localSnapshotSaveTimerRef.current !== null) {
        window.clearTimeout(localSnapshotSaveTimerRef.current);
      }
      if (localSettingsSyncTimerRef.current !== null) {
        window.clearTimeout(localSettingsSyncTimerRef.current);
      }
      localSettingsSyncPendingRef.current = null;

      localAssetUrlResolver.clear();
    };
  }, []);

  useEffect(() => {
    if (storageMode !== 'LOCAL' || !roomId || !localSnapshot) {
      return;
    }

    if (localSnapshotSaveTimerRef.current !== null) {
      window.clearTimeout(localSnapshotSaveTimerRef.current);
    }

    localSnapshotSaveTimerRef.current = window.setTimeout(() => {
      localSnapshotSaveTimerRef.current = null;
      void localSessionRepository.saveSnapshot(roomId, localSnapshot);
    }, 500);
  }, [localSnapshot, roomId, storageMode]);

  useEffect(() => {
    if (!roomId || !clientId || !displayName || !wsUrl) {
      return;
    }

    let cancelled = false;
    let reconnectTimer: number | null = null;

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimer !== null) {
        return;
      }

      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 1500);
    };

    const connect = () => {
      if (cancelled) {
        return;
      }

      const activeSocket = wsRef.current;
      if (
        activeSocket &&
        (activeSocket.readyState === WebSocket.OPEN ||
          activeSocket.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      setConnectionStatus('connecting');

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (wsRef.current !== socket) {
          socket.close();
          return;
        }

        wsDisconnectedErrorShownRef.current = false;
        setConnectionStatus('connected');
        setLastError(null);

        const helloMessage: ClientToServerMessage = {
          type: 'HELLO',
          payload: {
            clientId,
            displayName,
            roomId,
            joinSecret: joinSecret ?? undefined
          }
        };

        socket.send(JSON.stringify(helloMessage));
      };

      socket.onmessage = (event) => {
        if (wsRef.current !== socket) {
          return;
        }

        let decoded: unknown;

        try {
          decoded = JSON.parse(String(event.data));
        } catch {
          setLastError('Received invalid JSON from server');
          return;
        }

        const parsed = ServerToClientMessageSchema.safeParse(decoded);

        if (!parsed.success) {
          setLastError('Received message does not match shared contract');
          return;
        }

        const message = parsed.data;

        switch (message.type) {
          case 'WELCOME':
            applyWelcomeMessage(message.payload);
            clearHostConfirmationPending();
            setMapEditSnapshot(message.payload.mapEditSnapshot);
            setMapEditRemoteEvents([]);
            mapEditPendingOpsRef.current = [];
            if (mapEditFlushTimerRef.current !== null) {
              window.clearTimeout(mapEditFlushTimerRef.current);
              mapEditFlushTimerRef.current = null;
            }
            break;
          case 'WELCOME_LOCAL':
            applyWelcomeLocalMessage(message.payload);
            clearHostConfirmationPending();
            setMembersOnline(message.payload.membersOnline);
            setMapEditRemoteEvents([]);
            mapEditPendingOpsRef.current = [];
            if (mapEditFlushTimerRef.current !== null) {
              window.clearTimeout(mapEditFlushTimerRef.current);
              mapEditFlushTimerRef.current = null;
            }

            void (async () => {
              if (message.payload.userId === message.payload.hostUserId) {
                let snapshotFromDisk: RoomSnapshot | null = null;
                const loadedSnapshot = await localSessionRepository.loadSnapshot(
                  message.payload.roomId
                );
                if (loadedSnapshot) {
                  const parsedSnapshot = RoomSnapshotSchema.safeParse(loadedSnapshot);
                  if (parsedSnapshot.success) {
                    snapshotFromDisk = parsedSnapshot.data;
                  }
                }

                const snapshot = normalizeSnapshotAssetManifest(
                  snapshotFromDisk && snapshotFromDisk.roomId === message.payload.roomId
                    ? {
                        ...snapshotFromDisk,
                        roomId: message.payload.roomId,
                        hostUserId: message.payload.hostUserId,
                        generatedAt: new Date().toISOString()
                      }
                    : buildLocalSnapshot({
                        roomId: message.payload.roomId,
                        hostUserId: message.payload.hostUserId,
                        settings: LocalSessionSettingsSchema.parse({
                          ...defaultLocalSessionSettings(DEFAULT_BOARD_SETTINGS),
                          ...buildDefaultPolicies()
                        }),
                        currentMapRef: null,
                        tokens: [],
                        mapEditElements: [],
                        mapEditRev: 0
                      })
                );

                await applySnapshotToUiRef.current(snapshot);
                snapshotSentUsersRef.current.clear();
                for (const memberOnline of message.payload.membersOnline) {
                  if (memberOnline.userId === message.payload.hostUserId) {
                    continue;
                  }

                  sendSnapshotToUserRef.current(memberOnline.userId, snapshot);
                  snapshotSentUsersRef.current.add(memberOnline.userId);
                }
              } else {
                setTokens([]);
                setChatMessages([]);
                setMapEditSnapshot({
                  revision: 0,
                  elements: []
                });
                setMapEditRemoteEvents([]);
                setLocalSnapshot(null);
              }

              void refreshMapAssetsRef.current();
            })();
            break;
          case 'PRESENCE_UPDATE':
            setMembersOnline(message.payload.membersOnline);
            if (
              storageModeRef.current === 'LOCAL' &&
              userIdRef.current &&
              hostUserIdRef.current &&
              userIdRef.current === hostUserIdRef.current
            ) {
              const snapshot = localSnapshotRef.current;
              if (!snapshot) {
                break;
              }

              const onlineIds = new Set(
                message.payload.membersOnline.map((memberOnline) => memberOnline.userId)
              );
              for (const knownUserId of [...snapshotSentUsersRef.current]) {
                if (!onlineIds.has(knownUserId)) {
                  snapshotSentUsersRef.current.delete(knownUserId);
                }
              }

              for (const memberOnline of message.payload.membersOnline) {
                if (memberOnline.userId === hostUserIdRef.current) {
                  continue;
                }

                if (snapshotSentUsersRef.current.has(memberOnline.userId)) {
                  continue;
                }

                sendSnapshotToUserRef.current(memberOnline.userId, snapshot);
                snapshotSentUsersRef.current.add(memberOnline.userId);
              }
            }
            break;
          case 'RELAY_FROM_HOST':
            if (storageModeRef.current === 'LOCAL') {
              if (
                !userIdRef.current ||
                !hostUserIdRef.current ||
                userIdRef.current !== hostUserIdRef.current
              ) {
                const pendingKinds = resolvePendingKindsForHostEvent(message.payload);
                if (pendingKinds.length > 0) {
                  clearHostConfirmationPending(pendingKinds);
                }

                if (localSnapshotRef.current) {
                  if (
                    message.payload.type === 'CHAT_MESSAGE_PUBLIC' ||
                    message.payload.type === 'CHAT_MESSAGE_WHISPER' ||
                    message.payload.type === 'CHAT_MESSAGE_DM_NOTE'
                  ) {
                    const nextSnapshot = applyHostEventToSnapshot(
                      localSnapshotRef.current,
                      message.payload
                    );
                    setLocalSnapshot(nextSnapshot);
                    setChatMessages(nextSnapshot.chat.messages);
                  } else {
                    const nextSnapshot = applyHostEventToSnapshot(
                      localSnapshotRef.current,
                      message.payload
                    );
                    void (async () => {
                      await applySnapshotToUiRef.current(nextSnapshot);
                      await requestMissingLocalAssetsRef.current(
                        collectLocalAssetHashesFromHostEvent(message.payload)
                      );
                    })();
                  }
                }
              }
            }
            break;
          case 'DIRECT_FROM_HOST':
            if (storageModeRef.current === 'LOCAL') {
              void handleDirectFromHostRef.current(message.payload);
            }
            break;
          case 'RELAY_FROM_USER':
            if (
              storageModeRef.current === 'LOCAL' &&
              userIdRef.current &&
              hostUserIdRef.current &&
              userIdRef.current === hostUserIdRef.current
            ) {
              void handleRelayFromUserRef.current(message.payload);
            }
            break;
          case 'HOST_OFFLINE':
            clearHostConfirmationPending();
            setLastError(message.payload.message);
            break;
          case 'TOKEN_CREATED':
            upsertToken(message.payload.token);
            break;
          case 'TOKEN_UPDATED':
            upsertToken(message.payload.token);
            break;
          case 'TOKEN_DELETED':
            removeToken(message.payload.tokenId);
            break;
          case 'ROOM_SETTINGS_UPDATED':
            setSettings(message.payload.settings);
            break;
          case 'ROOM_MAP_UPDATED':
            setCurrentMapState(message.payload.currentMapAssetId, message.payload.asset);
            if (message.payload.asset) {
              upsertMapAsset(message.payload.asset);
            }
            break;
          case 'ASSET_CREATED':
            if (message.payload.asset.type === 'MAP') {
              upsertMapAsset(message.payload.asset);
            }
            break;
          case 'MAP_EDIT_OPS_APPLIED':
            setMapEditRemoteEvents((previous) => [...previous, message.payload]);
            break;
          case 'ERROR':
            setLastError(`${message.payload.code}: ${message.payload.message}`);
            break;
          case 'PONG':
            break;
          default:
            break;
        }
      };

      socket.onerror = () => {
        if (wsRef.current !== socket) {
          return;
        }

        clearHostConfirmationPending();
        setConnectionStatus('disconnected');
      };

      socket.onclose = () => {
        const isActiveSocket = wsRef.current === socket;
        if (!isActiveSocket) {
          return;
        }

        wsRef.current = null;

        clearHostConfirmationPending();
        setConnectionStatus('disconnected');
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      cancelled = true;

      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }

      const socket = wsRef.current;
      wsRef.current = null;
      socket?.close();
    };
  }, [
    applyWelcomeMessage,
    applyWelcomeLocalMessage,
    clientId,
    clearHostConfirmationPending,
    displayName,
    joinSecret,
    removeToken,
    roomId,
    setConnectionStatus,
    setChatMessages,
    setCurrentMapState,
    setLastError,
    setMembersOnline,
    setSettings,
    setTokens,
    upsertMapAsset,
    upsertToken,
    wsUrl
  ]);

  const isWaitingForHostSnapshot =
    storageMode === 'LOCAL' &&
    roomId !== null &&
    role !== null &&
    role !== 'DM' &&
    localSnapshot === null;
  const isLocalHostUser =
    storageMode === 'LOCAL' && !!userId && !!hostUserId && userId === hostUserId;
  const canUseOptimisticLocalState = storageMode !== 'LOCAL' || isLocalHostUser;
  const isLocalHostOnline =
    storageMode !== 'LOCAL' || !hostUserId
      ? true
      : membersOnline.some((memberOnline) => memberOnline.userId === hostUserId);
  const isLocalNonHostBlockedByOfflineHost =
    storageMode === 'LOCAL' &&
    !!userId &&
    !!hostUserId &&
    userId !== hostUserId &&
    !isLocalHostOnline;

  useEffect(() => {
    if (storageMode !== 'LOCAL' || isLocalHostUser || !roomId || !isLocalHostOnline) {
      hostConfirmationPendingSinceRef.current = {};
      setShowSlowHostConfirmationHint(false);
      setSlowHostConfirmationSeconds(0);
      return;
    }

    const updateSlowHintState = () => {
      const pendingTimestamps = Object.values(hostConfirmationPendingSinceRef.current).filter(
        (value): value is number => typeof value === 'number'
      );

      if (pendingTimestamps.length === 0) {
        setShowSlowHostConfirmationHint(false);
        setSlowHostConfirmationSeconds(0);
        return;
      }

      const oldestPendingAt = Math.min(...pendingTimestamps);
      const ageMs = Date.now() - oldestPendingAt;
      const isSlow = ageMs >= HOST_CONFIRMATION_SLOW_MS;

      setShowSlowHostConfirmationHint(isSlow);
      setSlowHostConfirmationSeconds(isSlow ? Math.floor(ageMs / 1_000) : 0);
    };

    updateSlowHintState();
    const intervalId = window.setInterval(updateSlowHintState, 500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isLocalHostOnline, isLocalHostUser, roomId, storageMode]);

  const canCreateTokens = useMemo(() => {
    if (
      isWaitingForHostSnapshot ||
      isLocalNonHostBlockedByOfflineHost ||
      !role ||
      !settings ||
      !userId
    ) {
      return false;
    }

    if (role === 'DM') {
      return true;
    }

    if (role === 'SPECTATOR') {
      return false;
    }

    return settings.tokenMovePolicy !== 'DM_ONLY';
  }, [isLocalNonHostBlockedByOfflineHost, isWaitingForHostSnapshot, role, settings, userId]);

  const canSetActiveMap = role === 'DM';
  const localTokenEditPolicy = localSnapshot?.settings.tokenEditPolicy ?? 'DM_ONLY';
  const localAutoExportEnabled = localSnapshot?.settings.autoExportEnabled ?? true;
  const localAutoExportIntervalMinutes = localSnapshot?.settings.autoExportIntervalMinutes ?? 30;

  const canEditMap = useMemo(() => {
    if (isWaitingForHostSnapshot || isLocalNonHostBlockedByOfflineHost) {
      return false;
    }

    return resolveMapEditAccess({
      role,
      settings,
      userId
    });
  }, [isLocalNonHostBlockedByOfflineHost, isWaitingForHostSnapshot, role, settings, userId]);

  const handleMapEditOperations = useCallback(
    (operations: MapEditOperation[], options?: { immediate?: boolean }) => {
      if (!canEditMap) {
        return;
      }

      const outboundOperations =
        storageMode === 'LOCAL'
          ? operations.map((operation) => stripSourceUrlFromMapEditOperation(operation))
          : operations;

      queueMapEditOperations(outboundOperations, options);
    },
    [canEditMap, queueMapEditOperations, storageMode]
  );

  useEffect(() => {
    if (canEditMap) {
      return;
    }

    setBoardSettings((previous) => {
      if (!previous.mapEditMode && !previous.mapCalibrationMode) {
        return previous;
      }

      return sanitizeBoardSettings({
        ...previous,
        mapEditMode: false,
        mapCalibrationMode: false
      });
    });
  }, [canEditMap]);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((previous) => {
      const nextIsDark = !previous;
      document.documentElement.classList.toggle('dark', nextIsDark);
      localStorage.setItem(THEME_STORAGE_KEY, nextIsDark ? 'dark' : 'light');
      return nextIsDark;
    });
  }, []);

  const canModifyToken = useCallback(
    (token: VttToken) => {
      if (
        isWaitingForHostSnapshot ||
        isLocalNonHostBlockedByOfflineHost ||
        !role ||
        !settings ||
        !userId
      ) {
        return false;
      }

      if (role === 'DM') {
        return true;
      }

      if (role === 'SPECTATOR') {
        return false;
      }

      if (settings.tokenMovePolicy === 'DM_ONLY') {
        return false;
      }

      if (settings.tokenMovePolicy === 'ALL') {
        return true;
      }

      return isTokenOwnedByUser(token, userId);
    },
    [isLocalNonHostBlockedByOfflineHost, isWaitingForHostSnapshot, role, settings, userId]
  );

  const tokenEditPolicy = useMemo<TokenMovePolicy>(() => {
    if (storageMode === 'LOCAL') {
      return localSnapshot?.settings.tokenEditPolicy ?? 'DM_ONLY';
    }

    return settings?.tokenMovePolicy ?? 'DM_ONLY';
  }, [localSnapshot?.settings.tokenEditPolicy, settings?.tokenMovePolicy, storageMode]);

  const canEditToken = useCallback(
    (token: VttToken) => {
      if (isWaitingForHostSnapshot || isLocalNonHostBlockedByOfflineHost || !role || !userId) {
        return false;
      }

      if (role === 'DM') {
        return true;
      }

      if (role !== 'PLAYER') {
        return false;
      }

      if (tokenEditPolicy === 'DM_ONLY') {
        return false;
      }

      if (tokenEditPolicy === 'ALL') {
        return true;
      }

      return isTokenOwnedByUser(token, userId);
    },
    [isLocalNonHostBlockedByOfflineHost, isWaitingForHostSnapshot, role, tokenEditPolicy, userId]
  );

  const handleChatComposeKindChange = useCallback(
    (nextKind: ChatSendKind) => {
      setChatComposeKind(nextKind);
      if (nextKind !== 'WHISPER') {
        setChatComposeRecipients([]);
      }
    },
    [setChatComposeKind, setChatComposeRecipients]
  );

  const handleSendChatMessage = useCallback(
    (args: {
      kind: ChatSendKind;
      text: string;
      recipients: string[];
      attachments: ChatAttachment[];
    }) => {
      const normalizedText = args.text.trim();
      const attachments = args.attachments ?? [];
      if (normalizedText.length === 0 && attachments.length === 0) {
        return;
      }

      if (normalizedText.length > LOCAL_CHAT_MAX_TEXT_LENGTH) {
        setLastError(`Chat message exceeds ${LOCAL_CHAT_MAX_TEXT_LENGTH} characters`);
        return;
      }

      if (storageMode === 'CLOUD') {
        setLastError('CLOUD_CHAT_NOT_IMPLEMENTED: Chat is currently available in LOCAL mode only');
        return;
      }

      if (storageMode !== 'LOCAL' || !roomId || !userId || !hostUserId) {
        return;
      }

      if (isWaitingForHostSnapshot) {
        setLastError('Waiting for host snapshot...');
        return;
      }

      if (isLocalNonHostBlockedByOfflineHost) {
        setLastError('Host (DM) is currently offline');
        return;
      }

      if (role !== 'DM' && role !== 'PLAYER') {
        setLastError('Only DM and players can send chat messages');
        return;
      }

      if (role !== 'DM' && (args.kind === 'WHISPER' || args.kind === 'DM_NOTE')) {
        setLastError('Only DM can send whispers and DM notes');
        return;
      }

      if (args.kind === 'WHISPER' && args.recipients.length === 0) {
        setLastError('Whisper requires at least one recipient');
        return;
      }

      const now = Date.now();
      if (now - chatSendThrottleRef.current < LOCAL_CHAT_CLIENT_RATE_LIMIT_MS) {
        return;
      }
      chatSendThrottleRef.current = now;

      const payload: Extract<HostRequest, { type: 'REQUEST_CHAT_SEND' }> = {
        type: 'REQUEST_CHAT_SEND',
        kind: args.kind,
        text: normalizedText
      };
      if (args.kind === 'WHISPER') {
        payload.recipients = args.recipients;
      }
      if (attachments.length > 0) {
        payload.attachments = attachments;
      }

      const estimatedBytes = new TextEncoder().encode(
        JSON.stringify({
          type: 'RELAY_TO_HOST',
          payload
        })
      ).length;
      if (estimatedBytes > MAX_LOCAL_CHAT_REQUEST_BYTES) {
        setLastError('Chat message is too large. Please reduce text/attachment size.');
        return;
      }

      const sent = sendRelayToHostWithPending(payload, userId === hostUserId ? undefined : 'CHAT');
      if (!sent) {
        return;
      }

      setLastError(null);
      if (args.kind !== 'WHISPER') {
        setChatComposeRecipients([]);
      }
    },
    [
      hostUserId,
      isLocalNonHostBlockedByOfflineHost,
      isWaitingForHostSnapshot,
      role,
      roomId,
      sendRelayToHostWithPending,
      setChatComposeRecipients,
      setLastError,
      storageMode,
      userId
    ]
  );

  const handleCreateRoom = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!clientId) {
        setLastError('Client identifier is not ready yet');
        return;
      }

      const roomName = createRoomName.trim();
      const dmName = createDisplayName.trim();

      if (!roomName || !dmName) {
        setLastError('Room name and display name are required');
        return;
      }

      setIsSubmitting(true);
      setLastError(null);

      try {
        const response = await createRoom({
          name: roomName,
          displayName: dmName,
          clientId,
          storageMode: createStorageMode
        });

        setDisplayName(dmName);
        applyCreateRoomResponse(response);
      } catch (error) {
        setLastError(error instanceof Error ? error.message : 'Could not create room');
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      applyCreateRoomResponse,
      clientId,
      createDisplayName,
      createStorageMode,
      createRoomName,
      setDisplayName,
      setLastError
    ]
  );

  const handleJoinRoom = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!clientId) {
        setLastError('Client identifier is not ready yet');
        return;
      }

      const normalizedJoinSecret = joinSecretInput.trim().toUpperCase();
      const playerName = joinDisplayName.trim();

      if (!normalizedJoinSecret || !playerName) {
        setLastError('Join code and display name are required');
        return;
      }

      setIsSubmitting(true);
      setLastError(null);

      try {
        const response = await joinRoom({
          joinSecret: normalizedJoinSecret,
          displayName: playerName,
          roleDesired: joinRoleDesired,
          clientId
        });

        setDisplayName(playerName);
        applyJoinRoomResponse(response);
      } catch (error) {
        setLastError(error instanceof Error ? error.message : 'Could not join room');
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      applyJoinRoomResponse,
      clientId,
      joinDisplayName,
      joinRoleDesired,
      joinSecretInput,
      setDisplayName,
      setLastError
    ]
  );

  const handleCreateToken = useCallback(
    async (x: number, y: number, draft: TokenDraft, imageFile?: File | null) => {
      if (!canCreateTokens || !roomId || !clientId) {
        return;
      }

      if (storageMode === 'LOCAL') {
        let imageRef: ImageRef | null = null;

        if (imageFile) {
          if (!userId || !hostUserId || userId !== hostUserId) {
            throw new Error('In LOCAL mode, token image uploads are host-only.');
          }

          const registered = await registerLocalAsset({
            blob: imageFile,
            kind: 'TOKEN_IMAGE',
            label: imageFile.name
          });
          imageRef = {
            kind: 'LOCAL_ASSET',
            hash: registered.hash
          };

          upsertAssetIntoLocalManifest({
            hash: registered.hash,
            mime: imageFile.type || 'application/octet-stream',
            size: imageFile.size,
            kind: 'TOKEN_IMAGE'
          });
        }

        if (!userId || !hostUserId) {
          return;
        }

        if (userId === hostUserId) {
          const now = new Date().toISOString();
          const token: VttToken = {
            id: createLocalEntityId('token'),
            roomId,
            name: draft.name.trim() || 'Token',
            x,
            y,
            size: 1,
            assetId: imageRef?.kind === 'LOCAL_ASSET' ? toLocalAssetId(imageRef.hash) : null,
            imageRef,
            kind: draft.kind,
            color: draft.color,
            elevation: draft.elevation,
            imageOffsetX: draft.imageOffsetX,
            imageOffsetY: draft.imageOffsetY,
            imageScale: draft.imageScale,
            imageRotationDeg: draft.imageRotationDeg,
            controlledBy:
              (localSnapshotRef.current?.settings.tokenMovePolicy ?? 'ALL') === 'OWNED_ONLY'
                ? {
                    mode: 'USERS',
                    userIds: [userId]
                  }
                : {
                    mode: 'ALL'
                  },
            createdAt: now,
            updatedAt: now
          };

          await applyLocalHostEvent({
            type: 'TOKEN_CREATED',
            token
          });
          return;
        }

        sendRelayToHostWithPending(
          {
            type: 'REQUEST_TOKEN_CREATE',
            x,
            y,
            tokenDraft: {
              name: draft.name.trim() || 'Token',
              size: 1,
              imageRef,
              kind: draft.kind,
              color: draft.color,
              elevation: draft.elevation,
              imageOffsetX: draft.imageOffsetX,
              imageOffsetY: draft.imageOffsetY,
              imageScale: draft.imageScale,
              imageRotationDeg: draft.imageRotationDeg
            }
          },
          'TOKEN'
        );
        return;
      }

      let assetId: string | undefined;

      if (imageFile) {
        const tokenAsset = await uploadRoomAsset({
          roomId,
          clientId,
          file: imageFile,
          type: 'TOKEN_IMAGE'
        });
        assetId = tokenAsset.id;
      }

      sendClientMessage({
        type: 'TOKEN_CREATE',
        payload: {
          name: draft.name.trim() || 'Token',
          x,
          y,
          size: 1,
          assetId,
          kind: draft.kind,
          color: draft.color,
          elevation: draft.elevation,
          imageOffsetX: draft.imageOffsetX,
          imageOffsetY: draft.imageOffsetY,
          imageScale: draft.imageScale,
          imageRotationDeg: draft.imageRotationDeg
        }
      });
    },
    [
      applyLocalHostEvent,
      canCreateTokens,
      clientId,
      hostUserId,
      registerLocalAsset,
      roomId,
      sendClientMessage,
      sendRelayToHostWithPending,
      storageMode,
      upsertAssetIntoLocalManifest,
      userId
    ]
  );

  const handleMoveToken = useCallback(
    (tokenId: string, x: number, y: number, options: { final: boolean }) => {
      const token = tokens.find((item) => item.id === tokenId);

      if (!token || !canModifyToken(token)) {
        return;
      }

      if (storageMode === 'LOCAL' && isLocalNonHostBlockedByOfflineHost) {
        return;
      }

      const targetPoint =
        boardSettings.snapToGrid && options.final
          ? snapPointToGrid(x, y, {
              gridType: boardSettings.gridType,
              cellSizePx: boardSettings.cellSizePx,
              gridOriginX: boardSettings.gridOriginX,
              gridOriginY: boardSettings.gridOriginY
            })
          : { x, y };

      const shouldApplyOptimisticMove = canUseOptimisticLocalState;

      if (shouldApplyOptimisticMove) {
        updateTokenPositionLocal(tokenId, targetPoint.x, targetPoint.y);
      }

      const now = performance.now();
      const shouldSend = options.final || now - moveThrottleRef.current >= 50;

      if (!shouldSend) {
        return;
      }

      moveThrottleRef.current = now;

      if (storageMode === 'LOCAL') {
        if (!userId || !hostUserId) {
          return;
        }

        if (userId === hostUserId) {
          void applyLocalHostEvent({
            type: 'TOKEN_MOVED',
            tokenId,
            x: targetPoint.x,
            y: targetPoint.y
          });
          return;
        }

        sendRelayToHostWithPending(
          {
            type: 'REQUEST_TOKEN_MOVE',
            tokenId,
            x: targetPoint.x,
            y: targetPoint.y
          },
          'TOKEN'
        );
        return;
      }

      sendClientMessage({
        type: 'TOKEN_MOVE',
        payload: {
          tokenId,
          x: targetPoint.x,
          y: targetPoint.y
        }
      });
    },
    [
      applyLocalHostEvent,
      boardSettings.cellSizePx,
      boardSettings.gridOriginX,
      boardSettings.gridOriginY,
      boardSettings.gridType,
      boardSettings.snapToGrid,
      canUseOptimisticLocalState,
      canModifyToken,
      hostUserId,
      isLocalNonHostBlockedByOfflineHost,
      sendClientMessage,
      sendRelayToHostWithPending,
      storageMode,
      tokens,
      userId,
      updateTokenPositionLocal
    ]
  );

  const handleDeleteToken = useCallback(
    (token: VttToken) => {
      if (!canModifyToken(token)) {
        return;
      }

      if (storageMode === 'LOCAL') {
        if (!userId || !hostUserId) {
          return;
        }

        if (userId === hostUserId) {
          void applyLocalHostEvent({
            type: 'TOKEN_DELETED',
            tokenId: token.id
          });
          return;
        }

        sendRelayToHostWithPending(
          {
            type: 'REQUEST_TOKEN_DELETE',
            tokenId: token.id
          },
          'TOKEN'
        );
        return;
      }

      sendClientMessage({
        type: 'TOKEN_DELETE',
        payload: {
          tokenId: token.id
        }
      });
    },
    [
      applyLocalHostEvent,
      canModifyToken,
      hostUserId,
      sendClientMessage,
      sendRelayToHostWithPending,
      storageMode,
      userId
    ]
  );

  const handleDeleteTokenById = useCallback(
    (tokenId: string) => {
      const token = tokens.find((entry) => entry.id === tokenId);
      if (!token) {
        return;
      }

      handleDeleteToken(token);
    },
    [handleDeleteToken, tokens]
  );

  const handleUpdateToken = useCallback(
    async (tokenId: string, draft: TokenDraft, imageFile?: File | null) => {
      if (!roomId || !clientId) {
        throw new Error('Room is not ready yet');
      }

      const existingToken = tokens.find((tokenItem) => tokenItem.id === tokenId);
      if (!existingToken) {
        throw new Error('Token not found');
      }

      if (!canEditToken(existingToken)) {
        throw new Error('You are not allowed to edit this token');
      }

      if (storageMode === 'LOCAL') {
        let imageRefPatch: ImageRef | null | undefined;

        if (imageFile) {
          if (!userId || !hostUserId || userId !== hostUserId) {
            throw new Error('In LOCAL mode, token image uploads are host-only.');
          }

          const registered = await registerLocalAsset({
            blob: imageFile,
            kind: 'TOKEN_IMAGE',
            label: imageFile.name
          });

          upsertAssetIntoLocalManifest({
            hash: registered.hash,
            mime: imageFile.type || 'application/octet-stream',
            size: imageFile.size,
            kind: 'TOKEN_IMAGE'
          });

          imageRefPatch = {
            kind: 'LOCAL_ASSET',
            hash: registered.hash
          };
        }

        if (!userId || !hostUserId) {
          throw new Error('Host information is not available');
        }

        if (userId === hostUserId) {
          const hasImagePatch = imageRefPatch !== undefined;
          const nextImageRef = hasImagePatch
            ? (imageRefPatch ?? null)
            : (existingToken.imageRef ?? null);

          const updatedToken: VttToken = {
            ...existingToken,
            name: draft.name.trim() || 'Token',
            kind: draft.kind,
            color: draft.color,
            elevation: draft.elevation,
            imageRef: nextImageRef,
            assetId:
              nextImageRef?.kind === 'LOCAL_ASSET'
                ? toLocalAssetId(nextImageRef.hash)
                : nextImageRef?.kind === 'CLOUD_ASSET'
                  ? nextImageRef.assetId
                  : null,
            imageOffsetX: draft.imageOffsetX,
            imageOffsetY: draft.imageOffsetY,
            imageScale: draft.imageScale,
            imageRotationDeg: draft.imageRotationDeg,
            updatedAt: new Date().toISOString()
          };

          await applyLocalHostEvent({
            type: 'TOKEN_UPDATED',
            token: updatedToken
          });
          return;
        }

        sendRelayToHostWithPending(
          {
            type: 'REQUEST_TOKEN_UPDATE',
            tokenId,
            patch: {
              name: draft.name.trim() || 'Token',
              kind: draft.kind,
              color: draft.color,
              elevation: draft.elevation,
              imageRef: imageRefPatch,
              imageOffsetX: draft.imageOffsetX,
              imageOffsetY: draft.imageOffsetY,
              imageScale: draft.imageScale,
              imageRotationDeg: draft.imageRotationDeg
            }
          },
          'TOKEN'
        );
        return;
      }

      let assetId: string | null | undefined;

      if (imageFile) {
        const uploaded = await uploadRoomAsset({
          roomId,
          clientId,
          file: imageFile,
          type: 'TOKEN_IMAGE'
        });
        assetId = uploaded.id;
      }

      sendClientMessage({
        type: 'TOKEN_UPDATE',
        payload: {
          tokenId,
          name: draft.name.trim() || 'Token',
          kind: draft.kind,
          color: draft.color,
          elevation: draft.elevation,
          assetId,
          imageOffsetX: draft.imageOffsetX,
          imageOffsetY: draft.imageOffsetY,
          imageScale: draft.imageScale,
          imageRotationDeg: draft.imageRotationDeg
        }
      });
    },
    [
      applyLocalHostEvent,
      canEditToken,
      clientId,
      hostUserId,
      registerLocalAsset,
      roomId,
      sendClientMessage,
      sendRelayToHostWithPending,
      storageMode,
      tokens,
      upsertAssetIntoLocalManifest,
      userId
    ]
  );

  const handleSaveTokenEdit = useCallback(async () => {
    if (!editingToken || !roomId || !clientId) {
      return;
    }

    setIsSavingTokenEdit(true);
    setLastError(null);

    try {
      const existingToken = tokens.find((tokenItem) => tokenItem.id === editingToken.tokenId);
      if (!existingToken) {
        throw new Error('Token not found');
      }

      if (storageMode === 'LOCAL') {
        let imageRefPatch: ImageRef | null | undefined;

        if (editingToken.imageFile) {
          if (!userId || !hostUserId || userId !== hostUserId) {
            throw new Error('In LOCAL mode, token image uploads are host-only.');
          }

          const registered = await registerLocalAsset({
            blob: editingToken.imageFile,
            kind: 'TOKEN_IMAGE',
            label: editingToken.imageFile.name
          });

          upsertAssetIntoLocalManifest({
            hash: registered.hash,
            mime: editingToken.imageFile.type || 'application/octet-stream',
            size: editingToken.imageFile.size,
            kind: 'TOKEN_IMAGE'
          });

          imageRefPatch = {
            kind: 'LOCAL_ASSET',
            hash: registered.hash
          };
        }

        if (!userId || !hostUserId) {
          return;
        }

        if (userId === hostUserId) {
          const hasImagePatch = imageRefPatch !== undefined;
          const nextImageRef = hasImagePatch
            ? (imageRefPatch ?? null)
            : (existingToken.imageRef ?? null);

          const updatedToken: VttToken = {
            ...existingToken,
            name: editingToken.draft.name.trim() || 'Token',
            kind: editingToken.draft.kind,
            color: editingToken.draft.color,
            elevation: editingToken.draft.elevation,
            imageRef: nextImageRef,
            assetId:
              nextImageRef?.kind === 'LOCAL_ASSET'
                ? toLocalAssetId(nextImageRef.hash)
                : nextImageRef?.kind === 'CLOUD_ASSET'
                  ? nextImageRef.assetId
                  : null,
            imageOffsetX: editingToken.draft.imageOffsetX,
            imageOffsetY: editingToken.draft.imageOffsetY,
            imageScale: editingToken.draft.imageScale,
            imageRotationDeg: editingToken.draft.imageRotationDeg,
            updatedAt: new Date().toISOString()
          };

          await applyLocalHostEvent({
            type: 'TOKEN_UPDATED',
            token: updatedToken
          });
          setEditingToken(null);
          return;
        }

        sendRelayToHostWithPending(
          {
            type: 'REQUEST_TOKEN_UPDATE',
            tokenId: editingToken.tokenId,
            patch: {
              name: editingToken.draft.name.trim() || 'Token',
              kind: editingToken.draft.kind,
              color: editingToken.draft.color,
              elevation: editingToken.draft.elevation,
              imageRef: imageRefPatch,
              imageOffsetX: editingToken.draft.imageOffsetX,
              imageOffsetY: editingToken.draft.imageOffsetY,
              imageScale: editingToken.draft.imageScale,
              imageRotationDeg: editingToken.draft.imageRotationDeg
            }
          },
          'TOKEN'
        );
        setEditingToken(null);
        return;
      }

      let assetId: string | null | undefined;

      if (editingToken.imageFile) {
        const uploaded = await uploadRoomAsset({
          roomId,
          clientId,
          file: editingToken.imageFile,
          type: 'TOKEN_IMAGE'
        });
        assetId = uploaded.id;
      }

      sendClientMessage({
        type: 'TOKEN_UPDATE',
        payload: {
          tokenId: editingToken.tokenId,
          name: editingToken.draft.name.trim() || 'Token',
          kind: editingToken.draft.kind,
          color: editingToken.draft.color,
          elevation: editingToken.draft.elevation,
          assetId,
          imageOffsetX: editingToken.draft.imageOffsetX,
          imageOffsetY: editingToken.draft.imageOffsetY,
          imageScale: editingToken.draft.imageScale,
          imageRotationDeg: editingToken.draft.imageRotationDeg
        }
      });

      setEditingToken(null);
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Could not update token');
    } finally {
      setIsSavingTokenEdit(false);
    }
  }, [
    applyLocalHostEvent,
    clientId,
    editingToken,
    hostUserId,
    registerLocalAsset,
    roomId,
    sendClientMessage,
    sendRelayToHostWithPending,
    setLastError,
    storageMode,
    tokens,
    upsertAssetIntoLocalManifest,
    userId
  ]);

  const applyLocalSessionSettingsPatch = useCallback(
    (patch: LocalSessionSettingsPatch) => {
      if (storageMode !== 'LOCAL') {
        return;
      }

      if (!userId || !hostUserId) {
        return;
      }

      const snapshot = localSnapshotRef.current;
      if (!snapshot) {
        return;
      }

      const nextSettings = LocalSessionSettingsSchema.parse({
        ...snapshot.settings,
        ...patch,
        mapEditUserOverrides: patch.mapEditUserOverrides ?? snapshot.settings.mapEditUserOverrides
      });

      if (userId === hostUserId) {
        void applyLocalHostEvent({
          type: 'ROOM_SETTINGS_UPDATED',
          settings: nextSettings
        });
        return;
      }

      sendRelayToHostWithPending(
        {
          type: 'REQUEST_ROOM_SETTINGS_UPDATE',
          patch
        },
        'SETTINGS'
      );
    },
    [applyLocalHostEvent, hostUserId, sendRelayToHostWithPending, storageMode, userId]
  );

  const applyRoomSettingsPatch = useCallback(
    (
      patch: Partial<
        Pick<RoomSettings, 'tokenMovePolicy' | 'mapEditPolicy' | 'mapEditUserOverrides'>
      >
    ) => {
      if (!settings) {
        return;
      }

      const nextSettings: RoomSettings = {
        ...settings,
        ...patch,
        mapEditUserOverrides: patch.mapEditUserOverrides ?? settings.mapEditUserOverrides
      };

      if (canUseOptimisticLocalState) {
        setSettings(nextSettings);
      }

      if (storageMode === 'LOCAL') {
        if (!userId || !hostUserId) {
          return;
        }

        if (userId === hostUserId) {
          const snapshot = localSnapshotRef.current;
          if (!snapshot) {
            return;
          }

          const merged = LocalSessionSettingsSchema.parse({
            ...snapshot.settings,
            tokenMovePolicy: nextSettings.tokenMovePolicy,
            mapEditPolicy: nextSettings.mapEditPolicy,
            mapEditUserOverrides: nextSettings.mapEditUserOverrides
          });

          void applyLocalHostEvent({
            type: 'ROOM_SETTINGS_UPDATED',
            settings: merged
          });
          return;
        }

        sendRelayToHostWithPending(
          {
            type: 'REQUEST_ROOM_SETTINGS_UPDATE',
            patch: {
              tokenMovePolicy: nextSettings.tokenMovePolicy,
              mapEditPolicy: nextSettings.mapEditPolicy,
              mapEditUserOverrides: nextSettings.mapEditUserOverrides
            }
          },
          'SETTINGS'
        );
        return;
      }

      sendClientMessage({
        type: 'ROOM_SETTINGS_UPDATE',
        payload: {
          tokenMovePolicy: nextSettings.tokenMovePolicy,
          mapEditPolicy: nextSettings.mapEditPolicy,
          mapEditUserOverrides: nextSettings.mapEditUserOverrides
        }
      });
    },
    [
      applyLocalHostEvent,
      canUseOptimisticLocalState,
      hostUserId,
      sendClientMessage,
      sendRelayToHostWithPending,
      setSettings,
      settings,
      storageMode,
      userId
    ]
  );

  const handleTokenMovePolicyChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      applyRoomSettingsPatch({
        tokenMovePolicy: event.target.value as TokenMovePolicy
      });
    },
    [applyRoomSettingsPatch]
  );

  const handleMapEditPolicyChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      applyRoomSettingsPatch({
        mapEditPolicy: event.target.value as MapEditPolicy
      });
    },
    [applyRoomSettingsPatch]
  );

  const handleTokenEditPolicyChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      applyLocalSessionSettingsPatch({
        tokenEditPolicy: event.target.value as TokenMovePolicy
      });
    },
    [applyLocalSessionSettingsPatch]
  );

  const handleAutoExportIntervalChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const parsed = Number.parseInt(event.target.value, 10);
      const nextValue = Number.isFinite(parsed) ? Math.min(120, Math.max(1, parsed)) : 30;
      applyLocalSessionSettingsPatch({
        autoExportIntervalMinutes: nextValue
      });
    },
    [applyLocalSessionSettingsPatch]
  );

  const handleAutoExportEnabledChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      applyLocalSessionSettingsPatch({
        autoExportEnabled: event.target.checked
      });
    },
    [applyLocalSessionSettingsPatch]
  );

  const handleMemberMapEditPermissionChange = useCallback(
    (memberUserId: string, memberRole: Role, enabled: boolean) => {
      if (!settings || memberRole === 'DM') {
        return;
      }

      const defaultEnabled = memberRole === 'PLAYER' ? settings.mapEditPolicy === 'PLAYERS' : false;
      const nextOverrides: MapEditUserOverride[] = settings.mapEditUserOverrides.filter(
        (entry) => entry.userId !== memberUserId
      );

      if (enabled !== defaultEnabled) {
        nextOverrides.push({
          userId: memberUserId,
          enabled
        });
      }

      nextOverrides.sort((a, b) => a.userId.localeCompare(b.userId));
      applyRoomSettingsPatch({
        mapEditUserOverrides: nextOverrides
      });
    },
    [applyRoomSettingsPatch, settings]
  );

  const handleMapUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      event.target.value = '';

      if (!selectedFile || !roomId || !clientId) {
        return;
      }

      setIsUploadingMap(true);
      setLastError(null);

      try {
        if (storageMode === 'LOCAL') {
          if (!userId || !hostUserId || userId !== hostUserId) {
            throw new Error('In LOCAL mode, only the host can upload maps.');
          }

          const registered = await registerLocalAsset({
            blob: selectedFile,
            kind: 'MAP',
            label: selectedFile.name
          });

          upsertAssetIntoLocalManifest({
            hash: registered.hash,
            mime: selectedFile.type || 'application/octet-stream',
            size: selectedFile.size,
            kind: 'MAP'
          });

          upsertMapAsset({
            id: registered.assetId,
            roomId,
            ownerUserId: userId,
            type: 'MAP',
            mime: selectedFile.type || 'application/octet-stream',
            size: selectedFile.size,
            originalName: selectedFile.name,
            storageKey: registered.hash,
            createdAt: new Date().toISOString()
          });

          await applyLocalHostEvent({
            type: 'MAP_ACTIVE_SET',
            mapRef: {
              kind: 'LOCAL_ASSET',
              hash: registered.hash
            }
          });
          return;
        }

        const asset = await uploadMapAsset({
          roomId,
          clientId,
          file: selectedFile
        });

        upsertMapAsset(asset);
      } catch (error) {
        setLastError(error instanceof Error ? error.message : 'Could not upload map');
      } finally {
        setIsUploadingMap(false);
      }
    },
    [
      applyLocalHostEvent,
      clientId,
      hostUserId,
      registerLocalAsset,
      roomId,
      setLastError,
      storageMode,
      upsertAssetIntoLocalManifest,
      upsertMapAsset,
      userId
    ]
  );

  const handleSetActiveMap = useCallback(
    (assetId: string) => {
      if (storageMode === 'LOCAL') {
        const mapRef: MapRef = isLocalAssetId(assetId)
          ? {
              kind: 'LOCAL_ASSET',
              hash: localAssetHashFromId(assetId)
            }
          : {
              kind: 'CLOUD_ASSET',
              assetId
            };

        if (!userId || !hostUserId) {
          return;
        }

        if (userId === hostUserId) {
          void applyLocalHostEvent({
            type: 'MAP_ACTIVE_SET',
            mapRef
          });
          return;
        }

        sendRelayToHostWithPending(
          {
            type: 'REQUEST_MAP_SET_ACTIVE',
            mapRef
          },
          'MAP'
        );
        return;
      }

      sendClientMessage({
        type: 'ROOM_SET_MAP',
        payload: {
          assetId
        }
      });
    },
    [
      applyLocalHostEvent,
      hostUserId,
      sendClientMessage,
      sendRelayToHostWithPending,
      storageMode,
      userId
    ]
  );

  const ensureDirectoryWritePermission = useCallback(
    async (directoryHandle: unknown): Promise<boolean> => {
      if (!directoryHandle || typeof directoryHandle !== 'object') {
        return false;
      }

      const candidate = directoryHandle as {
        queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<string>;
        requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<string>;
      };

      const descriptor = {
        mode: 'readwrite' as const
      };

      if (typeof candidate.queryPermission === 'function') {
        const current = await candidate.queryPermission(descriptor);
        if (current === 'granted') {
          return true;
        }
      }

      if (typeof candidate.requestPermission === 'function') {
        const requested = await candidate.requestPermission(descriptor);
        return requested === 'granted';
      }

      return true;
    },
    []
  );

  const writeBundleToSelectedDirectory = useCallback(
    async (bundle: Blob, fileName: string): Promise<boolean> => {
      const directoryHandle = autoExportDirectoryHandleRef.current as {
        getFileHandle: (
          name: string,
          options?: { create?: boolean }
        ) => Promise<{
          createWritable: () => Promise<{
            write: (data: Blob) => Promise<void>;
            close: () => Promise<void>;
          }>;
        }>;
      } | null;
      if (!directoryHandle) {
        return false;
      }

      const allowed = await ensureDirectoryWritePermission(directoryHandle);
      if (!allowed) {
        throw new Error('Write permission for the selected auto-export folder was denied.');
      }

      const fileHandle = await directoryHandle.getFileHandle(fileName, {
        create: true
      });
      const writable = await fileHandle.createWritable();
      await writable.write(bundle);
      await writable.close();
      return true;
    },
    [ensureDirectoryWritePermission]
  );

  const handleSelectAutoExportDirectory = useCallback(async () => {
    if (!roomId) {
      return;
    }

    const picker = (
      window as unknown as {
        showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<unknown>;
      }
    ).showDirectoryPicker;

    if (typeof picker !== 'function') {
      setLastError('Directory selection is not supported by this browser.');
      return;
    }

    try {
      const directoryHandle = await picker({
        mode: 'readwrite'
      });
      const allowed = await ensureDirectoryWritePermission(directoryHandle);
      if (!allowed) {
        throw new Error('Write permission for the selected folder was denied.');
      }

      autoExportDirectoryHandleRef.current = directoryHandle;
      const directoryName =
        directoryHandle && typeof directoryHandle === 'object' && 'name' in directoryHandle
          ? String((directoryHandle as { name: unknown }).name)
          : 'Selected folder';

      setAutoExportDirectoryName(directoryName);
      localStorage.setItem(`${AUTO_EXPORT_DIRECTORY_NAME_STORAGE_PREFIX}:${roomId}`, directoryName);
      setLastError(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      setLastError(error instanceof Error ? error.message : 'Could not select auto-export folder');
    }
  }, [ensureDirectoryWritePermission, roomId, setLastError]);

  const handleClearAutoExportDirectory = useCallback(() => {
    if (!roomId) {
      return;
    }

    autoExportDirectoryHandleRef.current = null;
    setAutoExportDirectoryName(null);
    localStorage.removeItem(`${AUTO_EXPORT_DIRECTORY_NAME_STORAGE_PREFIX}:${roomId}`);
  }, [roomId]);

  const exportLocalSessionBundle = useCallback(async () => {
    if (storageMode !== 'LOCAL' || !roomId) {
      return;
    }

    const exported = await localSessionRepository.exportBundle(roomId);
    const timestamp = formatExportTimestamp(new Date());
    const fileName = `${roomId}_${timestamp}.dndvtt.json`;

    let savedInDirectory = false;
    try {
      savedInDirectory = await writeBundleToSelectedDirectory(exported, fileName);
    } catch (error) {
      setLastError(
        error instanceof Error
          ? error.message
          : 'Could not write auto-export file to selected folder'
      );
    }

    if (savedInDirectory) {
      return;
    }

    const downloadUrl = URL.createObjectURL(exported);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(downloadUrl);
  }, [roomId, setLastError, storageMode, writeBundleToSelectedDirectory]);

  const handleExportSession = useCallback(async () => {
    try {
      await exportLocalSessionBundle();
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Could not export local session');
    }
  }, [exportLocalSessionBundle, setLastError]);

  const handleImportSession = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      event.target.value = '';
      if (!selectedFile) {
        return;
      }

      try {
        const imported = await localSessionRepository.importBundle(selectedFile);
        const normalizedSnapshot = normalizeSnapshotAssetManifest(
          RoomSnapshotSchema.parse(imported.snapshot)
        );
        await applySnapshotToUi(normalizedSnapshot);
        void refreshMapAssets();

        if (storageMode === 'LOCAL' && userId && hostUserId && userId === hostUserId) {
          snapshotSentUsersRef.current.clear();
          for (const memberOnline of membersOnline) {
            if (memberOnline.userId === hostUserId) {
              continue;
            }

            sendSnapshotToUser(memberOnline.userId, normalizedSnapshot);
            snapshotSentUsersRef.current.add(memberOnline.userId);
          }
        }
      } catch (error) {
        setLastError(error instanceof Error ? error.message : 'Could not import local session');
      }
    },
    [
      applySnapshotToUi,
      hostUserId,
      membersOnline,
      refreshMapAssets,
      sendSnapshotToUser,
      setLastError,
      storageMode,
      userId
    ]
  );

  useEffect(() => {
    if (
      storageMode !== 'LOCAL' ||
      role !== 'DM' ||
      !roomId ||
      !userId ||
      !hostUserId ||
      userId !== hostUserId
    ) {
      return;
    }

    const autoExportEnabled = localSnapshot?.settings.autoExportEnabled ?? true;
    if (!autoExportEnabled) {
      return;
    }

    const intervalMinutes = localSnapshot?.settings.autoExportIntervalMinutes ?? 30;
    const intervalMs = Math.max(1, intervalMinutes) * 60_000;
    const timerId = window.setInterval(() => {
      void exportLocalSessionBundle().catch((error: unknown) => {
        setLastError(
          error instanceof Error ? error.message : 'Could not auto-export local session'
        );
      });
    }, intervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [
    exportLocalSessionBundle,
    hostUserId,
    localSnapshot?.settings.autoExportEnabled,
    localSnapshot?.settings.autoExportIntervalMinutes,
    role,
    roomId,
    setLastError,
    storageMode,
    userId
  ]);

  const handleBoardSettingsChange = useCallback(
    (patch: Partial<BoardSettings>) => {
      if ((patch.mapEditMode === true || patch.mapCalibrationMode === true) && !canEditMap) {
        setLastError('You do not have map edit permission in this room.');
        return;
      }

      setBoardSettings((previous) => {
        const next = sanitizeBoardSettings({ ...previous, ...patch });

        if (storageMode === 'LOCAL' && userId && hostUserId && userId === hostUserId) {
          const snapshot = localSnapshotRef.current;
          if (snapshot) {
            const nextSettings = LocalSessionSettingsSchema.parse({
              ...snapshot.settings,
              gridType: next.gridType,
              cellSizePx: next.cellSizePx,
              cellDistance: next.cellDistance,
              cellUnit: next.cellUnit,
              gridOriginX: next.gridOriginX,
              gridOriginY: next.gridOriginY,
              gridOriginZ: next.gridOriginZ,
              snapToGrid: next.snapToGrid,
              stackDisplay: next.stackDisplay,
              mapOffsetX: next.mapOffsetX,
              mapOffsetY: next.mapOffsetY,
              mapScale: next.mapScale,
              mapRotationDeg: next.mapRotationDeg
            });

            const hasPersistentChanges =
              nextSettings.gridType !== snapshot.settings.gridType ||
              nextSettings.cellSizePx !== snapshot.settings.cellSizePx ||
              nextSettings.cellDistance !== snapshot.settings.cellDistance ||
              nextSettings.cellUnit !== snapshot.settings.cellUnit ||
              nextSettings.gridOriginX !== snapshot.settings.gridOriginX ||
              nextSettings.gridOriginY !== snapshot.settings.gridOriginY ||
              nextSettings.gridOriginZ !== snapshot.settings.gridOriginZ ||
              nextSettings.snapToGrid !== snapshot.settings.snapToGrid ||
              nextSettings.stackDisplay !== snapshot.settings.stackDisplay ||
              nextSettings.mapOffsetX !== snapshot.settings.mapOffsetX ||
              nextSettings.mapOffsetY !== snapshot.settings.mapOffsetY ||
              nextSettings.mapScale !== snapshot.settings.mapScale ||
              nextSettings.mapRotationDeg !== snapshot.settings.mapRotationDeg;

            if (hasPersistentChanges) {
              scheduleLocalSettingsSync(nextSettings);
            }
          }
        }

        return next;
      });
    },
    [canEditMap, hostUserId, scheduleLocalSettingsSync, setLastError, storageMode, userId]
  );

  const handleMapCalibrationPoint = useCallback(
    (point: { x: number; y: number }) => {
      if (!boardSettings.mapCalibrationMode) {
        return;
      }

      if (!mapCalibrationPointA) {
        setMapCalibrationPointA(point);
        setLastError(null);
        return;
      }

      const deltaX = point.x - mapCalibrationPointA.x;
      const deltaY = point.y - mapCalibrationPointA.y;
      const distance = Math.hypot(deltaX, deltaY);

      if (!Number.isFinite(distance) || distance < 8) {
        setLastError('Calibration points are too close. Select two adjacent map-grid corners.');
        return;
      }

      setBoardSettings((previous) =>
        sanitizeBoardSettings({
          ...previous,
          cellSizePx: Math.round(distance),
          gridOriginX: Math.round(mapCalibrationPointA.x),
          gridOriginY: Math.round(mapCalibrationPointA.y),
          mapCalibrationMode: false
        })
      );
      setMapCalibrationPointA(null);
      setLastError(null);
    },
    [boardSettings.mapCalibrationMode, mapCalibrationPointA, setLastError]
  );

  const prepareMapEditImageAsset = useCallback(
    async (
      file: File,
      kind: 'MAP_EDIT_IMAGE' | 'OBJECT'
    ): Promise<{ imageRef: ImageRef; sourceUrl: string } | null> => {
      if (storageMode === 'LOCAL') {
        if (!roomId || !userId || !hostUserId || userId !== hostUserId) {
          setLastError('In LOCAL mode, map image/object uploads are host-only.');
          return null;
        }

        const registered = await registerLocalAsset({
          blob: file,
          kind,
          label: file.name
        });

        upsertAssetIntoLocalManifest({
          hash: registered.hash,
          mime: file.type || 'application/octet-stream',
          size: file.size,
          kind
        });

        return {
          imageRef: {
            kind: 'LOCAL_ASSET',
            hash: registered.hash
          },
          sourceUrl: URL.createObjectURL(file)
        };
      }

      return {
        imageRef: {
          kind: 'CLOUD_ASSET',
          assetId: `inline:${createLocalEntityId('map-image')}`
        },
        sourceUrl: URL.createObjectURL(file)
      };
    },
    [
      hostUserId,
      registerLocalAsset,
      roomId,
      setLastError,
      storageMode,
      upsertAssetIntoLocalManifest,
      userId
    ]
  );

  useEffect(() => {
    if (!boardSettings.mapCalibrationMode) {
      setMapCalibrationPointA(null);
    }
  }, [boardSettings.mapCalibrationMode]);

  const resolveAssetUrl = useCallback(
    (assetId: string): string | null => {
      if (isLocalAssetId(assetId)) {
        const hash = localAssetHashFromId(assetId);
        return localAssetUrlByHash[hash] ?? null;
      }

      if (!clientId) {
        return null;
      }

      return buildAssetUrl(assetId, clientId);
    },
    [clientId, localAssetUrlByHash]
  );

  if (!roomId) {
    return (
      <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center p-6 text-slate-900 dark:text-slate-100">
        <div className="grid w-full gap-6 md:grid-cols-2">
          <form
            className="rounded border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
            onSubmit={handleCreateRoom}
          >
            <h1 className="text-xl font-semibold">Create Room</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Create a new room and become the DM.
            </p>

            <label className="mt-4 block text-sm text-slate-700 dark:text-slate-300">
              Room Name
              <input
                className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={createRoomName}
                onChange={(event) => setCreateRoomName(event.target.value)}
              />
            </label>

            <label className="mt-3 block text-sm text-slate-700 dark:text-slate-300">
              Display Name
              <input
                className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={createDisplayName}
                onChange={(event) => setCreateDisplayName(event.target.value)}
              />
            </label>

            <label className="mt-3 block text-sm text-slate-700 dark:text-slate-300">
              Storage
              <select
                className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={createStorageMode}
                onChange={(event) => setCreateStorageMode(event.target.value as StorageMode)}
              >
                <option value="LOCAL">Local (Free)</option>
                <option value="CLOUD" disabled>
                  Cloud (coming soon)
                </option>
              </select>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 w-full rounded bg-emerald-700 px-3 py-2 text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Room'}
            </button>
          </form>

          <form
            className="rounded border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
            onSubmit={handleJoinRoom}
          >
            <h2 className="text-xl font-semibold">Join Room</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Join using invite code and pick role.
            </p>

            <label className="mt-4 block text-sm text-slate-700 dark:text-slate-300">
              Join Secret
              <input
                className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 uppercase text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={joinSecretInput}
                onChange={(event) => setJoinSecretInput(event.target.value)}
              />
            </label>

            <label className="mt-3 block text-sm text-slate-700 dark:text-slate-300">
              Display Name
              <input
                className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={joinDisplayName}
                onChange={(event) => setJoinDisplayName(event.target.value)}
              />
            </label>

            <label className="mt-3 block text-sm text-slate-700 dark:text-slate-300">
              Desired Role
              <select
                className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={joinRoleDesired}
                onChange={(event) =>
                  setJoinRoleDesired(event.target.value as 'PLAYER' | 'SPECTATOR')
                }
              >
                <option value="PLAYER">Player</option>
                <option value="SPECTATOR">Spectator</option>
              </select>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 w-full rounded bg-sky-700 px-3 py-2 text-sm font-medium hover:bg-sky-600 disabled:opacity-50"
            >
              {isSubmitting ? 'Joining...' : 'Join Room'}
            </button>
          </form>
        </div>

        {lastError ? (
          <div className="fixed bottom-4 right-4 rounded border border-red-500 bg-red-900/80 px-3 py-2 text-sm text-red-100">
            {lastError}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="w-72 border-r border-slate-300 bg-white p-4 dark:border-slate-800 dark:bg-shell-sidebar">
        <h1 className="text-lg font-semibold">D&D VTT</h1>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">Room: {roomId}</p>
        {joinSecret ? (
          <p className="text-sm text-slate-700 dark:text-slate-300">Invite: {joinSecret}</p>
        ) : null}
        {inviteLink ? (
          <button
            type="button"
            className="mt-1 rounded bg-slate-200 px-2 py-1 text-left text-xs text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            onClick={() => navigator.clipboard?.writeText(inviteLink)}
          >
            Copy Invite Link
          </button>
        ) : null}
        <p className="text-sm text-slate-700 dark:text-slate-300">Role: {role ?? 'n/a'}</p>
        <p className="text-sm text-slate-700 dark:text-slate-300">Connection: {connectionStatus}</p>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Storage: {storageMode ?? 'n/a'}
        </p>
        {storageMode === 'LOCAL' ? (
          <p className="text-xs text-amber-600 dark:text-amber-300">
            LOCAL mode: Host (DM) must stay online.
          </p>
        ) : null}
        {isWaitingForHostSnapshot ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-200">
            Waiting for host snapshot...
          </p>
        ) : null}
        {storageMode === 'LOCAL' && !isLocalHostUser && showSlowHostConfirmationHint ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-200">
            Waiting for host confirmation... ({slowHostConfirmationSeconds}s)
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="rounded bg-slate-200 px-3 py-2 text-xs hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
            onClick={toggleTheme}
          >
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button
            type="button"
            className="rounded bg-slate-200 px-3 py-2 text-xs hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
            onClick={() => {
              clearRoom();
              setJoinSecretInput('');
            }}
          >
            Leave
          </button>
        </div>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Presence
        </h2>
        <ul className="mt-2 space-y-1">
          {membersOnline.map((memberOnline) => (
            <li
              key={memberOnline.userId}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            >
              {memberOnline.displayName} ({memberOnline.role})
            </li>
          ))}
          {membersOnline.length === 0 ? (
            <li className="text-sm text-slate-500">No members online</li>
          ) : null}
        </ul>
      </aside>

      <main className="flex-1 bg-slate-200 p-4 dark:bg-shell-board">
        <BoardCanvas
          mapImageUrl={currentMapUrl}
          tokens={tokens}
          canCreateToken={canCreateTokens}
          canEditToken={canEditToken}
          canEditMap={canEditMap}
          optimisticMapEdit={canUseOptimisticLocalState}
          canMoveToken={canModifyToken}
          boardSettings={boardSettings}
          resolveAssetUrl={resolveAssetUrl}
          mapEditSnapshot={mapEditSnapshot}
          mapEditRemoteEvents={mapEditRemoteEvents}
          onBoardSettingsChange={handleBoardSettingsChange}
          onMapCalibrationPoint={handleMapCalibrationPoint}
          prepareMapEditImageAsset={prepareMapEditImageAsset}
          onCreateToken={handleCreateToken}
          onUpdateToken={handleUpdateToken}
          onDeleteToken={handleDeleteTokenById}
          tokenEditRequest={tokenEditRequest}
          onMoveToken={handleMoveToken}
          onMapEditOperations={handleMapEditOperations}
        />
      </main>

      <aside className="w-96 border-l border-slate-300 bg-white p-4 dark:border-slate-800 dark:bg-shell-panel">
        <ChatPanel
          storageMode={storageMode}
          role={role}
          userId={userId}
          hostUserId={hostUserId}
          members={members}
          membersOnline={membersOnline}
          isWaitingForHostSnapshot={isWaitingForHostSnapshot}
          isLocalNonHostBlockedByOfflineHost={isLocalNonHostBlockedByOfflineHost}
          messages={chatMessages}
          composeKind={role === 'DM' ? chatComposeKind : 'PUBLIC'}
          composeRecipients={role === 'DM' ? chatComposeRecipients : []}
          attachmentUrlByHash={localAssetUrlByHash}
          attachmentTransferByHash={chatAttachmentTransferByHash}
          onComposeKindChange={handleChatComposeKindChange}
          onComposeRecipientsChange={setChatComposeRecipients}
          onPrepareAttachment={prepareChatAttachment}
          onRequestAttachmentDownload={(attachment) => {
            void requestChatAttachmentDownload(attachment);
          }}
          onOpenAttachment={(attachment) => {
            void openChatAttachment(attachment);
          }}
          onDownloadAttachment={(attachment) => {
            void openChatAttachment(attachment, {
              download: true
            });
          }}
          onSendMessage={handleSendChatMessage}
        />

        <button
          type="button"
          className="mt-3 w-full rounded bg-slate-200 px-3 py-2 text-left text-sm font-semibold hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
          onClick={() => setIsRoomSettingsOpen((previous) => !previous)}
        >
          {isRoomSettingsOpen ? 'Hide Room Settings' : 'Open Room Settings'}
        </button>

        {isRoomSettingsOpen ? (
          <div className="mt-3 space-y-3">
            {role === 'DM' && settings ? (
              <div className="space-y-3 rounded border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Rights Menu
                </h3>

                <label className="block text-sm text-slate-700 dark:text-slate-300">
                  Token Move Policy
                  <select
                    value={settings.tokenMovePolicy}
                    onChange={handleTokenMovePolicyChange}
                    className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {tokenMovePolicies.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                {storageMode === 'LOCAL' ? (
                  <label className="block text-sm text-slate-700 dark:text-slate-300">
                    Token Edit Policy
                    <select
                      value={localTokenEditPolicy}
                      onChange={handleTokenEditPolicyChange}
                      className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {tokenEditPolicies.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className="block text-sm text-slate-700 dark:text-slate-300">
                  Map Edit (Default for Players)
                  <select
                    value={settings.mapEditPolicy}
                    onChange={handleMapEditPolicyChange}
                    className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {mapEditPolicies.map((value) => (
                      <option key={value} value={value}>
                        {value === 'DM_ONLY' ? 'DM only' : 'All players'}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Per-Member Map Edit Override
                  </p>
                  <ul className="mt-2 space-y-1">
                    {members.map((roomMember) => {
                      const enabled = resolveMapEditAccessForMember({
                        memberRole: roomMember.role,
                        memberUserId: roomMember.userId,
                        settings
                      });

                      return (
                        <li
                          key={`${roomMember.roomId}-${roomMember.userId}-rights`}
                          className="flex items-center justify-between gap-2 rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                        >
                          <span className="min-w-0 truncate">
                            {roomMember.displayName} ({roomMember.role})
                          </span>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={enabled}
                              disabled={roomMember.role === 'DM'}
                              onChange={(event) =>
                                handleMemberMapEditPermissionChange(
                                  roomMember.userId,
                                  roomMember.role,
                                  event.target.checked
                                )
                              }
                            />
                            <span>{enabled ? 'Allowed' : 'Blocked'}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {storageMode === 'LOCAL' ? (
                  <div className="space-y-2 rounded border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={localAutoExportEnabled}
                        onChange={handleAutoExportEnabledChange}
                      />
                      Auto Export Enabled
                    </label>

                    <label className="block text-sm text-slate-700 dark:text-slate-300">
                      Auto Export Interval (min)
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={localAutoExportIntervalMinutes}
                        onChange={handleAutoExportIntervalChange}
                        disabled={!localAutoExportEnabled}
                        className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-600"
                        onClick={() => {
                          void handleSelectAutoExportDirectory();
                        }}
                      >
                        Select Export Folder
                      </button>
                      <button
                        type="button"
                        className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-600 disabled:opacity-50"
                        disabled={!autoExportDirectoryName}
                        onClick={handleClearAutoExportDirectory}
                      >
                        Clear Folder
                      </button>
                    </div>

                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      Folder:{' '}
                      {autoExportDirectoryName ?? 'Not selected (fallback: browser download)'}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      Interval range: 1-120 minutes. Default: 30 minutes.
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded border border-slate-300 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <p>Only DM can change room rights.</p>
                {settings ? (
                  <p className="mt-1">Your map edit access: {canEditMap ? 'allowed' : 'blocked'}</p>
                ) : null}
              </div>
            )}

            <div className="space-y-3 rounded border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Board Settings
              </h3>

              <label className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Grid Type
                <select
                  value={boardSettings.gridType}
                  onChange={(event) =>
                    handleBoardSettingsChange({
                      gridType: event.target.value as BoardSettings['gridType']
                    })
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                >
                  <option value="SQUARE">Square</option>
                  <option value="HEX">Hex</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Cell Size (px)
                  <input
                    type="number"
                    min={24}
                    max={160}
                    value={boardSettings.cellSizePx}
                    onChange={(event) =>
                      handleBoardSettingsChange({
                        cellSizePx: Number.parseInt(event.target.value, 10)
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                  />
                </label>

                <label className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Cell Distance
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={boardSettings.cellDistance}
                    onChange={(event) =>
                      handleBoardSettingsChange({
                        cellDistance: Number.parseFloat(event.target.value)
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Unit
                  <select
                    value={boardSettings.cellUnit}
                    onChange={(event) =>
                      handleBoardSettingsChange({
                        cellUnit: event.target.value as BoardSettings['cellUnit']
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                  >
                    <option value="ft">ft</option>
                    <option value="m">m</option>
                  </select>
                </label>

                <label className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Stack Display
                  <select
                    value={boardSettings.stackDisplay}
                    onChange={(event) =>
                      handleBoardSettingsChange({
                        stackDisplay: event.target.value as BoardSettings['stackDisplay']
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                  >
                    <option value="FAN">Fan</option>
                    <option value="EXACT">Exact</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Origin X (px)
                  <input
                    type="number"
                    value={boardSettings.gridOriginX}
                    onChange={(event) =>
                      handleBoardSettingsChange({
                        gridOriginX: Number.parseFloat(event.target.value)
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                  />
                </label>

                <label className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Origin Y (px)
                  <input
                    type="number"
                    value={boardSettings.gridOriginY}
                    onChange={(event) =>
                      handleBoardSettingsChange({
                        gridOriginY: Number.parseFloat(event.target.value)
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                  />
                </label>

                <label className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Origin Z
                  <input
                    type="number"
                    value={boardSettings.gridOriginZ}
                    onChange={(event) =>
                      handleBoardSettingsChange({
                        gridOriginZ: Number.parseFloat(event.target.value)
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={boardSettings.snapToGrid}
                  onChange={(event) =>
                    handleBoardSettingsChange({
                      snapToGrid: event.target.checked
                    })
                  }
                />
                Snap tokens to grid
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={boardSettings.mapEditMode}
                  disabled={!canEditMap}
                  onChange={(event) =>
                    handleBoardSettingsChange({
                      mapEditMode: event.target.checked
                    })
                  }
                />
                Map edit mode
              </label>
              {!canEditMap ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  You currently do not have permission to edit the map.
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Map X
                  <input
                    type="number"
                    value={Math.round(boardSettings.mapOffsetX)}
                    onChange={(event) =>
                      handleBoardSettingsChange({
                        mapOffsetX: Number.parseFloat(event.target.value)
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                  />
                </label>

                <label className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Map Y
                  <input
                    type="number"
                    value={Math.round(boardSettings.mapOffsetY)}
                    onChange={(event) =>
                      handleBoardSettingsChange({
                        mapOffsetY: Number.parseFloat(event.target.value)
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Map Scale
                  <input
                    type="number"
                    step={0.05}
                    min={0.1}
                    max={6}
                    value={boardSettings.mapScale}
                    onChange={(event) =>
                      handleBoardSettingsChange({
                        mapScale: Number.parseFloat(event.target.value)
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                  />
                </label>

                <label className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Map Rotation
                  <input
                    type="number"
                    min={-180}
                    max={180}
                    value={boardSettings.mapRotationDeg}
                    onChange={(event) =>
                      handleBoardSettingsChange({
                        mapRotationDeg: Number.parseFloat(event.target.value)
                      })
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                  />
                </label>
              </div>

              <div className="rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  className="w-full rounded bg-sky-700 px-2 py-1 text-slate-100 hover:bg-sky-600 disabled:opacity-40"
                  disabled={!canEditMap}
                  onClick={() =>
                    handleBoardSettingsChange({
                      mapCalibrationMode: !boardSettings.mapCalibrationMode
                    })
                  }
                >
                  {boardSettings.mapCalibrationMode
                    ? 'Stop Grid Calibration'
                    : 'Calibrate Grid From Map Cell'}
                </button>
                <p className="mt-2 text-slate-600 dark:text-slate-300">
                  {boardSettings.mapCalibrationMode
                    ? mapCalibrationPointA
                      ? 'Step 2: left-click an adjacent corner of the same map cell.'
                      : 'Step 1: left-click a map-grid corner.'
                    : 'Pick two adjacent map-grid corners to auto-fit cell size and grid origin.'}
                </p>
                {mapCalibrationPointA ? (
                  <button
                    type="button"
                    className="mt-2 rounded bg-slate-200 px-2 py-1 text-xs text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                    onClick={() => setMapCalibrationPointA(null)}
                  >
                    Reset First Calibration Point
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">Maps</h3>
        {storageMode === 'LOCAL' && role === 'DM' ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded bg-slate-700 px-2 py-2 text-xs text-slate-100 hover:bg-slate-600"
              onClick={() => {
                void handleExportSession();
              }}
            >
              Export Session
            </button>
            <button
              type="button"
              className="rounded bg-slate-700 px-2 py-2 text-xs text-slate-100 hover:bg-slate-600"
              onClick={() => importSessionInputRef.current?.click()}
            >
              Import Session
            </button>
            <input
              ref={importSessionInputRef}
              type="file"
              accept="application/json,.json,.dndvtt.json"
              className="hidden"
              onChange={handleImportSession}
            />
          </div>
        ) : null}
        <label className="mt-2 block cursor-pointer rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
          <span>{isUploadingMap ? 'Uploading...' : 'Upload Map (PNG/JPG/WebP)'}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={isUploadingMap || !canSetActiveMap}
            onChange={handleMapUpload}
          />
        </label>
        {!canSetActiveMap ? (
          <p className="mt-1 text-xs text-slate-500">Only DM/Host can upload and activate maps.</p>
        ) : null}

        <p className="mt-2 text-xs text-slate-400">
          Current map: {currentMapAsset ? currentMapAsset.originalName : 'None'}
        </p>

        <ul className="mt-2 space-y-1">
          {mapAssets.map((asset) => {
            const isActive = asset.id === currentMapAssetId;

            return (
              <li
                key={asset.id}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-slate-900 dark:text-slate-100">
                      {asset.originalName}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {Math.round(asset.size / 1024)} KB
                    </p>
                  </div>

                  {canSetActiveMap ? (
                    <button
                      type="button"
                      className="rounded bg-emerald-800 px-2 py-1 text-xs disabled:opacity-40"
                      onClick={() => handleSetActiveMap(asset.id)}
                      disabled={isActive}
                    >
                      {isActive ? 'Active' : 'Set Active'}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">
                      {isActive ? 'Active' : 'View only'}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
          {mapAssets.length === 0 ? (
            <li className="text-sm text-slate-500">No maps uploaded</li>
          ) : null}
        </ul>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Members
        </h3>
        <ul className="mt-2 space-y-1">
          {members.map((roomMember) => (
            <li
              key={`${roomMember.roomId}-${roomMember.userId}`}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            >
              {roomMember.displayName} ({roomMember.role})
            </li>
          ))}
        </ul>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Tokens
        </h3>
        <ul className="mt-2 space-y-1">
          {tokens.map((token) => {
            const gridPosition = toGridCoordinates(
              token.x,
              token.y,
              token.elevation,
              {
                gridType: boardSettings.gridType,
                cellSizePx: boardSettings.cellSizePx,
                gridOriginX: boardSettings.gridOriginX,
                gridOriginY: boardSettings.gridOriginY,
                gridOriginZ: boardSettings.gridOriginZ
              },
              mapCoordinateFrame
            );

            return (
              <li
                key={token.id}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {token.name} [{token.kind}] ({gridPosition.x}, {gridPosition.y},{' '}
                    {gridPosition.z})
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded bg-sky-800 px-2 py-1 text-xs disabled:opacity-40"
                      onClick={() =>
                        setTokenEditRequest({
                          tokenId: token.id,
                          requestId: `${token.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
                        })
                      }
                      disabled={!canEditToken(token)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded bg-rose-800 px-2 py-1 text-xs disabled:opacity-40"
                      onClick={() => handleDeleteToken(token)}
                      disabled={!canModifyToken(token)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
          {tokens.length === 0 ? <li className="text-sm text-slate-500">No tokens yet</li> : null}
        </ul>

        {editingToken ? (
          <div className="mt-4 rounded border border-slate-700 bg-slate-900 p-3 text-slate-100">
            <h4 className="text-sm font-semibold">Edit Token</h4>
            <label className="mt-2 block text-xs uppercase tracking-wide text-slate-400">
              Name
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                value={editingToken.draft.name}
                onChange={(event) =>
                  setEditingToken((previous) =>
                    previous
                      ? {
                          ...previous,
                          draft: {
                            ...previous.draft,
                            name: event.target.value
                          }
                        }
                      : previous
                  )
                }
              />
            </label>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block text-xs uppercase tracking-wide text-slate-400">
                Faction
                <select
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                  value={editingToken.draft.kind}
                  onChange={(event) => {
                    const nextKind = event.target.value as TokenDraft['kind'];
                    setEditingToken((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: {
                              ...previous.draft,
                              kind: nextKind,
                              color:
                                !previous.draft.color ||
                                previous.draft.color.toLowerCase() ===
                                  defaultColorForKind(previous.draft.kind).toLowerCase()
                                  ? defaultColorForKind(nextKind)
                                  : previous.draft.color
                            }
                          }
                        : previous
                    );
                  }}
                >
                  <option value="ALLY">Ally</option>
                  <option value="ENEMY">Enemy</option>
                  <option value="NEUTRAL">Neutral</option>
                </select>
              </label>

              <label className="block text-xs uppercase tracking-wide text-slate-400">
                Elevation
                <input
                  type="number"
                  min={0}
                  max={999}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                  value={editingToken.draft.elevation}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    setEditingToken((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: {
                              ...previous.draft,
                              elevation: Number.isFinite(parsed)
                                ? Math.min(Math.max(parsed, 0), 999)
                                : 0
                            }
                          }
                        : previous
                    );
                  }}
                />
              </label>
            </div>

            <label className="mt-2 block text-xs uppercase tracking-wide text-slate-400">
              Color
              <input
                type="color"
                className="mt-1 h-10 w-full rounded border border-slate-700 bg-slate-800 p-1"
                value={editingToken.draft.color ?? defaultColorForKind(editingToken.draft.kind)}
                onChange={(event) =>
                  setEditingToken((previous) =>
                    previous
                      ? {
                          ...previous,
                          draft: {
                            ...previous.draft,
                            color: event.target.value
                          }
                        }
                      : previous
                  )
                }
              />
              <button
                type="button"
                className="mt-1 text-[11px] text-slate-300 underline decoration-slate-500 hover:text-slate-100"
                onClick={() =>
                  setEditingToken((previous) =>
                    previous
                      ? {
                          ...previous,
                          draft: {
                            ...previous.draft,
                            color: defaultColorForKind(previous.draft.kind)
                          }
                        }
                      : previous
                  )
                }
              >
                Use faction default color
              </button>
            </label>

            <label className="mt-2 block text-xs uppercase tracking-wide text-slate-400">
              Replace Image (optional)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="mt-1 block w-full text-xs text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100 hover:file:bg-slate-600"
                onChange={(event) =>
                  setEditingToken((previous) =>
                    previous
                      ? {
                          ...previous,
                          imageFile: event.target.files?.[0] ?? null
                        }
                      : previous
                  )
                }
              />
            </label>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block text-xs uppercase tracking-wide text-slate-400">
                Image Offset X
                <input
                  type="number"
                  min={-500}
                  max={500}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                  value={Math.round(editingToken.draft.imageOffsetX)}
                  onChange={(event) =>
                    setEditingToken((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: {
                              ...previous.draft,
                              imageOffsetX: Number.isFinite(Number.parseFloat(event.target.value))
                                ? Math.max(
                                    -500,
                                    Math.min(500, Number.parseFloat(event.target.value))
                                  )
                                : 0
                            }
                          }
                        : previous
                    )
                  }
                />
              </label>

              <label className="block text-xs uppercase tracking-wide text-slate-400">
                Image Offset Y
                <input
                  type="number"
                  min={-500}
                  max={500}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                  value={Math.round(editingToken.draft.imageOffsetY)}
                  onChange={(event) =>
                    setEditingToken((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: {
                              ...previous.draft,
                              imageOffsetY: Number.isFinite(Number.parseFloat(event.target.value))
                                ? Math.max(
                                    -500,
                                    Math.min(500, Number.parseFloat(event.target.value))
                                  )
                                : 0
                            }
                          }
                        : previous
                    )
                  }
                />
              </label>

              <label className="block text-xs uppercase tracking-wide text-slate-400">
                Image Scale
                <input
                  type="number"
                  step={0.05}
                  min={0.1}
                  max={6}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                  value={editingToken.draft.imageScale}
                  onChange={(event) =>
                    setEditingToken((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: {
                              ...previous.draft,
                              imageScale: Number.isFinite(Number.parseFloat(event.target.value))
                                ? Math.max(0.1, Math.min(6, Number.parseFloat(event.target.value)))
                                : 1
                            }
                          }
                        : previous
                    )
                  }
                />
              </label>

              <label className="block text-xs uppercase tracking-wide text-slate-400">
                Image Rotation
                <input
                  type="number"
                  min={-180}
                  max={180}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                  value={editingToken.draft.imageRotationDeg}
                  onChange={(event) =>
                    setEditingToken((previous) =>
                      previous
                        ? {
                            ...previous,
                            draft: {
                              ...previous.draft,
                              imageRotationDeg: Number.isFinite(
                                Number.parseFloat(event.target.value)
                              )
                                ? Math.max(
                                    -180,
                                    Math.min(180, Number.parseFloat(event.target.value))
                                  )
                                : 0
                            }
                          }
                        : previous
                    )
                  }
                />
              </label>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded bg-emerald-700 px-3 py-2 text-xs hover:bg-emerald-600 disabled:opacity-50"
                onClick={() => {
                  void handleSaveTokenEdit();
                }}
                disabled={isSavingTokenEdit || editingToken.draft.name.trim().length === 0}
              >
                {isSavingTokenEdit ? 'Saving...' : 'Save Token'}
              </button>
              <button
                type="button"
                className="flex-1 rounded bg-slate-700 px-3 py-2 text-xs hover:bg-slate-600"
                onClick={() => setEditingToken(null)}
                disabled={isSavingTokenEdit}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {lastError ? (
          <div className="mt-4 rounded border border-red-500 bg-red-900/70 px-3 py-2 text-sm text-red-100">
            {lastError}
          </div>
        ) : null}
      </aside>
    </div>
  );
};
