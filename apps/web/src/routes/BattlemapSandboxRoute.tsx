import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ImageRef,
  MapEditOperation,
  MapEditOpsAppliedMessage,
  MapEditSnapshot,
  VttToken
} from '@dnd-vtt/shared';
import { Link } from 'react-router-dom';

import { BoardCanvas } from '../components/BoardCanvas';
import {
  DEFAULT_BOARD_SETTINGS,
  sanitizeBoardSettings,
  type BoardSettings,
  type TokenDraft
} from '../components/boardTypes';

const createSandboxId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
};

const applyMapEditOperations = (
  previousElements: MapEditSnapshot['elements'],
  operations: MapEditOperation[]
): MapEditSnapshot['elements'] => {
  let nextElements = [...previousElements];

  for (const operation of operations) {
    if (operation.kind === 'CLEAR') {
      nextElements = [];
      continue;
    }

    if (operation.kind === 'DELETE') {
      const ids = new Set(operation.elementIds);
      nextElements = nextElements.filter((element) => !ids.has(element.id));
      continue;
    }

    const byId = new Map(nextElements.map((element, index) => [element.id, index]));
    for (const element of operation.elements) {
      const index = byId.get(element.id);
      if (index === undefined) {
        nextElements.push(element);
      } else {
        nextElements[index] = element;
      }
    }
  }

  return nextElements;
};

type RegisteredAsset = {
  assetId: string;
  imageRef: ImageRef;
  sourceUrl: string;
};

const createTokenFromDraft = (args: {
  x: number;
  y: number;
  draft: TokenDraft;
  assetId: string | null;
  imageRef: ImageRef | null;
}): VttToken => {
  const now = new Date().toISOString();

  return {
    id: createSandboxId('token'),
    roomId: 'sandbox-room',
    name: args.draft.name.trim() || 'Token',
    x: args.x,
    y: args.y,
    size: 1,
    assetId: args.assetId,
    imageRef: args.imageRef,
    kind: args.draft.kind,
    color: args.draft.color,
    elevation: args.draft.elevation,
    imageOffsetX: args.draft.imageOffsetX,
    imageOffsetY: args.draft.imageOffsetY,
    imageScale: args.draft.imageScale,
    imageRotationDeg: args.draft.imageRotationDeg,
    controlledBy: {
      mode: 'ALL'
    },
    createdAt: now,
    updatedAt: now
  };
};

export const BattlemapSandboxRoute = () => {
  const [tokens, setTokens] = useState<VttToken[]>([]);
  const [boardSettings, setBoardSettings] = useState<BoardSettings>(DEFAULT_BOARD_SETTINGS);
  const [mapEditSnapshot, setMapEditSnapshot] = useState<MapEditSnapshot>({
    revision: 0,
    elements: []
  });
  const [assetUrlById, setAssetUrlById] = useState<Record<string, string>>({});
  const registeredBlobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      for (const blobUrl of registeredBlobUrlsRef.current) {
        URL.revokeObjectURL(blobUrl);
      }
      registeredBlobUrlsRef.current = [];
    };
  }, []);

  const registerAssetFile = useCallback((file: File): RegisteredAsset => {
    const assetId = createSandboxId('sandbox-asset');
    const sourceUrl = URL.createObjectURL(file);
    registeredBlobUrlsRef.current.push(sourceUrl);
    setAssetUrlById((previous) => ({
      ...previous,
      [assetId]: sourceUrl
    }));

    return {
      assetId,
      imageRef: {
        kind: 'CLOUD_ASSET',
        assetId
      },
      sourceUrl
    };
  }, []);

  const resolveAssetUrl = useCallback(
    (assetId: string): string | null => {
      return assetUrlById[assetId] ?? null;
    },
    [assetUrlById]
  );

  const canEditToken = useCallback(() => true, []);
  const canMoveToken = useCallback(() => true, []);

  const mapEditRemoteEvents = useMemo<MapEditOpsAppliedMessage['payload'][]>(() => [], []);

  const handleCreateToken = useCallback(
    async (x: number, y: number, draft: TokenDraft, imageFile?: File | null) => {
      let assetId: string | null = null;
      let imageRef: ImageRef | null = null;

      if (imageFile) {
        const registered = registerAssetFile(imageFile);
        assetId = registered.assetId;
        imageRef = registered.imageRef;
      }

      const token = createTokenFromDraft({
        x,
        y,
        draft,
        assetId,
        imageRef
      });

      setTokens((previous) => [...previous.filter((entry) => entry.id !== token.id), token]);
    },
    [registerAssetFile]
  );

  const handleUpdateToken = useCallback(
    async (tokenId: string, draft: TokenDraft, imageFile?: File | null) => {
      setTokens((previous) => {
        const current = previous.find((entry) => entry.id === tokenId);
        if (!current) {
          return previous;
        }

        let nextAssetId = current.assetId;
        let nextImageRef = current.imageRef ?? null;

        if (imageFile) {
          const registered = registerAssetFile(imageFile);
          nextAssetId = registered.assetId;
          nextImageRef = registered.imageRef;
        }

        const updatedAt = new Date().toISOString();
        const nextToken: VttToken = {
          ...current,
          name: draft.name.trim() || 'Token',
          kind: draft.kind,
          color: draft.color,
          elevation: draft.elevation,
          imageOffsetX: draft.imageOffsetX,
          imageOffsetY: draft.imageOffsetY,
          imageScale: draft.imageScale,
          imageRotationDeg: draft.imageRotationDeg,
          assetId: nextAssetId,
          imageRef: nextImageRef,
          updatedAt
        };

        return previous.map((entry) => (entry.id === tokenId ? nextToken : entry));
      });
    },
    [registerAssetFile]
  );

  const handleDeleteToken = useCallback((tokenId: string) => {
    setTokens((previous) => previous.filter((entry) => entry.id !== tokenId));
  }, []);

  const handleMoveToken = useCallback(
    (tokenId: string, x: number, y: number, _options: { final: boolean }) => {
      setTokens((previous) =>
        previous.map((entry) =>
          entry.id === tokenId
            ? {
                ...entry,
                x,
                y,
                updatedAt: new Date().toISOString()
              }
            : entry
        )
      );
    },
    []
  );

  const handleMapEditOperations = useCallback((operations: MapEditOperation[]) => {
    setMapEditSnapshot((previous) => ({
      revision: previous.revision + 1,
      elements: applyMapEditOperations(previous.elements, operations)
    }));
  }, []);

  const handleBoardSettingsChange = useCallback((patch: Partial<BoardSettings>) => {
    setBoardSettings((previous) => sanitizeBoardSettings({ ...previous, ...patch }));
  }, []);

  const prepareMapEditImageAsset = useCallback(
    async (file: File) => {
      const registered = registerAssetFile(file);
      return {
        imageRef: registered.imageRef,
        sourceUrl: registered.sourceUrl
      };
    },
    [registerAssetFile]
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-300">Out-of-Game Testing</p>
            <h1 className="text-lg font-semibold tracking-tight">Battlemap Sandbox</h1>
            <p className="text-xs text-slate-400">
              Local-only board for testing. No room creation, no room join, no signaling.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
            >
              Back to Home
            </Link>
            <Link
              to="/vtt"
              className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Open In-game VTT
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 bg-slate-200 p-3 dark:bg-shell-board sm:p-4">
        <BoardCanvas
          mapImageUrl={null}
          tokens={tokens}
          canCreateToken={true}
          canEditToken={canEditToken}
          canEditMap={true}
          optimisticMapEdit={true}
          mapEditSnapshot={mapEditSnapshot}
          mapEditRemoteEvents={mapEditRemoteEvents}
          canMoveToken={canMoveToken}
          boardSettings={boardSettings}
          resolveAssetUrl={resolveAssetUrl}
          onBoardSettingsChange={handleBoardSettingsChange}
          onCreateToken={handleCreateToken}
          onUpdateToken={handleUpdateToken}
          onDeleteToken={handleDeleteToken}
          tokenEditRequest={null}
          onMoveToken={handleMoveToken}
          onMapEditOperations={handleMapEditOperations}
          prepareMapEditImageAsset={prepareMapEditImageAsset}
        />
      </main>
    </div>
  );
};
