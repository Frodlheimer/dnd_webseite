import type { ClientToServerMessage, HostRequest, ServerToClientMessage } from '@dnd-vtt/shared';

export type LocalRelaySocket = {
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  send: (payload: string) => void;
  close: (code?: number, reason?: string) => void;
};

export type LocalRelaySession = {
  roomId: string;
  userId: string;
  hostUserId: string;
  socket: LocalRelaySocket;
};

type LocalRelayRequest = HostRequest | { type: 'ASSET_REQUEST'; hashes: string[] };

export type LocalRelayDeps = {
  isHostOnline: (roomId: string, hostUserId: string) => boolean;
  sendToUser: (roomId: string, userId: string, message: ServerToClientMessage) => boolean;
  broadcastToRoom: (roomId: string, message: ServerToClientMessage) => void;
  sendHostOffline: (socket: LocalRelaySocket) => void;
  sendError: (socket: LocalRelaySocket, code: string, message: string) => void;
};

export const relayToHost = (session: LocalRelaySession, payload: LocalRelayRequest, deps: LocalRelayDeps): void => {
  if (!deps.isHostOnline(session.roomId, session.hostUserId)) {
    deps.sendHostOffline(session.socket);
    return;
  }

  const delivered = deps.sendToUser(session.roomId, session.hostUserId, {
    type: 'RELAY_FROM_USER',
    payload: {
      fromUserId: session.userId,
      payload
    }
  });

  if (!delivered) {
    deps.sendHostOffline(session.socket);
  }
};

export const handleLocalRelayMessage = (
  session: LocalRelaySession,
  message: ClientToServerMessage,
  deps: LocalRelayDeps
): boolean => {
  if (message.type === 'RELAY_TO_HOST') {
    relayToHost(session, message.payload, deps);
    return true;
  }

  if (message.type === 'ASSET_REQUEST') {
    relayToHost(
      session,
      {
        type: 'ASSET_REQUEST',
        hashes: message.payload.hashes
      },
      deps
    );
    return true;
  }

  if (message.type === 'RELAY_BROADCAST') {
    if (session.userId !== session.hostUserId) {
      deps.sendError(session.socket, 'FORBIDDEN', 'Only host can broadcast in LOCAL mode');
      return true;
    }

    deps.broadcastToRoom(session.roomId, {
      type: 'RELAY_FROM_HOST',
      payload: message.payload
    });
    return true;
  }

  if (message.type === 'RELAY_TO_USER') {
    if (session.userId !== session.hostUserId) {
      deps.sendError(session.socket, 'FORBIDDEN', 'Only host can send direct messages in LOCAL mode');
      return true;
    }

    deps.sendToUser(session.roomId, message.payload.userId, {
      type: 'DIRECT_FROM_HOST',
      payload: message.payload.payload
    });
    return true;
  }

  if (message.type === 'ASSET_CHUNK') {
    if (session.userId !== session.hostUserId) {
      deps.sendError(session.socket, 'FORBIDDEN', 'Only host can stream assets in LOCAL mode');
      return true;
    }

    deps.sendToUser(session.roomId, message.payload.toUserId, {
      type: 'DIRECT_FROM_HOST',
      payload: {
        type: 'ASSET_CHUNK',
        hash: message.payload.hash,
        seq: message.payload.seq,
        total: message.payload.total,
        bytesBase64: message.payload.bytesBase64
      }
    });
    return true;
  }

  return false;
};
