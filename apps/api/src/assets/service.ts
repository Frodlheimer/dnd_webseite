import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { AssetType, RoomAsset } from '@dnd-vtt/shared';

import { extensionForMime, toSharedAsset, UPLOADS_DIR } from './model.js';
import { AssetValidationError, validateImageUpload } from './validation.js';
import { prisma } from '../db/prisma.js';
import { assertCloudStateAccessForRoom } from '../rooms/localStrict.js';

export class AssetServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AssetServiceError';
  }
}

const ensureUploadsDir = async (): Promise<void> => {
  await fs.mkdir(UPLOADS_DIR, {
    recursive: true
  });
};

export const resolveAssetPath = (storageKey: string): string => {
  return path.join(UPLOADS_DIR, storageKey);
};

export const createAssetForRoom = async (args: {
  roomId: string;
  ownerUserId: string;
  type: AssetType;
  mime: string;
  size: number;
  originalName: string;
  fileBuffer: Buffer;
}): Promise<RoomAsset> => {
  await assertCloudStateAccessForRoom({
    roomId: args.roomId,
    operation: 'Asset.create'
  });

  validateImageUpload({
    type: args.type,
    mime: args.mime,
    size: args.size
  });

  await ensureUploadsDir();

  const extension = extensionForMime(args.mime);
  const storageKey = `${randomUUID()}.${extension}`;
  const filePath = resolveAssetPath(storageKey);

  await fs.writeFile(filePath, args.fileBuffer);

  try {
    const createdAsset = await prisma.asset.create({
      data: {
        roomId: args.roomId,
        ownerUserId: args.ownerUserId,
        type: args.type,
        mime: args.mime,
        size: args.size,
        originalName: args.originalName,
        storageKey
      }
    });

    return toSharedAsset(createdAsset);
  } catch (error) {
    await fs.unlink(filePath).catch(() => {
      // Best-effort cleanup when DB insert fails.
    });

    throw error;
  }
};

export const createMapAssetForRoom = async (args: {
  roomId: string;
  ownerUserId: string;
  mime: string;
  size: number;
  originalName: string;
  fileBuffer: Buffer;
}): Promise<RoomAsset> => {
  return createAssetForRoom({
    ...args,
    type: 'MAP'
  });
};

export const listRoomAssets = async (args: {
  roomId: string;
  type?: AssetType;
}): Promise<RoomAsset[]> => {
  await assertCloudStateAccessForRoom({
    roomId: args.roomId,
    operation: 'Asset.findMany'
  });

  const assets = await prisma.asset.findMany({
    where: args.type
      ? {
          roomId: args.roomId,
          type: args.type
        }
      : {
          roomId: args.roomId
        },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return assets.map((asset) => toSharedAsset(asset));
};

export const getAssetById = async (assetId: string) => {
  const asset = await prisma.asset.findUnique({
    where: {
      id: assetId
    }
  });

  if (!asset) {
    throw new AssetServiceError('ASSET_NOT_FOUND', 404, 'Asset not found');
  }

  await assertCloudStateAccessForRoom({
    roomId: asset.roomId,
    operation: 'Asset.findUnique'
  });

  return asset;
};

export const ensureMapAssetForRoom = async (args: {
  roomId: string;
  assetId: string;
}): Promise<RoomAsset> => {
  await assertCloudStateAccessForRoom({
    roomId: args.roomId,
    operation: 'Asset.findFirst'
  });

  const asset = await prisma.asset.findFirst({
    where: {
      id: args.assetId,
      roomId: args.roomId,
      type: 'MAP'
    }
  });

  if (!asset) {
    throw new AssetServiceError('ASSET_NOT_FOUND', 404, 'MAP asset not found in this room');
  }

  return toSharedAsset(asset);
};

export { AssetValidationError };
