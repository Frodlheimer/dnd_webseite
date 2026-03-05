import { z } from 'zod';

import { RoleSchema } from './roles';

export const RoomIdSchema = z.string().min(1).max(64);
export const JoinSecretSchema = z.string().min(4).max(32);
export const AssetIdSchema = z.string().min(1);
export const AssetHashSchema = z.string().regex(/^[a-f0-9]{64}$/i, 'Asset hash must be a SHA-256 hex string');

export const StorageModeSchema = z.enum(['LOCAL', 'CLOUD']);

export const LocalAssetRefSchema = z.object({
  kind: z.literal('LOCAL_ASSET'),
  hash: AssetHashSchema
});

export const CloudAssetRefSchema = z.object({
  kind: z.literal('CLOUD_ASSET'),
  assetId: AssetIdSchema
});

export const ImageRefSchema = z.discriminatedUnion('kind', [LocalAssetRefSchema, CloudAssetRefSchema]);
export const MapRefSchema = z.discriminatedUnion('kind', [LocalAssetRefSchema, CloudAssetRefSchema]);

export const TokenMovePolicySchema = z.enum(['ALL', 'OWNED_ONLY', 'DM_ONLY']);
export const MapEditPolicySchema = z.enum(['DM_ONLY', 'PLAYERS']);
export const MapEditUserOverrideSchema = z.object({
  userId: z.string().min(1),
  enabled: z.boolean()
});
export const AssetTypeSchema = z.enum(['MAP', 'TOKEN_IMAGE', 'SOUND']);
export const TokenKindSchema = z.enum(['ALLY', 'ENEMY', 'NEUTRAL']);
export const TokenColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Token color must be a 6-digit hex value (e.g. #22c55e)');
export const TokenImageStyleSchema = z.object({
  offsetX: z.number().finite().min(-500).max(500).optional(),
  offsetY: z.number().finite().min(-500).max(500).optional(),
  scale: z.number().finite().min(0.1).max(6).optional(),
  rotationDeg: z.number().finite().min(-180).max(180).optional()
});
export const TokenStyleSchema = z.object({
  kind: TokenKindSchema.optional(),
  color: TokenColorSchema.optional(),
  elevation: z.number().int().min(0).max(999).optional(),
  image: TokenImageStyleSchema.optional()
});

export const TokenControlledBySchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('ALL'),
    style: TokenStyleSchema.optional()
  }),
  z.object({
    mode: z.literal('USERS'),
    userIds: z.array(z.string().min(1)).min(1),
    style: TokenStyleSchema.optional()
  })
]);

export const RoomSchema = z.object({
  id: RoomIdSchema,
  name: z.string().min(1).max(120),
  joinSecret: JoinSecretSchema,
  isPublic: z.boolean(),
  dmUserId: z.string().min(1),
  storageMode: StorageModeSchema,
  createdAt: z.string().datetime()
});

export const RoomMemberSchema = z.object({
  roomId: RoomIdSchema,
  userId: z.string().min(1),
  role: RoleSchema,
  displayName: z.string().min(1).max(80),
  joinedAt: z.string().datetime(),
  lastSeenAt: z.string().datetime()
});

export const PresenceMemberSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1).max(80),
  role: RoleSchema
});

export const RoomSettingsSchema = z.object({
  roomId: RoomIdSchema,
  tokenMovePolicy: TokenMovePolicySchema,
  mapEditPolicy: MapEditPolicySchema,
  mapEditUserOverrides: z.array(MapEditUserOverrideSchema)
});

export const TokenSchema = z.object({
  id: z.string().min(1),
  roomId: RoomIdSchema,
  name: z.string().min(1).max(120),
  x: z.number().finite(),
  y: z.number().finite(),
  size: z.number().positive().finite(),
  assetId: z.string().min(1).nullable(),
  imageRef: ImageRefSchema.nullable().optional(),
  kind: TokenKindSchema,
  color: TokenColorSchema.nullable(),
  elevation: z.number().int().min(0).max(999),
  imageOffsetX: z.number().finite(),
  imageOffsetY: z.number().finite(),
  imageScale: z.number().finite().min(0.1).max(6),
  imageRotationDeg: z.number().finite().min(-180).max(180),
  controlledBy: TokenControlledBySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const RoomAssetSchema = z.object({
  id: AssetIdSchema,
  roomId: RoomIdSchema,
  ownerUserId: z.string().min(1).nullable(),
  type: AssetTypeSchema,
  mime: z.string().min(1),
  size: z.number().int().nonnegative(),
  originalName: z.string().min(1).max(255),
  storageKey: z.string().min(1),
  createdAt: z.string().datetime()
});

export type Room = z.infer<typeof RoomSchema>;
export type RoomMember = z.infer<typeof RoomMemberSchema>;
export type PresenceMember = z.infer<typeof PresenceMemberSchema>;
export type RoomSettings = z.infer<typeof RoomSettingsSchema>;
export type TokenMovePolicy = z.infer<typeof TokenMovePolicySchema>;
export type MapEditPolicy = z.infer<typeof MapEditPolicySchema>;
export type MapEditUserOverride = z.infer<typeof MapEditUserOverrideSchema>;
export type StorageMode = z.infer<typeof StorageModeSchema>;
export type LocalAssetRef = z.infer<typeof LocalAssetRefSchema>;
export type CloudAssetRef = z.infer<typeof CloudAssetRefSchema>;
export type ImageRef = z.infer<typeof ImageRefSchema>;
export type MapRef = z.infer<typeof MapRefSchema>;
export type TokenControlledBy = z.infer<typeof TokenControlledBySchema>;
export type TokenKind = z.infer<typeof TokenKindSchema>;
export type VttToken = z.infer<typeof TokenSchema>;
export type AssetType = z.infer<typeof AssetTypeSchema>;
export type RoomAsset = z.infer<typeof RoomAssetSchema>;
