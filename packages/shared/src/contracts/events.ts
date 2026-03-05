import { z } from 'zod';

import {
  AssetIdSchema,
  AssetHashSchema,
  ImageRefSchema,
  JoinSecretSchema,
  MapRefSchema,
  MapEditPolicySchema,
  MapEditUserOverrideSchema,
  PresenceMemberSchema,
  RoomAssetSchema,
  RoomIdSchema,
  RoomMemberSchema,
  RoomSettingsSchema,
  TokenColorSchema,
  TokenKindSchema,
  TokenMovePolicySchema,
  TokenSchema
} from '../domain/room';
import { RoleSchema } from '../domain/roles';

export const EventEnvelopeSchema = z.object({
  type: z.string().min(1),
  payload: z.unknown(),
  ts: z.number().int().nonnegative().optional()
});

export const WsMessageSchema = EventEnvelopeSchema;

export const HelloMessageSchema = z.object({
  type: z.literal('HELLO'),
  payload: z
    .object({
      clientId: z.string().min(1),
      displayName: z.string().min(1).max(80),
      roomId: RoomIdSchema.optional(),
      joinSecret: JoinSecretSchema.optional(),
      desiredRole: z.enum(['PLAYER', 'SPECTATOR']).optional()
    })
    .refine((value) => value.roomId !== undefined || value.joinSecret !== undefined, {
      message: 'HELLO requires roomId or joinSecret'
    })
});

export const PingMessageSchema = z.object({
  type: z.literal('PING'),
  payload: z
    .object({
      ts: z.number().int().nonnegative().optional()
    })
    .optional()
});

export const TokenCreateMessageSchema = z.object({
  type: z.literal('TOKEN_CREATE'),
  payload: z.object({
    tempId: z.string().min(1).optional(),
    name: z.string().min(1).max(120),
    x: z.number().finite(),
    y: z.number().finite(),
    size: z.number().positive().finite(),
    assetId: AssetIdSchema.optional(),
    imageRef: ImageRefSchema.optional(),
    kind: TokenKindSchema.optional(),
    color: TokenColorSchema.nullable().optional(),
    elevation: z.number().int().min(0).max(999).optional(),
    imageOffsetX: z.number().finite().min(-500).max(500).optional(),
    imageOffsetY: z.number().finite().min(-500).max(500).optional(),
    imageScale: z.number().finite().min(0.1).max(6).optional(),
    imageRotationDeg: z.number().finite().min(-180).max(180).optional()
  })
});

export const TokenMoveMessageSchema = z.object({
  type: z.literal('TOKEN_MOVE'),
  payload: z.object({
    tokenId: z.string().min(1),
    x: z.number().finite(),
    y: z.number().finite()
  })
});

export const TokenDeleteMessageSchema = z.object({
  type: z.literal('TOKEN_DELETE'),
  payload: z.object({
    tokenId: z.string().min(1)
  })
});

export const TokenUpdateMessageSchema = z.object({
  type: z.literal('TOKEN_UPDATE'),
  payload: z.object({
    tokenId: z.string().min(1),
    name: z.string().min(1).max(120).optional(),
    assetId: AssetIdSchema.nullable().optional(),
    imageRef: ImageRefSchema.nullable().optional(),
    kind: TokenKindSchema.optional(),
    color: TokenColorSchema.nullable().optional(),
    elevation: z.number().int().min(0).max(999).optional(),
    imageOffsetX: z.number().finite().min(-500).max(500).optional(),
    imageOffsetY: z.number().finite().min(-500).max(500).optional(),
    imageScale: z.number().finite().min(0.1).max(6).optional(),
    imageRotationDeg: z.number().finite().min(-180).max(180).optional()
  })
});

export const RoomSettingsUpdateMessageSchema = z.object({
  type: z.literal('ROOM_SETTINGS_UPDATE'),
  payload: z.object({
    tokenMovePolicy: TokenMovePolicySchema,
    mapEditPolicy: MapEditPolicySchema,
    mapEditUserOverrides: z.array(MapEditUserOverrideSchema)
  })
});

export const RoomSetMapMessageSchema = z.object({
  type: z.literal('ROOM_SET_MAP'),
  payload: z.object({
    assetId: AssetIdSchema
  })
});

export const MapEditBrushSchema = z.enum(['PEN', 'MARKER', 'CHALK']);
export const MapTextAlignSchema = z.enum(['left', 'center', 'right']);

export const MapEditPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

export const MapEditEraseStrokeSchema = z.object({
  strokeWidth: z.number().finite().min(1).max(128),
  points: z.array(MapEditPointSchema).min(1).max(4_096)
});

export const MapEditElementBaseSchema = z.object({
  id: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  rotationDeg: z.number().finite().min(-180).max(180),
  scale: z.number().finite().min(0.05).max(16),
  opacity: z.number().finite().min(0.05).max(1),
  eraseStrokes: z.array(MapEditEraseStrokeSchema).max(256).optional()
});

export const MapEditPathElementSchema = MapEditElementBaseSchema.extend({
  type: z.literal('PATH'),
  color: TokenColorSchema,
  strokeWidth: z.number().finite().min(1).max(128),
  brush: MapEditBrushSchema,
  points: z.array(MapEditPointSchema).min(2)
});

export const MapEditLineElementSchema = MapEditElementBaseSchema.extend({
  type: z.literal('LINE'),
  color: TokenColorSchema,
  strokeWidth: z.number().finite().min(1).max(128),
  from: MapEditPointSchema,
  to: MapEditPointSchema
});

export const MapEditRectElementSchema = MapEditElementBaseSchema.extend({
  type: z.literal('RECT'),
  strokeColor: TokenColorSchema,
  fillColor: TokenColorSchema,
  strokeWidth: z.number().finite().min(1).max(128),
  width: z.number().finite().min(1).max(20_000),
  height: z.number().finite().min(1).max(20_000)
});

export const MapEditEllipseElementSchema = MapEditElementBaseSchema.extend({
  type: z.literal('ELLIPSE'),
  strokeColor: TokenColorSchema,
  fillColor: TokenColorSchema,
  strokeWidth: z.number().finite().min(1).max(128),
  width: z.number().finite().min(1).max(20_000),
  height: z.number().finite().min(1).max(20_000)
});

export const MapEditImageElementSchema = MapEditElementBaseSchema.extend({
  type: z.literal('IMAGE'),
  imageRef: ImageRefSchema,
  sourceUrl: z.string().min(1).max(10_000).optional(),
  width: z.number().finite().min(1).max(20_000),
  height: z.number().finite().min(1).max(20_000),
  label: z.string().min(1).max(255)
});

export const MapEditErasePathElementSchema = MapEditElementBaseSchema.extend({
  type: z.literal('ERASE_PATH'),
  strokeWidth: z.number().finite().min(1).max(128),
  points: z.array(MapEditPointSchema).min(2)
});

export const MapEditTextElementSchema = MapEditElementBaseSchema.extend({
  type: z.literal('TEXT'),
  text: z.string().min(1).max(2_000),
  color: TokenColorSchema,
  fontSize: z.number().finite().min(8).max(240),
  fontFamily: z.string().min(1).max(120),
  lineHeight: z.number().finite().min(0.7).max(4),
  align: MapTextAlignSchema,
  width: z.number().finite().min(1).max(20_000),
  height: z.number().finite().min(1).max(20_000)
});

export const MapEditElementSchema = z.discriminatedUnion('type', [
  MapEditPathElementSchema,
  MapEditLineElementSchema,
  MapEditRectElementSchema,
  MapEditEllipseElementSchema,
  MapEditImageElementSchema,
  MapEditErasePathElementSchema,
  MapEditTextElementSchema
]);

export const MapEditOperationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('UPSERT'),
    elements: z.array(MapEditElementSchema).min(1).max(200)
  }),
  z.object({
    kind: z.literal('DELETE'),
    elementIds: z.array(z.string().min(1)).min(1).max(500)
  }),
  z.object({
    kind: z.literal('CLEAR')
  })
]);

export const MapEditSnapshotSchema = z.object({
  revision: z.number().int().nonnegative(),
  elements: z.array(MapEditElementSchema)
});

export const MapEditOpsMessageSchema = z.object({
  type: z.literal('MAP_EDIT_OPS'),
  payload: z.object({
    operations: z.array(MapEditOperationSchema).min(1).max(64)
  })
});

export const ChatSendKindSchema = z.enum(['PUBLIC', 'WHISPER', 'DM_NOTE']);
export const ChatMessageIdSchema = z.string().min(1).max(128);
export const ChatMessageTimestampSchema = z.number().int().nonnegative();
export const ChatMessageTextSchema = z.string().max(4_000);
export const ChatRecipientUserIdsSchema = z.array(z.string().min(1)).min(1).max(64);
export const ChatAttachmentRefSchema = z.object({
  hash: AssetHashSchema,
  name: z.string().min(1).max(255),
  mime: z.string().min(1).max(255),
  size: z.number().int().positive().max(10 * 1024 * 1024),
  seedUserId: z.string().min(1).optional()
});
export const ChatAttachmentRefsSchema = z.array(ChatAttachmentRefSchema).max(8);

export const FileTransferIdSchema = z.string().min(1).max(128);
export const FileSignalKindSchema = z.enum(['offer', 'answer', 'ice']);

const ChatMessageBaseSchema = z.object({
  id: ChatMessageIdSchema,
  ts: ChatMessageTimestampSchema,
  fromUserId: z.string().min(1),
  fromName: z.string().min(1).max(120),
  text: ChatMessageTextSchema,
  attachments: ChatAttachmentRefsSchema.optional()
});

export const ChatMessagePublicSchema = ChatMessageBaseSchema.extend({
  kind: z.literal('PUBLIC')
});

export const ChatMessageWhisperSchema = ChatMessageBaseSchema.extend({
  kind: z.literal('WHISPER'),
  toUserIds: ChatRecipientUserIdsSchema
});

export const ChatMessageDmNoteSchema = ChatMessageBaseSchema.extend({
  kind: z.literal('DM_NOTE')
});

export const ChatMessageSchema = z.discriminatedUnion('kind', [
  ChatMessagePublicSchema,
  ChatMessageWhisperSchema,
  ChatMessageDmNoteSchema
]);

export const LocalChatStateSchema = z.object({
  messages: z.array(ChatMessageSchema),
  maxMessages: z.number().int().positive().max(5_000).default(500)
});

export const LocalGridTypeSchema = z.enum(['SQUARE', 'HEX']);
export const LocalCellUnitSchema = z.enum(['ft', 'm']);
export const LocalStackDisplaySchema = z.enum(['EXACT', 'FAN']);

export const LocalSessionSettingsSchema = z.object({
  tokenMovePolicy: TokenMovePolicySchema,
  tokenEditPolicy: TokenMovePolicySchema.default('DM_ONLY'),
  mapEditPolicy: MapEditPolicySchema,
  mapEditUserOverrides: z.array(MapEditUserOverrideSchema),
  autoExportEnabled: z.boolean().default(true),
  autoExportIntervalMinutes: z.number().int().min(1).max(120).default(30),
  gridType: LocalGridTypeSchema,
  cellSizePx: z.number().int().min(24).max(160),
  cellDistance: z.number().finite().min(0.5).max(200),
  cellUnit: LocalCellUnitSchema,
  gridOriginX: z.number().finite(),
  gridOriginY: z.number().finite(),
  gridOriginZ: z.number().finite(),
  snapToGrid: z.boolean(),
  stackDisplay: LocalStackDisplaySchema,
  mapOffsetX: z.number().finite(),
  mapOffsetY: z.number().finite(),
  mapScale: z.number().finite().min(0.1).max(6),
  mapRotationDeg: z.number().finite().min(-180).max(180)
});

export const LocalSessionSettingsPatchSchema = LocalSessionSettingsSchema.partial();

export const LocalAssetKindSchema = z.enum(['MAP', 'TOKEN_IMAGE', 'MAP_EDIT_IMAGE', 'OBJECT', 'CHAT_FILE', 'OTHER']);

export const LocalAssetManifestEntrySchema = z.object({
  mime: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  kind: LocalAssetKindSchema
});

export const LocalAssetsManifestSchema = z.object({
  hashes: z.array(AssetHashSchema),
  byHash: z.record(LocalAssetManifestEntrySchema)
});

export const MapEditDocumentSchema = z.object({
  elements: z.array(MapEditElementSchema)
});

export const RoomSnapshotSchema = z.object({
  snapshotVersion: z.literal(1),
  roomId: RoomIdSchema,
  generatedAt: z.string().datetime(),
  hostUserId: z.string().min(1),
  settings: LocalSessionSettingsSchema,
  currentMapRef: MapRefSchema.nullable(),
  tokens: z.array(TokenSchema),
  mapEdit: z.object({
    rev: z.number().int().nonnegative(),
    document: MapEditDocumentSchema
  }),
  chat: LocalChatStateSchema.default({
    messages: [],
    maxMessages: 500
  }),
  assetsManifest: LocalAssetsManifestSchema
});

export const HostTokenDraftSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  size: z.number().positive().finite().optional(),
  imageRef: ImageRefSchema.nullable().optional(),
  kind: TokenKindSchema.optional(),
  color: TokenColorSchema.nullable().optional(),
  elevation: z.number().int().min(0).max(999).optional(),
  imageOffsetX: z.number().finite().min(-500).max(500).optional(),
  imageOffsetY: z.number().finite().min(-500).max(500).optional(),
  imageScale: z.number().finite().min(0.1).max(6).optional(),
  imageRotationDeg: z.number().finite().min(-180).max(180).optional()
});

export const HostTokenPatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  imageRef: ImageRefSchema.nullable().optional(),
  kind: TokenKindSchema.optional(),
  color: TokenColorSchema.nullable().optional(),
  elevation: z.number().int().min(0).max(999).optional(),
  imageOffsetX: z.number().finite().min(-500).max(500).optional(),
  imageOffsetY: z.number().finite().min(-500).max(500).optional(),
  imageScale: z.number().finite().min(0.1).max(6).optional(),
  imageRotationDeg: z.number().finite().min(-180).max(180).optional()
});

const HostChatSendRequestSchema = z
  .object({
    type: z.literal('REQUEST_CHAT_SEND'),
    kind: ChatSendKindSchema,
    text: ChatMessageTextSchema,
    recipients: z.array(z.string().min(1)).max(64).optional(),
    attachments: ChatAttachmentRefsSchema.optional()
  });

export const HostRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('REQUEST_TOKEN_CREATE'),
    x: z.number().finite(),
    y: z.number().finite(),
    tokenDraft: HostTokenDraftSchema.optional()
  }),
  z.object({
    type: z.literal('REQUEST_TOKEN_MOVE'),
    tokenId: z.string().min(1),
    x: z.number().finite(),
    y: z.number().finite()
  }),
  z.object({
    type: z.literal('REQUEST_TOKEN_UPDATE'),
    tokenId: z.string().min(1),
    patch: HostTokenPatchSchema
  }),
  z.object({
    type: z.literal('REQUEST_TOKEN_DELETE'),
    tokenId: z.string().min(1)
  }),
  z.object({
    type: z.literal('REQUEST_MAP_SET_ACTIVE'),
    mapRef: MapRefSchema.nullable()
  }),
  z.object({
    type: z.literal('REQUEST_ROOM_SETTINGS_UPDATE'),
    patch: LocalSessionSettingsPatchSchema
  }),
  z.object({
    type: z.literal('REQUEST_MAPEDIT_OPS'),
    baseRev: z.number().int().nonnegative(),
    ops: z.array(MapEditOperationSchema).min(1).max(64)
  }),
  HostChatSendRequestSchema,
  z.object({
    type: z.literal('FILE_REQUEST'),
    transferId: FileTransferIdSchema,
    hash: AssetHashSchema,
    name: z.string().min(1).max(255),
    mime: z.string().min(1).max(255),
    size: z.number().int().positive().max(10 * 1024 * 1024),
    seedUserId: z.string().min(1).optional()
  }),
  z.object({
    type: z.literal('FILE_SIGNAL'),
    toUserId: z.string().min(1),
    transferId: FileTransferIdSchema,
    hash: AssetHashSchema,
    kind: FileSignalKindSchema,
    data: z.unknown()
  }),
  z.object({
    type: z.literal('FILE_CANCEL'),
    toUserId: z.string().min(1),
    transferId: FileTransferIdSchema,
    hash: AssetHashSchema,
    reason: z.string().min(1).max(400).optional()
  })
]).superRefine((value, ctx) => {
  if (value.type !== 'REQUEST_CHAT_SEND') {
    return;
  }

  if (value.text.trim().length > 0 || (value.attachments?.length ?? 0) > 0) {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'REQUEST_CHAT_SEND requires text or attachments'
  });
});

export const HostEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TOKEN_CREATED'),
    token: TokenSchema
  }),
  z.object({
    type: z.literal('TOKEN_MOVED'),
    tokenId: z.string().min(1),
    x: z.number().finite(),
    y: z.number().finite()
  }),
  z.object({
    type: z.literal('TOKEN_UPDATED'),
    token: TokenSchema
  }),
  z.object({
    type: z.literal('TOKEN_DELETED'),
    tokenId: z.string().min(1)
  }),
  z.object({
    type: z.literal('ROOM_SETTINGS_UPDATED'),
    settings: LocalSessionSettingsSchema
  }),
  z.object({
    type: z.literal('MAP_ACTIVE_SET'),
    mapRef: MapRefSchema.nullable()
  }),
  z.object({
    type: z.literal('MAPEDIT_OPS_APPLIED'),
    fromRev: z.number().int().nonnegative(),
    toRev: z.number().int().nonnegative(),
    ops: z.array(MapEditOperationSchema).min(1).max(64)
  }),
  z.object({
    type: z.literal('SNAPSHOT_ANNOUNCE'),
    snapshotRev: z.number().int().nonnegative()
  }),
  z.object({
    type: z.literal('CHAT_MESSAGE_PUBLIC'),
    id: ChatMessageIdSchema,
    ts: ChatMessageTimestampSchema,
    fromUserId: z.string().min(1),
    fromName: z.string().min(1).max(120),
    text: ChatMessageTextSchema,
    attachments: ChatAttachmentRefsSchema.optional()
  }),
  z.object({
    type: z.literal('CHAT_MESSAGE_WHISPER'),
    id: ChatMessageIdSchema,
    ts: ChatMessageTimestampSchema,
    fromUserId: z.string().min(1),
    fromName: z.string().min(1).max(120),
    toUserIds: ChatRecipientUserIdsSchema,
    text: ChatMessageTextSchema,
    attachments: ChatAttachmentRefsSchema.optional()
  }),
  z.object({
    type: z.literal('CHAT_MESSAGE_DM_NOTE'),
    id: ChatMessageIdSchema,
    ts: ChatMessageTimestampSchema,
    fromUserId: z.string().min(1),
    fromName: z.string().min(1).max(120),
    text: ChatMessageTextSchema,
    attachments: ChatAttachmentRefsSchema.optional()
  })
]);

export const HostDirectSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('HOST_SNAPSHOT'),
    snapshot: RoomSnapshotSchema
  }),
  z.object({
    type: z.literal('HOST_RESYNC'),
    snapshot: RoomSnapshotSchema
  }),
  z.object({
    type: z.literal('HOST_SNAPSHOT_CHUNK'),
    transferId: z.string().min(1).max(255),
    seq: z.number().int().nonnegative(),
    total: z.number().int().positive().max(20_000),
    bytesBase64: z.string().min(1)
  }),
  z.object({
    type: z.literal('ASSET_OFFER'),
    hashes: z.array(AssetHashSchema).min(1).max(10_000)
  }),
  z.object({
    type: z.literal('ASSET_CHUNK'),
    hash: AssetHashSchema,
    seq: z.number().int().nonnegative(),
    total: z.number().int().positive().max(20_000),
    bytesBase64: z.string().min(1)
  }),
  z.object({
    type: z.literal('DENIED'),
    code: z.string().min(1).max(64),
    message: z.string().min(1).max(400)
  }),
  z.object({
    type: z.literal('CHAT_MESSAGE_WHISPER'),
    id: ChatMessageIdSchema,
    ts: ChatMessageTimestampSchema,
    fromUserId: z.string().min(1),
    fromName: z.string().min(1).max(120),
    toUserIds: ChatRecipientUserIdsSchema,
    text: ChatMessageTextSchema,
    attachments: ChatAttachmentRefsSchema.optional()
  }),
  z.object({
    type: z.literal('CHAT_MESSAGE_DM_NOTE'),
    id: ChatMessageIdSchema,
    ts: ChatMessageTimestampSchema,
    fromUserId: z.string().min(1),
    fromName: z.string().min(1).max(120),
    text: ChatMessageTextSchema,
    attachments: ChatAttachmentRefsSchema.optional()
  }),
  z.object({
    type: z.literal('FILE_REQUEST'),
    fromUserId: z.string().min(1),
    fromName: z.string().min(1).max(120),
    transferId: FileTransferIdSchema,
    hash: AssetHashSchema,
    name: z.string().min(1).max(255),
    mime: z.string().min(1).max(255),
    size: z.number().int().positive().max(10 * 1024 * 1024),
    seedUserId: z.string().min(1).optional()
  }),
  z.object({
    type: z.literal('FILE_SIGNAL'),
    fromUserId: z.string().min(1),
    transferId: FileTransferIdSchema,
    hash: AssetHashSchema,
    kind: FileSignalKindSchema,
    data: z.unknown()
  }),
  z.object({
    type: z.literal('FILE_CANCEL'),
    fromUserId: z.string().min(1),
    transferId: FileTransferIdSchema,
    hash: AssetHashSchema,
    reason: z.string().min(1).max(400).optional()
  }),
  z.object({
    type: z.literal('FILE_OFFER'),
    fromUserId: z.string().min(1),
    fromName: z.string().min(1).max(120),
    hash: AssetHashSchema,
    name: z.string().min(1).max(255),
    mime: z.string().min(1).max(255),
    size: z.number().int().positive().max(10 * 1024 * 1024),
    seedUserId: z.string().min(1).optional()
  })
]);

export const RelayToHostMessageSchema = z.object({
  type: z.literal('RELAY_TO_HOST'),
  payload: HostRequestSchema
});

export const RelayBroadcastMessageSchema = z.object({
  type: z.literal('RELAY_BROADCAST'),
  payload: HostEventSchema
});

export const RelayToUserMessageSchema = z.object({
  type: z.literal('RELAY_TO_USER'),
  payload: z.object({
    userId: z.string().min(1),
    payload: HostDirectSchema
  })
});

export const AssetRequestMessageSchema = z.object({
  type: z.literal('ASSET_REQUEST'),
  payload: z.object({
    toHost: z.literal(true),
    hashes: z.array(AssetHashSchema).min(1).max(10_000)
  })
});

export const AssetChunkMessageSchema = z.object({
  type: z.literal('ASSET_CHUNK'),
  payload: z.object({
    toUserId: z.string().min(1),
    hash: AssetHashSchema,
    seq: z.number().int().nonnegative(),
    total: z.number().int().positive().max(20_000),
    bytesBase64: z.string().min(1)
  })
});

export const ClientToServerMessageSchema = z.discriminatedUnion('type', [
  HelloMessageSchema,
  PingMessageSchema,
  TokenCreateMessageSchema,
  TokenMoveMessageSchema,
  TokenDeleteMessageSchema,
  TokenUpdateMessageSchema,
  RoomSettingsUpdateMessageSchema,
  RoomSetMapMessageSchema,
  MapEditOpsMessageSchema,
  RelayToHostMessageSchema,
  RelayBroadcastMessageSchema,
  RelayToUserMessageSchema,
  AssetRequestMessageSchema,
  AssetChunkMessageSchema
]);

export const WelcomeMessageSchema = z.object({
  type: z.literal('WELCOME'),
  payload: z.object({
    userId: z.string().min(1),
    roomId: RoomIdSchema,
    role: RoleSchema,
    member: RoomMemberSchema,
    settings: RoomSettingsSchema,
    tokens: z.array(TokenSchema),
    membersOnline: z.array(PresenceMemberSchema),
    currentMapAssetId: AssetIdSchema.nullable(),
    currentMapAsset: RoomAssetSchema.nullable(),
    mapEditSnapshot: MapEditSnapshotSchema
  })
});

export const WelcomeLocalMessageSchema = z.object({
  type: z.literal('WELCOME_LOCAL'),
  payload: z.object({
    userId: z.string().min(1),
    roomId: RoomIdSchema,
    role: RoleSchema,
    storageMode: z.literal('LOCAL'),
    hostUserId: z.string().min(1),
    membersOnline: z.array(PresenceMemberSchema)
  })
});

export const HostOfflineMessageSchema = z.object({
  type: z.literal('HOST_OFFLINE'),
  payload: z.object({
    message: z.string().min(1)
  })
});

export const PresenceUpdateMessageSchema = z.object({
  type: z.literal('PRESENCE_UPDATE'),
  payload: z.object({
    membersOnline: z.array(PresenceMemberSchema),
    hostUserId: z.string().min(1).nullable().optional()
  })
});

export const RelayFromHostMessageSchema = z.object({
  type: z.literal('RELAY_FROM_HOST'),
  payload: HostEventSchema
});

export const DirectFromHostMessageSchema = z.object({
  type: z.literal('DIRECT_FROM_HOST'),
  payload: HostDirectSchema
});

export const RelayFromUserMessageSchema = z.object({
  type: z.literal('RELAY_FROM_USER'),
  payload: z.object({
    fromUserId: z.string().min(1),
    payload: z.union([
      HostRequestSchema,
      z.object({
        type: z.literal('ASSET_REQUEST'),
        hashes: z.array(AssetHashSchema).min(1).max(10_000)
      })
    ])
  })
});

export const TokenCreatedMessageSchema = z.object({
  type: z.literal('TOKEN_CREATED'),
  payload: z.object({
    token: TokenSchema
  })
});

export const TokenUpdatedMessageSchema = z.object({
  type: z.literal('TOKEN_UPDATED'),
  payload: z.object({
    token: TokenSchema
  })
});

export const TokenDeletedMessageSchema = z.object({
  type: z.literal('TOKEN_DELETED'),
  payload: z.object({
    tokenId: z.string().min(1)
  })
});

export const RoomSettingsUpdatedMessageSchema = z.object({
  type: z.literal('ROOM_SETTINGS_UPDATED'),
  payload: z.object({
    settings: RoomSettingsSchema
  })
});

export const RoomMapUpdatedMessageSchema = z.object({
  type: z.literal('ROOM_MAP_UPDATED'),
  payload: z.object({
    currentMapAssetId: AssetIdSchema.nullable(),
    asset: RoomAssetSchema.nullable()
  })
});

export const AssetCreatedMessageSchema = z.object({
  type: z.literal('ASSET_CREATED'),
  payload: z.object({
    asset: RoomAssetSchema
  })
});

export const MapEditOpsAppliedMessageSchema = z.object({
  type: z.literal('MAP_EDIT_OPS_APPLIED'),
  payload: z.object({
    revision: z.number().int().nonnegative(),
    operations: z.array(MapEditOperationSchema).min(1).max(64)
  })
});

export const ErrorMessageSchema = z.object({
  type: z.literal('ERROR'),
  payload: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    rejectedType: z.string().min(1).optional(),
    hint: z.string().min(1).max(400).optional()
  })
});

export const PongMessageSchema = z.object({
  type: z.literal('PONG'),
  payload: z
    .object({
      ts: z.number().int().nonnegative().optional()
    })
    .optional()
});

export const ServerToClientMessageSchema = z.discriminatedUnion('type', [
  WelcomeMessageSchema,
  WelcomeLocalMessageSchema,
  HostOfflineMessageSchema,
  PresenceUpdateMessageSchema,
  RelayFromHostMessageSchema,
  DirectFromHostMessageSchema,
  RelayFromUserMessageSchema,
  TokenCreatedMessageSchema,
  TokenUpdatedMessageSchema,
  TokenDeletedMessageSchema,
  RoomSettingsUpdatedMessageSchema,
  RoomMapUpdatedMessageSchema,
  AssetCreatedMessageSchema,
  MapEditOpsAppliedMessageSchema,
  ErrorMessageSchema,
  PongMessageSchema
]);

export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
export type WsMessage = z.infer<typeof WsMessageSchema>;

export type HelloMessage = z.infer<typeof HelloMessageSchema>;
export type PingMessage = z.infer<typeof PingMessageSchema>;
export type TokenCreateMessage = z.infer<typeof TokenCreateMessageSchema>;
export type TokenMoveMessage = z.infer<typeof TokenMoveMessageSchema>;
export type TokenDeleteMessage = z.infer<typeof TokenDeleteMessageSchema>;
export type TokenUpdateMessage = z.infer<typeof TokenUpdateMessageSchema>;
export type RoomSettingsUpdateMessage = z.infer<typeof RoomSettingsUpdateMessageSchema>;
export type RoomSetMapMessage = z.infer<typeof RoomSetMapMessageSchema>;
export type MapEditBrush = z.infer<typeof MapEditBrushSchema>;
export type MapTextAlign = z.infer<typeof MapTextAlignSchema>;
export type MapEditPoint = z.infer<typeof MapEditPointSchema>;
export type MapEditEraseStroke = z.infer<typeof MapEditEraseStrokeSchema>;
export type MapEditPathElement = z.infer<typeof MapEditPathElementSchema>;
export type MapEditLineElement = z.infer<typeof MapEditLineElementSchema>;
export type MapEditRectElement = z.infer<typeof MapEditRectElementSchema>;
export type MapEditEllipseElement = z.infer<typeof MapEditEllipseElementSchema>;
export type MapEditImageElement = z.infer<typeof MapEditImageElementSchema>;
export type MapEditErasePathElement = z.infer<typeof MapEditErasePathElementSchema>;
export type MapEditTextElement = z.infer<typeof MapEditTextElementSchema>;
export type MapEditElement = z.infer<typeof MapEditElementSchema>;
export type MapEditOperation = z.infer<typeof MapEditOperationSchema>;
export type MapEditSnapshot = z.infer<typeof MapEditSnapshotSchema>;
export type MapEditOpsMessage = z.infer<typeof MapEditOpsMessageSchema>;
export type ChatSendKind = z.infer<typeof ChatSendKindSchema>;
export type ChatMessageId = z.infer<typeof ChatMessageIdSchema>;
export type ChatMessageTimestamp = z.infer<typeof ChatMessageTimestampSchema>;
export type ChatMessageText = z.infer<typeof ChatMessageTextSchema>;
export type ChatRecipientUserIds = z.infer<typeof ChatRecipientUserIdsSchema>;
export type ChatAttachmentRef = z.infer<typeof ChatAttachmentRefSchema>;
export type ChatAttachmentRefs = z.infer<typeof ChatAttachmentRefsSchema>;
export type ChatAttachment = ChatAttachmentRef;
export type ChatAttachments = ChatAttachmentRefs;
export type FileTransferId = z.infer<typeof FileTransferIdSchema>;
export type FileSignalKind = z.infer<typeof FileSignalKindSchema>;
export type ChatMessagePublic = z.infer<typeof ChatMessagePublicSchema>;
export type ChatMessageWhisper = z.infer<typeof ChatMessageWhisperSchema>;
export type ChatMessageDmNote = z.infer<typeof ChatMessageDmNoteSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type LocalChatState = z.infer<typeof LocalChatStateSchema>;
export type LocalSessionSettings = z.infer<typeof LocalSessionSettingsSchema>;
export type LocalSessionSettingsPatch = z.infer<typeof LocalSessionSettingsPatchSchema>;
export type LocalAssetKind = z.infer<typeof LocalAssetKindSchema>;
export type LocalAssetManifestEntry = z.infer<typeof LocalAssetManifestEntrySchema>;
export type LocalAssetsManifest = z.infer<typeof LocalAssetsManifestSchema>;
export type MapEditDocument = z.infer<typeof MapEditDocumentSchema>;
export type RoomSnapshot = z.infer<typeof RoomSnapshotSchema>;
export type HostTokenDraft = z.infer<typeof HostTokenDraftSchema>;
export type HostTokenPatch = z.infer<typeof HostTokenPatchSchema>;
export type HostRequest = z.infer<typeof HostRequestSchema>;
export type HostEvent = z.infer<typeof HostEventSchema>;
export type HostDirect = z.infer<typeof HostDirectSchema>;
export type RelayToHostMessage = z.infer<typeof RelayToHostMessageSchema>;
export type RelayBroadcastMessage = z.infer<typeof RelayBroadcastMessageSchema>;
export type RelayToUserMessage = z.infer<typeof RelayToUserMessageSchema>;
export type AssetRequestMessage = z.infer<typeof AssetRequestMessageSchema>;
export type AssetChunkMessage = z.infer<typeof AssetChunkMessageSchema>;
export type ClientToServerMessage = z.infer<typeof ClientToServerMessageSchema>;

export type WelcomeMessage = z.infer<typeof WelcomeMessageSchema>;
export type WelcomeLocalMessage = z.infer<typeof WelcomeLocalMessageSchema>;
export type HostOfflineMessage = z.infer<typeof HostOfflineMessageSchema>;
export type PresenceUpdateMessage = z.infer<typeof PresenceUpdateMessageSchema>;
export type RelayFromHostMessage = z.infer<typeof RelayFromHostMessageSchema>;
export type DirectFromHostMessage = z.infer<typeof DirectFromHostMessageSchema>;
export type RelayFromUserMessage = z.infer<typeof RelayFromUserMessageSchema>;
export type TokenCreatedMessage = z.infer<typeof TokenCreatedMessageSchema>;
export type TokenUpdatedMessage = z.infer<typeof TokenUpdatedMessageSchema>;
export type TokenDeletedMessage = z.infer<typeof TokenDeletedMessageSchema>;
export type RoomSettingsUpdatedMessage = z.infer<typeof RoomSettingsUpdatedMessageSchema>;
export type RoomMapUpdatedMessage = z.infer<typeof RoomMapUpdatedMessageSchema>;
export type AssetCreatedMessage = z.infer<typeof AssetCreatedMessageSchema>;
export type MapEditOpsAppliedMessage = z.infer<typeof MapEditOpsAppliedMessageSchema>;
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;
export type PongMessage = z.infer<typeof PongMessageSchema>;
export type ServerToClientMessage = z.infer<typeof ServerToClientMessageSchema>;
