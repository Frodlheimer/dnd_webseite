import type { FastifyPluginAsync } from 'fastify';
import {
  CreateRoomRequestSchema,
  CreateRoomResponseSchema,
  JoinRoomRequestSchema,
  JoinRoomResponseSchema,
  ListRoomAssetsQuerySchema,
  ListRoomAssetsResponseSchema,
  RoomIdSchema,
  RoomStateResponseSchema,
  SetRoomMapRequestSchema,
  SetRoomMapResponseSchema
} from '@dnd-vtt/shared';

import { listRoomAssets } from '../assets/service.js';
import { LocalStrictAccessError } from '../rooms/localStrict.js';
import {
  RoomServiceError,
  createRoomForGuest,
  getRoomMemberForClientId,
  getRoomStorageMode,
  getRoomStateById,
  joinRoomBySecretForGuest,
  setCurrentMapForRoom
} from '../rooms/service.js';
import { canSetRoomMap } from '../ws/authz.js';
import { isRoomUserOnline } from '../ws/presence-registry.js';
import { emitRoomMapUpdated } from '../ws/room-events.js';

const resolveWsUrl = (): string => {
  return process.env.WS_URL ?? 'ws://localhost:3000/ws';
};

export const roomRoutes: FastifyPluginAsync = async (app) => {
  const resolveClientIdHeader = (headers: Record<string, unknown>): string | null => {
    const rawValue = headers['x-client-id'];

    if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
      return rawValue.trim();
    }

    if (Array.isArray(rawValue) && typeof rawValue[0] === 'string' && rawValue[0].trim().length > 0) {
      return rawValue[0].trim();
    }

    return null;
  };

  app.post('/rooms', async (request, reply) => {
    const parsedBody = CreateRoomRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        code: 'INVALID_REQUEST',
        message: parsedBody.error.message
      });
    }

    try {
      const result = await createRoomForGuest(
        parsedBody.data.storageMode
          ? {
              ...parsedBody.data,
              storageMode: parsedBody.data.storageMode
            }
          : {
              name: parsedBody.data.name,
              displayName: parsedBody.data.displayName,
              clientId: parsedBody.data.clientId
            }
      );

      const payload =
        result.room.storageMode === 'LOCAL'
          ? CreateRoomResponseSchema.parse({
              roomId: result.room.id,
              joinSecret: result.room.joinSecret,
              storageMode: result.room.storageMode,
              hostUserId: result.room.dmUserId,
              wsUrl: resolveWsUrl(),
              roleAssigned: result.roleAssigned,
              member: result.member
            })
          : CreateRoomResponseSchema.parse({
              roomId: result.room.id,
              joinSecret: result.room.joinSecret,
              storageMode: result.room.storageMode,
              hostUserId: result.room.dmUserId,
              wsUrl: resolveWsUrl(),
              roleAssigned: result.roleAssigned,
              member: result.member,
              settings: result.settings,
              tokens: result.tokens,
              members: result.members,
              currentMapAssetId: result.currentMapAssetId,
              currentMapAsset: result.currentMapAsset
            });

      return reply.status(201).send(payload);
    } catch (error) {
      if (error instanceof RoomServiceError || error instanceof LocalStrictAccessError) {
        return reply.status(error.statusCode).send({
          code: error.code,
          message: error.message
        });
      }

      throw error;
    }
  });

  app.post('/rooms/join', async (request, reply) => {
    const parsedBody = JoinRoomRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        code: 'INVALID_REQUEST',
        message: parsedBody.error.message
      });
    }

    try {
      const result = await joinRoomBySecretForGuest(parsedBody.data);

      if (
        result.room.storageMode === 'LOCAL' &&
        result.userId !== result.room.dmUserId &&
        !isRoomUserOnline(result.room.id, result.room.dmUserId)
      ) {
        return reply.status(409).send({
          code: 'HOST_OFFLINE',
          message: 'Host (DM) must be online to join a LOCAL room'
        });
      }

      const payload =
        result.room.storageMode === 'LOCAL'
          ? JoinRoomResponseSchema.parse({
              roomId: result.room.id,
              storageMode: result.room.storageMode,
              hostUserId: result.room.dmUserId,
              wsUrl: resolveWsUrl(),
              roleAssigned: result.roleAssigned,
              member: result.member
            })
          : JoinRoomResponseSchema.parse({
              roomId: result.room.id,
              storageMode: result.room.storageMode,
              hostUserId: result.room.dmUserId,
              wsUrl: resolveWsUrl(),
              roleAssigned: result.roleAssigned,
              member: result.member,
              settings: result.settings,
              tokens: result.tokens,
              members: result.members,
              currentMapAssetId: result.currentMapAssetId,
              currentMapAsset: result.currentMapAsset
            });

      return reply.send(payload);
    } catch (error) {
      if (error instanceof RoomServiceError || error instanceof LocalStrictAccessError) {
        return reply.status(error.statusCode).send({
          code: error.code,
          message: error.message
        });
      }

      throw error;
    }
  });

  app.get('/rooms/:id/state', async (request, reply) => {
    const params = request.params as { id?: string };
    const roomIdResult = RoomIdSchema.safeParse(params.id);

    if (!roomIdResult.success) {
      return reply.status(400).send({
        code: 'INVALID_ROOM_ID',
        message: roomIdResult.error.message
      });
    }

    try {
      const state = await getRoomStateById(roomIdResult.data);

      return RoomStateResponseSchema.parse({
        roomId: state.room.id,
        storageMode: state.room.storageMode,
        hostUserId: state.room.dmUserId,
        settings: state.settings,
        tokens: state.tokens,
        members: state.members,
        currentMapAssetId: state.currentMapAssetId,
        currentMapAsset: state.currentMapAsset
      });
    } catch (error) {
      if (error instanceof RoomServiceError || error instanceof LocalStrictAccessError) {
        return reply.status(error.statusCode).send({
          code: error.code,
          message: error.message
        });
      }

      throw error;
    }
  });

  app.get('/rooms/:roomId/assets', async (request, reply) => {
    const params = request.params as { roomId?: unknown };
    const roomIdResult = RoomIdSchema.safeParse(params.roomId);

    if (!roomIdResult.success) {
      return reply.status(400).send({
        code: 'INVALID_ROOM_ID',
        message: roomIdResult.error.message
      });
    }

    const queryResult = ListRoomAssetsQuerySchema.safeParse(request.query ?? {});

    if (!queryResult.success) {
      return reply.status(400).send({
        code: 'INVALID_QUERY',
        message: queryResult.error.message
      });
    }

    const clientId = resolveClientIdHeader(request.headers as Record<string, unknown>);

    if (!clientId) {
      return reply.status(400).send({
        code: 'CLIENT_ID_REQUIRED',
        message: 'x-client-id header is required'
      });
    }

    const member = await getRoomMemberForClientId(roomIdResult.data, clientId);

    if (!member) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'You are not a member of this room'
      });
    }

    try {
      const storageMode = await getRoomStorageMode(roomIdResult.data);
      if (storageMode === 'LOCAL') {
        return ListRoomAssetsResponseSchema.parse({
          assets: []
        });
      }

      const assets = await listRoomAssets(
        queryResult.data.type
          ? {
              roomId: roomIdResult.data,
              type: queryResult.data.type
            }
          : {
              roomId: roomIdResult.data
            }
      );

      return ListRoomAssetsResponseSchema.parse({
        assets
      });
    } catch (error) {
      if (error instanceof RoomServiceError || error instanceof LocalStrictAccessError) {
        return reply.status(error.statusCode).send({
          code: error.code,
          message: error.message
        });
      }

      throw error;
    }
  });

  app.post('/rooms/:roomId/map', async (request, reply) => {
    const params = request.params as { roomId?: unknown };
    const roomIdResult = RoomIdSchema.safeParse(params.roomId);

    if (!roomIdResult.success) {
      return reply.status(400).send({
        code: 'INVALID_ROOM_ID',
        message: roomIdResult.error.message
      });
    }

    const bodyResult = SetRoomMapRequestSchema.safeParse(request.body);

    if (!bodyResult.success) {
      return reply.status(400).send({
        code: 'INVALID_REQUEST',
        message: bodyResult.error.message
      });
    }

    const clientId = resolveClientIdHeader(request.headers as Record<string, unknown>);

    if (!clientId) {
      return reply.status(400).send({
        code: 'CLIENT_ID_REQUIRED',
        message: 'x-client-id header is required'
      });
    }

    const member = await getRoomMemberForClientId(roomIdResult.data, clientId);

    if (!member) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'You are not a member of this room'
      });
    }

    if (!canSetRoomMap(member.role)) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Only DM can set the current map'
      });
    }

    try {
      const result = await setCurrentMapForRoom({
        roomId: roomIdResult.data,
        assetId: bodyResult.data.assetId
      });

      emitRoomMapUpdated({
        roomId: roomIdResult.data,
        currentMapAssetId: result.currentMapAssetId,
        currentMapAsset: result.currentMapAsset
      });

      return SetRoomMapResponseSchema.parse(result);
    } catch (error) {
      if (error instanceof RoomServiceError || error instanceof LocalStrictAccessError) {
        return reply.status(error.statusCode).send({
          code: error.code,
          message: error.message
        });
      }

      throw error;
    }
  });
};
