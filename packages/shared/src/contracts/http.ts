import { z } from 'zod';

import {
  AssetIdSchema,
  AssetTypeSchema,
  RoomAssetSchema,
  RoomIdSchema,
  RoomMemberSchema,
  RoomSettingsSchema,
  StorageModeSchema,
  TokenSchema
} from '../domain/room';
import { RoleSchema } from '../domain/roles';

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  version: z.string().min(1),
  time: z.string().datetime()
});

export const CreateRoomRequestSchema = z.object({
  name: z.string().min(1).max(120),
  displayName: z.string().min(1).max(80),
  clientId: z.string().min(1),
  storageMode: StorageModeSchema.optional()
});

const CreateRoomResponseBaseSchema = z.object({
  roomId: RoomIdSchema,
  joinSecret: z.string().min(4).max(32),
  hostUserId: z.string().min(1),
  wsUrl: z.string().url(),
  roleAssigned: RoleSchema,
  member: RoomMemberSchema
});

export const CreateRoomResponseSchema = z.discriminatedUnion('storageMode', [
  CreateRoomResponseBaseSchema.extend({
    storageMode: z.literal('LOCAL')
  }),
  CreateRoomResponseBaseSchema.extend({
    storageMode: z.literal('CLOUD'),
    member: RoomMemberSchema,
    settings: RoomSettingsSchema,
    tokens: z.array(TokenSchema),
    members: z.array(RoomMemberSchema),
    currentMapAssetId: AssetIdSchema.nullable(),
    currentMapAsset: RoomAssetSchema.nullable()
  })
]);

export const JoinRoomRequestSchema = z.object({
  joinSecret: z.string().min(4).max(32),
  displayName: z.string().min(1).max(80),
  clientId: z.string().min(1),
  roleDesired: z.enum(['PLAYER', 'SPECTATOR']).optional()
});

const JoinRoomResponseBaseSchema = z.object({
  roomId: RoomIdSchema,
  hostUserId: z.string().min(1),
  wsUrl: z.string().url(),
  roleAssigned: RoleSchema,
  member: RoomMemberSchema
});

export const JoinRoomResponseSchema = z.discriminatedUnion('storageMode', [
  JoinRoomResponseBaseSchema.extend({
    storageMode: z.literal('LOCAL')
  }),
  JoinRoomResponseBaseSchema.extend({
    storageMode: z.literal('CLOUD'),
    member: RoomMemberSchema,
    settings: RoomSettingsSchema,
    tokens: z.array(TokenSchema),
    members: z.array(RoomMemberSchema),
    currentMapAssetId: AssetIdSchema.nullable(),
    currentMapAsset: RoomAssetSchema.nullable()
  })
]);

export const RoomStateResponseSchema = z.object({
  roomId: RoomIdSchema,
  storageMode: z.literal('CLOUD'),
  hostUserId: z.string().min(1),
  settings: RoomSettingsSchema,
  tokens: z.array(TokenSchema),
  members: z.array(RoomMemberSchema),
  currentMapAssetId: AssetIdSchema.nullable(),
  currentMapAsset: RoomAssetSchema.nullable()
});

export const ListRoomAssetsQuerySchema = z.object({
  type: AssetTypeSchema.optional()
});

export const ListRoomAssetsResponseSchema = z.object({
  assets: z.array(RoomAssetSchema)
});

export const UploadAssetResponseSchema = z.object({
  asset: RoomAssetSchema
});

export const SetRoomMapRequestSchema = z.object({
  assetId: AssetIdSchema
});

export const SetRoomMapResponseSchema = z.object({
  currentMapAssetId: AssetIdSchema.nullable(),
  currentMapAsset: RoomAssetSchema.nullable()
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;
export type CreateRoomResponse = z.infer<typeof CreateRoomResponseSchema>;

export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;
export type JoinRoomResponse = z.infer<typeof JoinRoomResponseSchema>;

export type RoomStateResponse = z.infer<typeof RoomStateResponseSchema>;
export type ListRoomAssetsQuery = z.infer<typeof ListRoomAssetsQuerySchema>;
export type ListRoomAssetsResponse = z.infer<typeof ListRoomAssetsResponseSchema>;
export type UploadAssetResponse = z.infer<typeof UploadAssetResponseSchema>;
export type SetRoomMapRequest = z.infer<typeof SetRoomMapRequestSchema>;
export type SetRoomMapResponse = z.infer<typeof SetRoomMapResponseSchema>;
