import path from 'node:path';

import { RoomAssetSchema, type RoomAsset } from '@dnd-vtt/shared';
import type { AssetType } from '@prisma/client';

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

const MIME_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
};

export const extensionForMime = (mime: string): string => {
  return MIME_EXTENSION[mime] ?? 'bin';
};

export const toSharedAsset = (asset: {
  id: string;
  roomId: string;
  ownerUserId: string | null;
  type: AssetType;
  mime: string;
  size: number;
  originalName: string;
  storageKey: string;
  createdAt: Date;
}): RoomAsset => {
  return RoomAssetSchema.parse({
    id: asset.id,
    roomId: asset.roomId,
    ownerUserId: asset.ownerUserId,
    type: asset.type,
    mime: asset.mime,
    size: asset.size,
    originalName: asset.originalName,
    storageKey: asset.storageKey,
    createdAt: asset.createdAt.toISOString()
  });
};
