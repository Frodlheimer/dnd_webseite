import { describe, expect, it, vi } from 'vitest';

import type { ClientToServerMessage } from '@dnd-vtt/shared';

import { handleLocalRelayMessage, relayToHost, type LocalRelayDeps, type LocalRelaySession } from '../src/ws/localRelay.js';

const buildSession = (overrides?: Partial<LocalRelaySession>): LocalRelaySession => {
  return {
    roomId: 'room-1',
    userId: 'user-1',
    hostUserId: 'host-1',
    socket: {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn()
    },
    ...overrides
  };
};

const buildDeps = (overrides?: Partial<LocalRelayDeps>): LocalRelayDeps => {
  return {
    isHostOnline: vi.fn().mockReturnValue(true),
    sendToUser: vi.fn().mockReturnValue(true),
    broadcastToRoom: vi.fn(),
    sendHostOffline: vi.fn(),
    sendError: vi.fn(),
    ...overrides
  };
};

describe('ws local relay routing', () => {
  it('routes RELAY_TO_HOST to the current host when online', () => {
    const session = buildSession();
    const deps = buildDeps();

    const message = {
      type: 'RELAY_TO_HOST',
      payload: {
        type: 'REQUEST_TOKEN_MOVE',
        tokenId: 'token-1',
        x: 10,
        y: 20
      }
    } satisfies ClientToServerMessage;

    const handled = handleLocalRelayMessage(session, message, deps);

    expect(handled).toBe(true);
    expect(deps.sendToUser).toHaveBeenCalledTimes(1);
    expect(deps.sendToUser).toHaveBeenCalledWith(
      'room-1',
      'host-1',
      expect.objectContaining({
        type: 'RELAY_FROM_USER'
      })
    );
  });

  it('signals HOST_OFFLINE when host is not online', () => {
    const session = buildSession();
    const deps = buildDeps({
      isHostOnline: vi.fn().mockReturnValue(false)
    });

    relayToHost(
      session,
      {
        type: 'REQUEST_TOKEN_DELETE',
        tokenId: 'token-1'
      },
      deps
    );

    expect(deps.sendHostOffline).toHaveBeenCalledTimes(1);
    expect(deps.sendToUser).not.toHaveBeenCalled();
  });

  it('rejects broadcast attempts from non-host users', () => {
    const session = buildSession({
      userId: 'player-1',
      hostUserId: 'host-1'
    });
    const deps = buildDeps();

    const message = {
      type: 'RELAY_BROADCAST',
      payload: {
        type: 'TOKEN_DELETED',
        tokenId: 'token-2'
      }
    } satisfies ClientToServerMessage;

    const handled = handleLocalRelayMessage(session, message, deps);

    expect(handled).toBe(true);
    expect(deps.sendError).toHaveBeenCalledWith(session.socket, 'FORBIDDEN', expect.any(String));
    expect(deps.broadcastToRoom).not.toHaveBeenCalled();
  });

  it('allows host broadcast to room', () => {
    const session = buildSession({
      userId: 'host-1',
      hostUserId: 'host-1'
    });
    const deps = buildDeps();

    const message = {
      type: 'RELAY_BROADCAST',
      payload: {
        type: 'TOKEN_MOVED',
        tokenId: 'token-1',
        x: 15,
        y: 25
      }
    } satisfies ClientToServerMessage;

    const handled = handleLocalRelayMessage(session, message, deps);

    expect(handled).toBe(true);
    expect(deps.broadcastToRoom).toHaveBeenCalledWith(
      'room-1',
      expect.objectContaining({
        type: 'RELAY_FROM_HOST'
      })
    );
  });

  it('routes host asset chunks as DIRECT_FROM_HOST payload', () => {
    const session = buildSession({
      userId: 'host-1',
      hostUserId: 'host-1'
    });
    const deps = buildDeps();

    const message = {
      type: 'ASSET_CHUNK',
      payload: {
        toUserId: 'user-2',
        hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        seq: 0,
        total: 1,
        bytesBase64: 'dGVzdA=='
      }
    } satisfies ClientToServerMessage;

    const handled = handleLocalRelayMessage(session, message, deps);

    expect(handled).toBe(true);
    expect(deps.sendToUser).toHaveBeenCalledWith(
      'room-1',
      'user-2',
      expect.objectContaining({
        type: 'DIRECT_FROM_HOST'
      })
    );
  });

  it('routes host whisper payload as DIRECT_FROM_HOST payload', () => {
    const session = buildSession({
      userId: 'host-1',
      hostUserId: 'host-1'
    });
    const deps = buildDeps();

    const message = {
      type: 'RELAY_TO_USER',
      payload: {
        userId: 'player-1',
        payload: {
          type: 'CHAT_MESSAGE_WHISPER',
          id: 'chat-1',
          ts: 123,
          fromUserId: 'host-1',
          fromName: 'DM',
          toUserIds: ['player-1'],
          text: 'secret'
        }
      }
    } satisfies ClientToServerMessage;

    const handled = handleLocalRelayMessage(session, message, deps);

    expect(handled).toBe(true);
    expect(deps.sendToUser).toHaveBeenCalledWith(
      'room-1',
      'player-1',
      expect.objectContaining({
        type: 'DIRECT_FROM_HOST',
        payload: expect.objectContaining({
          type: 'CHAT_MESSAGE_WHISPER',
          id: 'chat-1'
        })
      })
    );
  });
});
