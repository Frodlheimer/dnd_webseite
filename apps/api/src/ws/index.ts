import { randomUUID } from 'node:crypto';

import type {
  ClientToServerMessage,
  MapEditElement,
  MapEditOperation,
  PresenceMember,
  Role,
  StorageMode,
  ServerToClientMessage
} from '@dnd-vtt/shared';
import type { FastifyPluginAsync } from 'fastify';

import {
  RoomServiceError,
  createToken,
  deleteToken,
  getRoomMemberForUser,
  getRoomSettings,
  getTokenById,
  joinRoomForSocketHello,
  moveToken,
  setCurrentMapForRoom,
  touchMemberLastSeen,
  updateToken,
  updateRoomSettings
} from '../rooms/service.js';
import { LocalStrictAccessError } from '../rooms/localStrict.js';
import { canPerformTokenAction, canSetRoomMap, canUpdateRoomSettings, canUseMapEdit } from './authz.js';
import {
  MAX_WS_JSON_BYTES,
  createWsRateLimiter,
  isWsJsonMessageTooLarge
} from './limits.js';
import { handleLocalRelayMessage } from './localRelay.js';
import { isRoomUserOnline, markRoomUserOffline, markRoomUserOnline } from './presence-registry.js';
import { createErrorMessage, parseClientMessage, serializeServerMessage } from './protocol.js';
import { emitRoomMapUpdated, onRoomAssetCreated, onRoomMapUpdated } from './room-events.js';

type WsSocket = {
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  send: (payload: string) => void;
  close: (code?: number, reason?: string) => void;
};

type SocketSession = {
  connectionId: string;
  roomId: string;
  userId: string;
  hostUserId: string;
  storageMode: StorageMode;
  role: Role;
  displayName: string;
  socket: WsSocket;
};

const roomConnections = new Map<string, Map<string, SocketSession>>();
type RoomMapEditState = {
  revision: number;
  elements: MapEditElement[];
};
const cloudRoomMapEditStates = new Map<string, RoomMapEditState>();

const LOCAL_RELAY_REQUIRED_MESSAGE_TYPES = [
  'TOKEN_CREATE',
  'TOKEN_MOVE',
  'TOKEN_UPDATE',
  'TOKEN_DELETE',
  'ROOM_SETTINGS_UPDATE',
  'ROOM_SET_MAP',
  'MAP_EDIT_OPS'
] as const;

type LocalRelayRequiredMessageType = (typeof LOCAL_RELAY_REQUIRED_MESSAGE_TYPES)[number];

const localRelayRequiredMessageTypeSet = new Set<ClientToServerMessage['type']>(LOCAL_RELAY_REQUIRED_MESSAGE_TYPES);

const isLocalRelayRequiredMessageType = (
  messageType: ClientToServerMessage['type']
): messageType is LocalRelayRequiredMessageType => {
  return localRelayRequiredMessageTypeSet.has(messageType);
};

const cloneMapEditPoint = (point: { x: number; y: number }): { x: number; y: number } => ({
  x: point.x,
  y: point.y
});

const cloneMapEditEraseStrokes = (
  eraseStrokes: { strokeWidth: number; points: { x: number; y: number }[] }[] | undefined
) => {
  if (!eraseStrokes) {
    return undefined;
  }

  return eraseStrokes.map((stroke) => ({
    strokeWidth: stroke.strokeWidth,
    points: stroke.points.map((point) => cloneMapEditPoint(point))
  }));
};

const withClonedEraseStrokes = <T extends MapEditElement>(
  element: T,
  eraseStrokes: { strokeWidth: number; points: { x: number; y: number }[] }[] | undefined
): T => {
  if (!eraseStrokes || eraseStrokes.length === 0) {
    return element;
  }

  return {
    ...element,
    eraseStrokes
  };
};

const cloneMapEditElement = (element: MapEditElement): MapEditElement => {
  if (element.type === 'PATH' || element.type === 'ERASE_PATH') {
    return withClonedEraseStrokes(
      {
      ...element,
      points: element.points.map((point) => cloneMapEditPoint(point))
      },
      cloneMapEditEraseStrokes(element.eraseStrokes)
    );
  }

  if (element.type === 'LINE') {
    return withClonedEraseStrokes(
      {
      ...element,
      from: cloneMapEditPoint(element.from),
      to: cloneMapEditPoint(element.to)
      },
      cloneMapEditEraseStrokes(element.eraseStrokes)
    );
  }

  return withClonedEraseStrokes(
    {
      ...element
    },
    cloneMapEditEraseStrokes(element.eraseStrokes)
  );
};

const cloneMapEditElements = (elements: MapEditElement[]): MapEditElement[] => {
  return elements.map((element) => cloneMapEditElement(element));
};

const applyMapEditOperations = (current: MapEditElement[], operations: MapEditOperation[]): MapEditElement[] => {
  let next = current;

  for (const operation of operations) {
    if (operation.kind === 'CLEAR') {
      if (next.length === 0) {
        continue;
      }

      next = [];
      continue;
    }

    if (operation.kind === 'DELETE') {
      if (operation.elementIds.length === 0 || next.length === 0) {
        continue;
      }

      const ids = new Set(operation.elementIds);
      const filtered = next.filter((element) => !ids.has(element.id));
      if (filtered.length !== next.length) {
        next = filtered;
      }
      continue;
    }

    if (operation.elements.length === 0) {
      continue;
    }

    const indexById = new Map<string, number>();
    next.forEach((element, index) => {
      indexById.set(element.id, index);
    });

    let updated = false;
    const copy = [...next];

    for (const element of operation.elements) {
      const existingIndex = indexById.get(element.id);
      const cloned = cloneMapEditElement(element);

      if (existingIndex === undefined) {
        copy.push(cloned);
        updated = true;
        continue;
      }

      copy[existingIndex] = cloned;
      updated = true;
    }

    if (updated) {
      next = copy;
    }
  }

  return next;
};

const getOrCreateRoomMapEditState = (roomId: string): RoomMapEditState => {
  const existing = cloudRoomMapEditStates.get(roomId);
  if (existing) {
    return existing;
  }

  const created: RoomMapEditState = {
    revision: 0,
    elements: []
  };
  cloudRoomMapEditStates.set(roomId, created);
  return created;
};

const rawDataToString = (rawData: unknown): string => {
  if (typeof rawData === 'string') {
    return rawData;
  }

  if (rawData instanceof Buffer) {
    return rawData.toString('utf8');
  }

  if (Array.isArray(rawData) && rawData.every((item) => item instanceof Buffer)) {
    return Buffer.concat(rawData).toString('utf8');
  }

  if (rawData instanceof ArrayBuffer) {
    return Buffer.from(rawData).toString('utf8');
  }

  if (ArrayBuffer.isView(rawData)) {
    return Buffer.from(rawData.buffer).toString('utf8');
  }

  return '';
};

const sendMessage = (socket: WsSocket, message: ServerToClientMessage): void => {
  try {
    socket.send(serializeServerMessage(message));
  } catch {
    // Connection can disappear between auth check and send.
  }
};

const sendError = (
  socket: WsSocket,
  code: string,
  message: string,
  details?: {
    rejectedType?: string | undefined;
    hint?: string | undefined;
  }
): void => {
  sendMessage(socket, createErrorMessage(code, message, details));
};

const buildMembersOnline = (roomId: string): PresenceMember[] => {
  const roomSessionMap = roomConnections.get(roomId);

  if (!roomSessionMap) {
    return [];
  }

  const byUserId = new Map<string, PresenceMember>();

  for (const session of roomSessionMap.values()) {
    byUserId.set(session.userId, {
      userId: session.userId,
      displayName: session.displayName,
      role: session.role
    });
  }

  return [...byUserId.values()];
};

const getRoomHostUserId = (roomId: string): string | null => {
  const roomSessionMap = roomConnections.get(roomId);
  if (!roomSessionMap || roomSessionMap.size === 0) {
    return null;
  }

  const first = roomSessionMap.values().next().value as SocketSession | undefined;
  return first?.hostUserId ?? null;
};

const sendToUser = (roomId: string, userId: string, message: ServerToClientMessage): boolean => {
  const roomSessionMap = roomConnections.get(roomId);
  if (!roomSessionMap) {
    return false;
  }

  let delivered = false;
  for (const session of roomSessionMap.values()) {
    if (session.userId !== userId) {
      continue;
    }

    sendMessage(session.socket, message);
    delivered = true;
  }

  return delivered;
};

const broadcastToRoom = (roomId: string, message: ServerToClientMessage): void => {
  const roomSessionMap = roomConnections.get(roomId);

  if (!roomSessionMap) {
    return;
  }

  for (const session of roomSessionMap.values()) {
    sendMessage(session.socket, message);
  }
};

const broadcastToRoomExcept = (roomId: string, excludedConnectionId: string, message: ServerToClientMessage): void => {
  const roomSessionMap = roomConnections.get(roomId);

  if (!roomSessionMap) {
    return;
  }

  for (const session of roomSessionMap.values()) {
    if (session.connectionId === excludedConnectionId) {
      continue;
    }

    sendMessage(session.socket, message);
  }
};

const broadcastPresence = (roomId: string): void => {
  broadcastToRoom(roomId, {
    type: 'PRESENCE_UPDATE',
    payload: {
      membersOnline: buildMembersOnline(roomId),
      hostUserId: getRoomHostUserId(roomId)
    }
  });
};

const addSession = (session: SocketSession): void => {
  const existing = roomConnections.get(session.roomId);

  if (existing) {
    existing.set(session.connectionId, session);
    markRoomUserOnline(session.roomId, session.userId);
    return;
  }

  roomConnections.set(session.roomId, new Map([[session.connectionId, session]]));
  markRoomUserOnline(session.roomId, session.userId);
};

const removeSession = (session: SocketSession): void => {
  const existing = roomConnections.get(session.roomId);

  if (!existing) {
    return;
  }

  existing.delete(session.connectionId);
  markRoomUserOffline(session.roomId, session.userId);

  if (existing.size === 0) {
    roomConnections.delete(session.roomId);

    if (session.storageMode === 'CLOUD') {
      cloudRoomMapEditStates.delete(session.roomId);
    }
  }
};

const sendHostOffline = (socket: WsSocket): void => {
  sendMessage(socket, {
    type: 'HOST_OFFLINE',
    payload: {
      message: 'Host (DM) is currently offline'
    }
  });
};

const handleRoomMessage = async (session: SocketSession, message: ClientToServerMessage): Promise<void> => {
  if (message.type === 'PING') {
    sendMessage(session.socket, {
      type: 'PONG',
      payload: message.payload
    });
    return;
  }

  if (session.storageMode === 'LOCAL') {
    if (isLocalRelayRequiredMessageType(message.type)) {
      sendError(
        session.socket,
        'LOCAL_REQUIRES_RELAY_TO_HOST',
        `LOCAL mode rejects direct ${message.type} messages`,
        {
          rejectedType: message.type,
          hint: 'Send RELAY_TO_HOST with a HostRequest, then let the host rebroadcast via RELAY_BROADCAST or RELAY_TO_USER'
        }
      );
      return;
    }

    const handled = handleLocalRelayMessage(session, message, {
      isHostOnline: isRoomUserOnline,
      sendToUser,
      broadcastToRoom,
      sendHostOffline,
      sendError
    });
    if (handled) {
      return;
    }

    sendError(session.socket, 'UNSUPPORTED_MESSAGE', `Unsupported LOCAL message type: ${message.type}`);
    return;
  }

  await touchMemberLastSeen(session.roomId, session.userId).catch(() => {
    // Best-effort timestamp update.
  });

  const member = await getRoomMemberForUser(session.roomId, session.userId);

  if (!member) {
    sendError(session.socket, 'MEMBER_NOT_FOUND', 'No active membership for this room');
    return;
  }

  session.role = member.role;
  session.displayName = member.displayName;

  if (message.type === 'ROOM_SETTINGS_UPDATE') {
    if (!canUpdateRoomSettings(member.role)) {
      sendError(session.socket, 'FORBIDDEN', 'Only the DM can update room settings');
      return;
    }

    const settings = await updateRoomSettings({
      roomId: session.roomId,
      tokenMovePolicy: message.payload.tokenMovePolicy,
      mapEditPolicy: message.payload.mapEditPolicy,
      mapEditUserOverrides: message.payload.mapEditUserOverrides
    });

    broadcastToRoom(session.roomId, {
      type: 'ROOM_SETTINGS_UPDATED',
      payload: {
        settings
      }
    });
    return;
  }

  if (message.type === 'ROOM_SET_MAP') {
    if (!canSetRoomMap(member.role)) {
      sendError(session.socket, 'FORBIDDEN', 'Only the DM can set the current map');
      return;
    }

    const mapState = await setCurrentMapForRoom({
      roomId: session.roomId,
      assetId: message.payload.assetId
    });

    emitRoomMapUpdated({
      roomId: session.roomId,
      currentMapAssetId: mapState.currentMapAssetId,
      currentMapAsset: mapState.currentMapAsset
    });
    return;
  }

  const settings = await getRoomSettings(session.roomId);

  if (message.type === 'MAP_EDIT_OPS') {
    const allowed = canUseMapEdit({
      role: member.role,
      userId: session.userId,
      mapEditPolicy: settings.mapEditPolicy,
      mapEditUserOverrides: settings.mapEditUserOverrides
    });

    if (!allowed) {
      sendError(session.socket, 'FORBIDDEN', 'You are not allowed to edit the map');
      return;
    }

    const state = getOrCreateRoomMapEditState(session.roomId);
    state.elements = applyMapEditOperations(state.elements, message.payload.operations);
    state.revision += 1;

    broadcastToRoomExcept(session.roomId, session.connectionId, {
      type: 'MAP_EDIT_OPS_APPLIED',
      payload: {
        revision: state.revision,
        operations: message.payload.operations
      }
    });
    return;
  }

  if (message.type === 'TOKEN_CREATE') {
    const allowed = canPerformTokenAction({
      role: member.role,
      tokenMovePolicy: settings.tokenMovePolicy,
      action: 'create',
      userId: session.userId
    });

    if (!allowed) {
      sendError(session.socket, 'FORBIDDEN', 'You are not allowed to create tokens');
      return;
    }

    const token = await createToken({
      roomId: session.roomId,
      name: message.payload.name,
      x: message.payload.x,
      y: message.payload.y,
      size: message.payload.size,
      assetId: message.payload.assetId,
      kind: message.payload.kind,
      color: message.payload.color,
      elevation: message.payload.elevation,
      imageOffsetX: message.payload.imageOffsetX,
      imageOffsetY: message.payload.imageOffsetY,
      imageScale: message.payload.imageScale,
      imageRotationDeg: message.payload.imageRotationDeg,
      creatorUserId: session.userId,
      tokenMovePolicy: settings.tokenMovePolicy
    });

    broadcastToRoom(session.roomId, {
      type: 'TOKEN_CREATED',
      payload: {
        token
      }
    });
    return;
  }

  if (message.type === 'TOKEN_UPDATE') {
    const token = await getTokenById(session.roomId, message.payload.tokenId);

    if (!token) {
      sendError(session.socket, 'TOKEN_NOT_FOUND', 'Token does not exist');
      return;
    }

    const allowed = canPerformTokenAction({
      role: member.role,
      tokenMovePolicy: settings.tokenMovePolicy,
      action: 'move',
      userId: session.userId,
      controlledBy: token.controlledBy
    });

    if (!allowed) {
      sendError(session.socket, 'FORBIDDEN', 'You are not allowed to update this token');
      return;
    }

    const updateArgs: Parameters<typeof updateToken>[0] = {
      roomId: session.roomId,
      tokenId: token.id
    };

    if (message.payload.name !== undefined) {
      updateArgs.name = message.payload.name;
    }

    if (message.payload.assetId !== undefined) {
      updateArgs.assetId = message.payload.assetId;
    }

    if (message.payload.kind !== undefined) {
      updateArgs.kind = message.payload.kind;
    }

    if (message.payload.color !== undefined) {
      updateArgs.color = message.payload.color;
    }

    if (message.payload.elevation !== undefined) {
      updateArgs.elevation = message.payload.elevation;
    }

    if (message.payload.imageOffsetX !== undefined) {
      updateArgs.imageOffsetX = message.payload.imageOffsetX;
    }

    if (message.payload.imageOffsetY !== undefined) {
      updateArgs.imageOffsetY = message.payload.imageOffsetY;
    }

    if (message.payload.imageScale !== undefined) {
      updateArgs.imageScale = message.payload.imageScale;
    }

    if (message.payload.imageRotationDeg !== undefined) {
      updateArgs.imageRotationDeg = message.payload.imageRotationDeg;
    }

    const updatedToken = await updateToken(updateArgs);

    broadcastToRoom(session.roomId, {
      type: 'TOKEN_UPDATED',
      payload: {
        token: updatedToken
      }
    });
    return;
  }

  if (message.type === 'TOKEN_MOVE') {
    const token = await getTokenById(session.roomId, message.payload.tokenId);

    if (!token) {
      sendError(session.socket, 'TOKEN_NOT_FOUND', 'Token does not exist');
      return;
    }

    const allowed = canPerformTokenAction({
      role: member.role,
      tokenMovePolicy: settings.tokenMovePolicy,
      action: 'move',
      userId: session.userId,
      controlledBy: token.controlledBy
    });

    if (!allowed) {
      sendError(session.socket, 'FORBIDDEN', 'You are not allowed to move this token');
      return;
    }

    const movedToken = await moveToken({
      roomId: session.roomId,
      tokenId: token.id,
      x: message.payload.x,
      y: message.payload.y
    });

    broadcastToRoom(session.roomId, {
      type: 'TOKEN_UPDATED',
      payload: {
        token: movedToken
      }
    });
    return;
  }

  if (message.type === 'TOKEN_DELETE') {
    const token = await getTokenById(session.roomId, message.payload.tokenId);

    if (!token) {
      sendError(session.socket, 'TOKEN_NOT_FOUND', 'Token does not exist');
      return;
    }

    const allowed = canPerformTokenAction({
      role: member.role,
      tokenMovePolicy: settings.tokenMovePolicy,
      action: 'delete',
      userId: session.userId,
      controlledBy: token.controlledBy
    });

    if (!allowed) {
      sendError(session.socket, 'FORBIDDEN', 'You are not allowed to delete this token');
      return;
    }

    const deletedTokenId = await deleteToken({
      roomId: session.roomId,
      tokenId: token.id
    });

    broadcastToRoom(session.roomId, {
      type: 'TOKEN_DELETED',
      payload: {
        tokenId: deletedTokenId
      }
    });
    return;
  }

  sendError(session.socket, 'UNSUPPORTED_MESSAGE', `Unsupported message type: ${message.type}`);
};

export const wsRoutes: FastifyPluginAsync = async (app) => {
  const unsubscribeRoomMapUpdated = onRoomMapUpdated((event) => {
    broadcastToRoom(event.roomId, {
      type: 'ROOM_MAP_UPDATED',
      payload: {
        currentMapAssetId: event.currentMapAssetId,
        asset: event.currentMapAsset
      }
    });
  });

  const unsubscribeRoomAssetCreated = onRoomAssetCreated((event) => {
    broadcastToRoom(event.roomId, {
      type: 'ASSET_CREATED',
      payload: {
        asset: event.asset
      }
    });
  });

  app.addHook('onClose', async () => {
    unsubscribeRoomMapUpdated();
    unsubscribeRoomAssetCreated();
  });

  app.get('/ws', { websocket: true }, (socket) => {
    const ws = socket as unknown as WsSocket;
    let session: SocketSession | null = null;
    const withinRateLimit = createWsRateLimiter();

    ws.on('message', async (rawData: unknown) => {
      const rawMessage = rawDataToString(rawData);

      if (isWsJsonMessageTooLarge(rawMessage, MAX_WS_JSON_BYTES)) {
        sendError(ws, 'MESSAGE_TOO_LARGE', `Message exceeds ${MAX_WS_JSON_BYTES} bytes`);
        return;
      }

      const parsedMessage = parseClientMessage(rawMessage);

      const rateBucket = parsedMessage?.type === 'ASSET_CHUNK' ? 'asset_chunk' : 'default';
      if (!withinRateLimit(rateBucket)) {
        sendError(ws, 'RATE_LIMITED', 'Too many messages in a short time window');
        return;
      }

      if (!parsedMessage) {
        sendError(ws, 'INVALID_MESSAGE', 'Message does not match contract');
        return;
      }

      try {
        if (!session) {
          if (parsedMessage.type !== 'HELLO') {
            sendError(ws, 'HELLO_REQUIRED', 'First message must be HELLO');
            ws.close(1008, 'HELLO_REQUIRED');
            return;
          }

          const helloState = await joinRoomForSocketHello({
            clientId: parsedMessage.payload.clientId,
            displayName: parsedMessage.payload.displayName,
            roomId: parsedMessage.payload.roomId,
            joinSecret: parsedMessage.payload.joinSecret,
            roleDesired: parsedMessage.payload.desiredRole
          });

          const hostUserId = helloState.room.dmUserId;
          const isHostUser = helloState.userId === hostUserId;

          if (helloState.room.storageMode === 'LOCAL' && !isHostUser && !isRoomUserOnline(helloState.room.id, hostUserId)) {
            sendHostOffline(ws);
            ws.close(1013, 'HOST_OFFLINE');
            return;
          }

          session = {
            connectionId: randomUUID(),
            roomId: helloState.room.id,
            userId: helloState.userId,
            hostUserId,
            storageMode: helloState.room.storageMode,
            role: helloState.roleAssigned,
            displayName: helloState.member.displayName,
            socket: ws
          };

          addSession(session);

          if (helloState.room.storageMode === 'LOCAL') {
            sendMessage(ws, {
              type: 'WELCOME_LOCAL',
              payload: {
                userId: helloState.userId,
                roomId: helloState.room.id,
                role: helloState.roleAssigned,
                storageMode: 'LOCAL',
                hostUserId,
                membersOnline: buildMembersOnline(helloState.room.id)
              }
            });
          } else {
            const cloudSettings = helloState.settings;
            const cloudTokens = helloState.tokens;
            const cloudMembers = helloState.members;
            const cloudCurrentMapAssetId = helloState.currentMapAssetId;
            const cloudCurrentMapAsset = helloState.currentMapAsset;

            if (
              cloudSettings === undefined ||
              cloudTokens === undefined ||
              cloudMembers === undefined ||
              cloudCurrentMapAssetId === undefined ||
              cloudCurrentMapAsset === undefined
            ) {
              sendError(ws, 'INTERNAL_ERROR', 'CLOUD room is missing server-side state payload');
              ws.close(1011, 'INTERNAL_ERROR');
              return;
            }

            const mapEditState = getOrCreateRoomMapEditState(helloState.room.id);

            sendMessage(ws, {
              type: 'WELCOME',
              payload: {
                userId: helloState.userId,
                roomId: helloState.room.id,
                role: helloState.roleAssigned,
                member: helloState.member,
                settings: cloudSettings,
                tokens: cloudTokens,
                membersOnline: buildMembersOnline(helloState.room.id),
                currentMapAssetId: cloudCurrentMapAssetId,
                currentMapAsset: cloudCurrentMapAsset,
                mapEditSnapshot: {
                  revision: mapEditState.revision,
                  elements: cloneMapEditElements(mapEditState.elements)
                }
              }
            });
          }

          broadcastPresence(helloState.room.id);
          return;
        }

        if (parsedMessage.type === 'HELLO') {
          sendError(ws, 'ALREADY_JOINED', 'HELLO is only valid as first message');
          return;
        }

        await handleRoomMessage(session, parsedMessage);
      } catch (error) {
        if (error instanceof RoomServiceError || error instanceof LocalStrictAccessError) {
          sendError(ws, error.code, error.message);
          return;
        }

        sendError(ws, 'INTERNAL_ERROR', 'Unexpected server error');
      }
    });

    ws.on('close', () => {
      if (!session) {
        return;
      }

      const roomId = session.roomId;
      removeSession(session);
      broadcastPresence(roomId);
    });

    ws.on('error', () => {
      if (!session) {
        return;
      }

      const roomId = session.roomId;
      removeSession(session);
      broadcastPresence(roomId);
    });
  });
};
