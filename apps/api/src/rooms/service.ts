import { randomBytes } from 'node:crypto';

import type { MapEditPolicy, Prisma, StorageMode, TokenMovePolicy } from '@prisma/client';
import {
  MapEditPolicySchema,
  MapEditUserOverrideSchema,
  RoomMemberSchema,
  RoomSettingsSchema,
  RoomSchema,
  TokenColorSchema,
  TokenControlledBySchema,
  TokenKindSchema,
  TokenMovePolicySchema,
  TokenSchema,
  StorageModeSchema,
  type Role,
  type RoomAsset,
  type RoomMember,
  type RoomSettings,
  type TokenControlledBy,
  type TokenKind,
  type MapEditPolicy as SharedMapEditPolicy,
  type MapEditUserOverride,
  type StorageMode as SharedStorageMode,
  type TokenMovePolicy as SharedTokenMovePolicy,
  type VttToken
} from '@dnd-vtt/shared';

import { toSharedAsset } from '../assets/model.js';
import { prisma } from '../db/prisma.js';
import { assertCloudStateAccessForRoom } from './localStrict.js';

const JOIN_SECRET_LENGTH = 8;
const JOIN_SECRET_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type PrismaDbClient = Prisma.TransactionClient | typeof prisma;

export class RoomServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'RoomServiceError';
  }
}

const createJoinSecretCandidate = (): string => {
  const bytes = randomBytes(JOIN_SECRET_LENGTH);
  let secret = '';

  for (const byte of bytes) {
    secret += JOIN_SECRET_ALPHABET[byte % JOIN_SECRET_ALPHABET.length];
  }

  return secret;
};

const generateUniqueJoinSecret = async (db: PrismaDbClient): Promise<string> => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = createJoinSecretCandidate();

    const existing = await db.room.findUnique({
      where: {
        joinSecret: candidate
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new RoomServiceError('JOIN_SECRET_GENERATION_FAILED', 500, 'Could not generate unique join secret');
};

const toIsoString = (date: Date): string => date.toISOString();

const parseTokenControlledBy = (value: Prisma.JsonValue): TokenControlledBy => {
  return TokenControlledBySchema.parse(value);
};

const serializeTokenControlledBy = (value: TokenControlledBy): Prisma.JsonObject => {
  return value as Prisma.JsonObject;
};

const normalizeMapEditUserOverrides = (value: MapEditUserOverride[]): MapEditUserOverride[] => {
  const byUserId = new Map<string, MapEditUserOverride>();

  for (const entry of value) {
    byUserId.set(entry.userId, entry);
  }

  return [...byUserId.values()].sort((a, b) => a.userId.localeCompare(b.userId));
};

const parseMapEditUserOverrides = (value: Prisma.JsonValue): MapEditUserOverride[] => {
  const parsed = MapEditUserOverrideSchema.array().parse(value);
  return normalizeMapEditUserOverrides(parsed);
};

const serializeMapEditUserOverrides = (value: MapEditUserOverride[]): Prisma.JsonArray => {
  return normalizeMapEditUserOverrides(value) as unknown as Prisma.JsonArray;
};

const resolveTokenStyle = (controlledBy: TokenControlledBy): {
  kind: TokenKind;
  color: string | null;
  elevation: number;
  imageOffsetX: number;
  imageOffsetY: number;
  imageScale: number;
  imageRotationDeg: number;
} => {
  return {
    kind: controlledBy.style?.kind ?? 'ENEMY',
    color: controlledBy.style?.color ?? null,
    elevation: controlledBy.style?.elevation ?? 0,
    imageOffsetX: controlledBy.style?.image?.offsetX ?? 0,
    imageOffsetY: controlledBy.style?.image?.offsetY ?? 0,
    imageScale: controlledBy.style?.image?.scale ?? 1,
    imageRotationDeg: controlledBy.style?.image?.rotationDeg ?? 0
  };
};

const toSharedRoom = (room: {
  id: string;
  name: string;
  joinSecret: string;
  isPublic: boolean;
  dmUserId: string;
  storageMode: StorageMode;
  createdAt: Date;
}) => {
  return RoomSchema.parse({
    id: room.id,
    name: room.name,
    joinSecret: room.joinSecret,
    isPublic: room.isPublic,
    dmUserId: room.dmUserId,
    storageMode: StorageModeSchema.parse(room.storageMode),
    createdAt: toIsoString(room.createdAt)
  });
};

const toSharedMember = (member: {
  roomId: string;
  userId: string;
  role: Role;
  displayName: string;
  joinedAt: Date;
  lastSeenAt: Date;
}): RoomMember => {
  return RoomMemberSchema.parse({
    roomId: member.roomId,
    userId: member.userId,
    role: member.role,
    displayName: member.displayName,
    joinedAt: toIsoString(member.joinedAt),
    lastSeenAt: toIsoString(member.lastSeenAt)
  });
};

const toSharedSettings = (settings: {
  roomId: string;
  tokenMovePolicy: TokenMovePolicy;
  mapEditPolicy: MapEditPolicy;
  mapEditUserOverridesJson: Prisma.JsonValue;
}): RoomSettings => {
  return RoomSettingsSchema.parse({
    roomId: settings.roomId,
    tokenMovePolicy: settings.tokenMovePolicy,
    mapEditPolicy: settings.mapEditPolicy,
    mapEditUserOverrides: parseMapEditUserOverrides(settings.mapEditUserOverridesJson)
  });
};

const toSharedToken = (token: {
  id: string;
  roomId: string;
  name: string;
  x: number;
  y: number;
  size: number;
  assetId: string | null;
  controlledByJson: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): VttToken => {
  const controlledBy = parseTokenControlledBy(token.controlledByJson);
  const style = resolveTokenStyle(controlledBy);

  return TokenSchema.parse({
    id: token.id,
    roomId: token.roomId,
    name: token.name,
    x: token.x,
    y: token.y,
    size: token.size,
    assetId: token.assetId,
    kind: style.kind,
    color: style.color,
    elevation: style.elevation,
    imageOffsetX: style.imageOffsetX,
    imageOffsetY: style.imageOffsetY,
    imageScale: style.imageScale,
    imageRotationDeg: style.imageRotationDeg,
    controlledBy,
    createdAt: toIsoString(token.createdAt),
    updatedAt: toIsoString(token.updatedAt)
  });
};

const findRoomByReference = async (
  db: PrismaDbClient,
  args: {
    roomId?: string | undefined;
    joinSecret?: string | undefined;
  }
) => {
  if (args.roomId) {
    return db.room.findUnique({
      where: {
        id: args.roomId
      }
    });
  }

  if (args.joinSecret) {
    return db.room.findUnique({
      where: {
        joinSecret: args.joinSecret
      }
    });
  }

  return null;
};

const ensureRoomSettings = async (db: PrismaDbClient, roomId: string) => {
  return db.roomSettings.upsert({
    where: {
      roomId
    },
    update: {},
    create: {
      roomId,
      tokenMovePolicy: 'ALL',
      mapEditPolicy: 'DM_ONLY',
      mapEditUserOverridesJson: []
    }
  });
};

const loadRoomState = async (db: PrismaDbClient, roomId: string) => {
  const [settings, tokens, members, room] = await Promise.all([
    ensureRoomSettings(db, roomId),
    db.token.findMany({
      where: {
        roomId
      },
      orderBy: {
        createdAt: 'asc'
      }
    }),
    db.roomMember.findMany({
      where: {
        roomId
      },
      orderBy: {
        joinedAt: 'asc'
      }
    }),
    db.room.findUnique({
      where: {
        id: roomId
      },
      select: {
        currentMapAssetId: true,
        currentMapAsset: true
      }
    })
  ]);

  if (!room) {
    throw new RoomServiceError('ROOM_NOT_FOUND', 404, 'Room not found');
  }

  return {
    settings: toSharedSettings(settings),
    tokens: tokens.map((token) => toSharedToken(token)),
    members: members.map((member) => toSharedMember(member)),
    currentMapAssetId: room.currentMapAssetId,
    currentMapAsset: room.currentMapAsset ? toSharedAsset(room.currentMapAsset) : null
  };
};

const ensureGuestUser = async (db: PrismaDbClient, clientId: string) => {
  return db.user.upsert({
    where: {
      externalId: clientId
    },
    update: {},
    create: {
      externalId: clientId
    }
  });
};

const determineRole = (args: {
  roomDmUserId: string;
  userId: string;
  existingRole?: Role | undefined;
  roleDesired?: 'PLAYER' | 'SPECTATOR' | undefined;
}): Role => {
  if (args.roomDmUserId === args.userId) {
    return 'DM';
  }

  if (args.existingRole) {
    return args.existingRole;
  }

  if (args.roleDesired === 'SPECTATOR') {
    return 'SPECTATOR';
  }

  return 'PLAYER';
};

export const createRoomForGuest = async (args: {
  name: string;
  displayName: string;
  clientId: string;
  storageMode?: SharedStorageMode;
}) => {
  const storageMode = StorageModeSchema.parse(args.storageMode ?? 'LOCAL');

  const result = await prisma.$transaction(async (tx) => {
    const user = await ensureGuestUser(tx, args.clientId);
    const joinSecret = await generateUniqueJoinSecret(tx);

    const room = await tx.room.create({
      data: {
        name: args.name,
        dmUserId: user.id,
        storageMode,
        joinSecret,
        isPublic: false
      }
    });

    const now = new Date();

    const member = await tx.roomMember.create({
      data: {
        roomId: room.id,
        userId: user.id,
        role: 'DM',
        displayName: args.displayName,
        joinedAt: now,
        lastSeenAt: now
      }
    });

    const state = room.storageMode === 'CLOUD' ? await loadRoomState(tx, room.id) : null;

    return {
      room,
      user,
      member,
      state
    };
  });

  return {
    room: toSharedRoom(result.room),
    userId: result.user.id,
    roleAssigned: result.member.role as Role,
    member: toSharedMember(result.member),
    ...(result.state
      ? {
          settings: result.state.settings,
          tokens: result.state.tokens,
          members: result.state.members,
          currentMapAssetId: result.state.currentMapAssetId,
          currentMapAsset: result.state.currentMapAsset
        }
      : {})
  };
};

const joinRoomInternal = async (args: {
  roomId?: string | undefined;
  joinSecret?: string | undefined;
  displayName: string;
  clientId: string;
  roleDesired?: 'PLAYER' | 'SPECTATOR' | undefined;
}) => {
  return prisma.$transaction(async (tx) => {
    const room = await findRoomByReference(tx, {
      roomId: args.roomId,
      joinSecret: args.joinSecret
    });

    if (!room) {
      throw new RoomServiceError('ROOM_NOT_FOUND', 404, 'Room not found');
    }

    const user = await ensureGuestUser(tx, args.clientId);

    const existingMember = await tx.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: user.id
        }
      }
    });

    const role = determineRole({
      roomDmUserId: room.dmUserId,
      userId: user.id,
      existingRole: existingMember?.role as Role | undefined,
      roleDesired: args.roleDesired
    });

    const now = new Date();

    const member = await tx.roomMember.upsert({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: user.id
        }
      },
      update: {
        displayName: args.displayName,
        role,
        lastSeenAt: now
      },
      create: {
        roomId: room.id,
        userId: user.id,
        role,
        displayName: args.displayName,
        joinedAt: now,
        lastSeenAt: now
      }
    });

    const state = room.storageMode === 'CLOUD' ? await loadRoomState(tx, room.id) : null;

    return {
      room,
      user,
      member,
      state
    };
  });
};

export const joinRoomBySecretForGuest = async (args: {
  joinSecret: string;
  displayName: string;
  clientId: string;
  roleDesired?: 'PLAYER' | 'SPECTATOR' | undefined;
}) => {
  const result = await joinRoomInternal(args);

  return {
    room: toSharedRoom(result.room),
    userId: result.user.id,
    roleAssigned: result.member.role as Role,
    member: toSharedMember(result.member),
    ...(result.state
      ? {
          settings: result.state.settings,
          tokens: result.state.tokens,
          members: result.state.members,
          currentMapAssetId: result.state.currentMapAssetId,
          currentMapAsset: result.state.currentMapAsset
        }
      : {})
  };
};

export const joinRoomForSocketHello = async (args: {
  roomId?: string | undefined;
  joinSecret?: string | undefined;
  displayName: string;
  clientId: string;
  roleDesired?: 'PLAYER' | 'SPECTATOR' | undefined;
}) => {
  const result = await joinRoomInternal(args);

  return {
    room: toSharedRoom(result.room),
    userId: result.user.id,
    roleAssigned: result.member.role as Role,
    member: toSharedMember(result.member),
    ...(result.state
      ? {
          settings: result.state.settings,
          tokens: result.state.tokens,
          members: result.state.members,
          currentMapAssetId: result.state.currentMapAssetId,
          currentMapAsset: result.state.currentMapAsset
        }
      : {})
  };
};

export const getRoomStateById = async (roomId: string) => {
  const room = await prisma.room.findUnique({
    where: {
      id: roomId
    }
  });

  if (!room) {
    throw new RoomServiceError('ROOM_NOT_FOUND', 404, 'Room not found');
  }

  if (room.storageMode === 'LOCAL') {
    throw new RoomServiceError(
      'LOCAL_STATE_NOT_AVAILABLE',
      409,
      'LOCAL rooms do not expose server-side game state'
    );
  }

  const state = await loadRoomState(prisma, room.id);

  return {
    room: toSharedRoom(room),
    settings: state.settings,
    tokens: state.tokens,
    members: state.members,
    currentMapAssetId: state.currentMapAssetId,
    currentMapAsset: state.currentMapAsset
  };
};

export const getRoomStorageMode = async (roomId: string): Promise<SharedStorageMode | null> => {
  const room = await prisma.room.findUnique({
    where: {
      id: roomId
    },
    select: {
      storageMode: true
    }
  });

  if (!room) {
    return null;
  }

  return StorageModeSchema.parse(room.storageMode);
};

export const getRoomMemberForUser = async (roomId: string, userId: string): Promise<RoomMember | null> => {
  const member = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: {
        roomId,
        userId
      }
    }
  });

  return member ? toSharedMember(member) : null;
};

export const getRoomMemberForClientId = async (
  roomId: string,
  clientId: string
): Promise<RoomMember | null> => {
  const member = await prisma.roomMember.findFirst({
    where: {
      roomId,
      user: {
        externalId: clientId
      }
    }
  });

  return member ? toSharedMember(member) : null;
};

export const setCurrentMapForRoom = async (args: {
  roomId: string;
  assetId: string;
}): Promise<{
  currentMapAssetId: string | null;
  currentMapAsset: RoomAsset | null;
}> => {
  const room = await prisma.room.findUnique({
    where: {
      id: args.roomId
    },
    select: {
      id: true,
      storageMode: true
    }
  });

  if (!room) {
    throw new RoomServiceError('ROOM_NOT_FOUND', 404, 'Room not found');
  }

  if (room.storageMode === 'LOCAL') {
    throw new RoomServiceError('LOCAL_MODE_NO_SERVER_STATE', 400, 'Current map is host-managed in LOCAL mode');
  }

  const asset = await prisma.asset.findFirst({
    where: {
      id: args.assetId,
      roomId: args.roomId
    }
  });

  if (!asset) {
    throw new RoomServiceError('ASSET_NOT_FOUND', 404, 'Asset not found in this room');
  }

  if (asset.type !== 'MAP') {
    throw new RoomServiceError('INVALID_ASSET_TYPE', 400, 'Only MAP assets can be set as current map');
  }

  const updatedRoom = await prisma.room.update({
    where: {
      id: args.roomId
    },
    data: {
      currentMapAssetId: asset.id
    },
    select: {
      currentMapAssetId: true,
      currentMapAsset: true
    }
  });

  return {
    currentMapAssetId: updatedRoom.currentMapAssetId,
    currentMapAsset: updatedRoom.currentMapAsset ? toSharedAsset(updatedRoom.currentMapAsset) : null
  };
};

export const updateRoomSettings = async (args: {
  roomId: string;
  tokenMovePolicy: SharedTokenMovePolicy;
  mapEditPolicy: SharedMapEditPolicy;
  mapEditUserOverrides: MapEditUserOverride[];
}) => {
  await assertCloudStateAccessForRoom({
    roomId: args.roomId,
    operation: 'RoomSettings.upsert'
  });

  const tokenMovePolicy = TokenMovePolicySchema.parse(args.tokenMovePolicy);
  const mapEditPolicy = MapEditPolicySchema.parse(args.mapEditPolicy);
  const mapEditUserOverrides = normalizeMapEditUserOverrides(
    MapEditUserOverrideSchema.array().parse(args.mapEditUserOverrides)
  );

  const updated = await prisma.roomSettings.upsert({
    where: {
      roomId: args.roomId
    },
    update: {
      tokenMovePolicy,
      mapEditPolicy,
      mapEditUserOverridesJson: serializeMapEditUserOverrides(mapEditUserOverrides)
    },
    create: {
      roomId: args.roomId,
      tokenMovePolicy,
      mapEditPolicy,
      mapEditUserOverridesJson: serializeMapEditUserOverrides(mapEditUserOverrides)
    }
  });

  return toSharedSettings(updated);
};

export const getRoomSettings = async (roomId: string): Promise<RoomSettings> => {
  await assertCloudStateAccessForRoom({
    roomId,
    operation: 'RoomSettings.upsert'
  });

  const settings = await ensureRoomSettings(prisma, roomId);
  return toSharedSettings(settings);
};

export const getTokenById = async (roomId: string, tokenId: string): Promise<VttToken | null> => {
  await assertCloudStateAccessForRoom({
    roomId,
    operation: 'Token.findFirst'
  });

  const token = await prisma.token.findFirst({
    where: {
      id: tokenId,
      roomId
    }
  });

  return token ? toSharedToken(token) : null;
};

const ensureTokenImageAssetForRoom = async (args: {
  roomId: string;
  assetId: string;
}): Promise<void> => {
  const asset = await prisma.asset.findFirst({
    where: {
      id: args.assetId,
      roomId: args.roomId,
      type: 'TOKEN_IMAGE'
    },
    select: {
      id: true
    }
  });

  if (!asset) {
    throw new RoomServiceError('ASSET_NOT_FOUND', 404, 'Token image asset not found in this room');
  }
};

const resolveControlledByForNewToken = (args: {
  tokenMovePolicy: SharedTokenMovePolicy;
  creatorUserId: string;
  kind?: TokenKind | undefined;
  color?: string | null | undefined;
  elevation?: number | undefined;
  imageOffsetX?: number | undefined;
  imageOffsetY?: number | undefined;
  imageScale?: number | undefined;
  imageRotationDeg?: number | undefined;
}): TokenControlledBy => {
  const style = {
    kind: args.kind ? TokenKindSchema.parse(args.kind) : 'ENEMY',
    color:
      args.color === undefined || args.color === null || args.color === ''
        ? undefined
        : TokenColorSchema.parse(args.color),
    elevation:
      args.elevation === undefined
        ? undefined
        : Math.max(0, Math.min(999, Math.floor(Number(args.elevation)))),
    image: {
      offsetX:
        args.imageOffsetX === undefined ? undefined : Math.max(-500, Math.min(500, Number(args.imageOffsetX))),
      offsetY:
        args.imageOffsetY === undefined ? undefined : Math.max(-500, Math.min(500, Number(args.imageOffsetY))),
      scale: args.imageScale === undefined ? undefined : Math.max(0.1, Math.min(6, Number(args.imageScale))),
      rotationDeg:
        args.imageRotationDeg === undefined ? undefined : Math.max(-180, Math.min(180, Number(args.imageRotationDeg)))
    }
  };

  if (args.tokenMovePolicy === 'OWNED_ONLY') {
    return {
      mode: 'USERS',
      userIds: [args.creatorUserId],
      style
    };
  }

  return {
    mode: 'ALL',
    style
  };
};

export const createToken = async (args: {
  roomId: string;
  name: string;
  x: number;
  y: number;
  size: number;
  assetId?: string | null | undefined;
  kind?: TokenKind | undefined;
  color?: string | null | undefined;
  elevation?: number | undefined;
  imageOffsetX?: number | undefined;
  imageOffsetY?: number | undefined;
  imageScale?: number | undefined;
  imageRotationDeg?: number | undefined;
  creatorUserId: string;
  tokenMovePolicy: SharedTokenMovePolicy;
}) => {
  await assertCloudStateAccessForRoom({
    roomId: args.roomId,
    operation: 'Token.create'
  });

  if (args.assetId) {
    await ensureTokenImageAssetForRoom({
      roomId: args.roomId,
      assetId: args.assetId
    });
  }

  const controlledBy = resolveControlledByForNewToken({
    tokenMovePolicy: args.tokenMovePolicy,
    creatorUserId: args.creatorUserId,
    kind: args.kind,
    color: args.color,
    elevation: args.elevation,
    imageOffsetX: args.imageOffsetX,
    imageOffsetY: args.imageOffsetY,
    imageScale: args.imageScale,
    imageRotationDeg: args.imageRotationDeg
  });

  const created = await prisma.token.create({
    data: {
      roomId: args.roomId,
      name: args.name,
      x: args.x,
      y: args.y,
      size: args.size,
      assetId: args.assetId ?? null,
      controlledByJson: serializeTokenControlledBy(controlledBy)
    }
  });

  return toSharedToken(created);
};

export const updateToken = async (args: {
  roomId: string;
  tokenId: string;
  name?: string;
  assetId?: string | null;
  kind?: TokenKind;
  color?: string | null;
  elevation?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  imageScale?: number;
  imageRotationDeg?: number;
}) => {
  await assertCloudStateAccessForRoom({
    roomId: args.roomId,
    operation: 'Token.updateMany'
  });

  const token = await prisma.token.findFirst({
    where: {
      id: args.tokenId,
      roomId: args.roomId
    }
  });

  if (!token) {
    throw new RoomServiceError('TOKEN_NOT_FOUND', 404, 'Token not found in room');
  }

  if (args.assetId !== undefined && args.assetId !== null) {
    await ensureTokenImageAssetForRoom({
      roomId: args.roomId,
      assetId: args.assetId
    });
  }

  const currentControlledBy = parseTokenControlledBy(token.controlledByJson);
  const nextKind = args.kind ? TokenKindSchema.parse(args.kind) : currentControlledBy.style?.kind ?? 'ENEMY';
  const nextColor =
    args.color === undefined
      ? currentControlledBy.style?.color
      : args.color === null || args.color === ''
        ? undefined
        : TokenColorSchema.parse(args.color);
  const nextElevation =
    args.elevation === undefined
      ? currentControlledBy.style?.elevation
      : Math.max(0, Math.min(999, Math.floor(Number(args.elevation))));
  const nextImageOffsetX =
    args.imageOffsetX === undefined
      ? currentControlledBy.style?.image?.offsetX
      : Math.max(-500, Math.min(500, Number(args.imageOffsetX)));
  const nextImageOffsetY =
    args.imageOffsetY === undefined
      ? currentControlledBy.style?.image?.offsetY
      : Math.max(-500, Math.min(500, Number(args.imageOffsetY)));
  const nextImageScale =
    args.imageScale === undefined
      ? currentControlledBy.style?.image?.scale
      : Math.max(0.1, Math.min(6, Number(args.imageScale)));
  const nextImageRotationDeg =
    args.imageRotationDeg === undefined
      ? currentControlledBy.style?.image?.rotationDeg
      : Math.max(-180, Math.min(180, Number(args.imageRotationDeg)));

  const nextControlledBy: TokenControlledBy = {
    ...currentControlledBy,
    style: {
      kind: nextKind,
      color: nextColor,
      elevation: nextElevation,
      image: {
        offsetX: nextImageOffsetX,
        offsetY: nextImageOffsetY,
        scale: nextImageScale,
        rotationDeg: nextImageRotationDeg
      }
    }
  };

  const updateData: Prisma.TokenUncheckedUpdateManyInput = {
    controlledByJson: serializeTokenControlledBy(nextControlledBy)
  };

  if (args.name !== undefined) {
    updateData.name = args.name;
  }

  if (args.assetId !== undefined) {
    updateData.assetId = args.assetId;
  }

  const updatedCount = await prisma.token.updateMany({
    where: {
      id: token.id,
      roomId: args.roomId
    },
    data: updateData
  });

  if (updatedCount.count === 0) {
    throw new RoomServiceError('TOKEN_NOT_FOUND', 404, 'Token not found in room');
  }

  const updated = await prisma.token.findUnique({
    where: {
      id: token.id
    }
  });

  if (!updated) {
    throw new RoomServiceError('TOKEN_NOT_FOUND', 404, 'Token not found in room');
  }

  return toSharedToken(updated);
};

export const moveToken = async (args: { roomId: string; tokenId: string; x: number; y: number }) => {
  await assertCloudStateAccessForRoom({
    roomId: args.roomId,
    operation: 'Token.updateMany'
  });

  const updatedCount = await prisma.token.updateMany({
    where: {
      id: args.tokenId,
      roomId: args.roomId
    },
    data: {
      x: args.x,
      y: args.y
    }
  });

  if (updatedCount.count === 0) {
    throw new RoomServiceError('TOKEN_NOT_FOUND', 404, 'Token not found in room');
  }

  const updated = await prisma.token.findUnique({
    where: {
      id: args.tokenId
    }
  });

  if (!updated) {
    throw new RoomServiceError('TOKEN_NOT_FOUND', 404, 'Token not found in room');
  }

  return toSharedToken(updated);
};

export const deleteToken = async (args: { roomId: string; tokenId: string }) => {
  await assertCloudStateAccessForRoom({
    roomId: args.roomId,
    operation: 'Token.delete'
  });

  const existing = await prisma.token.findFirst({
    where: {
      id: args.tokenId,
      roomId: args.roomId
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    throw new RoomServiceError('TOKEN_NOT_FOUND', 404, 'Token not found in room');
  }

  await prisma.token.delete({
    where: {
      id: args.tokenId
    }
  });

  return existing.id;
};

export const touchMemberLastSeen = async (roomId: string, userId: string): Promise<void> => {
  await prisma.roomMember.update({
    where: {
      roomId_userId: {
        roomId,
        userId
      }
    },
    data: {
      lastSeenAt: new Date()
    }
  });
};
