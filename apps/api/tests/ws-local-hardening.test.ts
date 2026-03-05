import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { joinRoomForSocketHelloMock, MockRoomServiceError } = vi.hoisted(() => {
  class RoomServiceErrorMock extends Error {
    code: string;
    statusCode: number;

    constructor(code: string, statusCode: number, message: string) {
      super(message);
      this.name = 'RoomServiceError';
      this.code = code;
      this.statusCode = statusCode;
    }
  }

  return {
    joinRoomForSocketHelloMock: vi.fn(),
    MockRoomServiceError: RoomServiceErrorMock
  };
});

vi.mock('../src/rooms/service.js', () => ({
  RoomServiceError: MockRoomServiceError,
  joinRoomForSocketHello: joinRoomForSocketHelloMock,
  touchMemberLastSeen: vi.fn(),
  getRoomMemberForUser: vi.fn(),
  getRoomSettings: vi.fn(),
  updateRoomSettings: vi.fn(),
  setCurrentMapForRoom: vi.fn(),
  createToken: vi.fn(),
  updateToken: vi.fn(),
  getTokenById: vi.fn(),
  moveToken: vi.fn(),
  deleteToken: vi.fn()
}));

import { wsRoutes } from '../src/ws/index.js';

type JsonMessage = {
  type: string;
  payload?: Record<string, unknown>;
};

const connectWs = async (url: string): Promise<WebSocket> => {
  return await new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('Timed out while connecting websocket'));
    }, 2_500);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.removeAllListeners('open');
      socket.removeAllListeners('error');
    };

    socket.on('open', () => {
      cleanup();
      resolve(socket);
    });

    socket.on('error', (error) => {
      cleanup();
      reject(error);
    });
  });
};

const waitForMessageType = async (socket: WebSocket, expectedType: string, timeoutMs = 3_000): Promise<JsonMessage> => {
  return await new Promise<JsonMessage>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${expectedType}`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.removeListener('message', onMessage);
      socket.removeListener('error', onError);
      socket.removeListener('close', onClose);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onClose = () => {
      cleanup();
      reject(new Error(`WebSocket closed before receiving ${expectedType}`));
    };

    const onMessage = (rawData: unknown) => {
      const text =
        typeof rawData === 'string'
          ? rawData
          : Buffer.isBuffer(rawData)
            ? rawData.toString('utf8')
            : Array.isArray(rawData) && rawData.every((chunk) => Buffer.isBuffer(chunk))
              ? Buffer.concat(rawData).toString('utf8')
              : '';
      let parsed: JsonMessage;
      try {
        parsed = JSON.parse(text) as JsonMessage;
      } catch {
        return;
      }

      if (parsed.type !== expectedType) {
        return;
      }

      cleanup();
      resolve(parsed);
    };

    socket.on('message', onMessage);
    socket.on('error', onError);
    socket.on('close', onClose);
  });
};

describe('ws LOCAL hardening', () => {
  beforeEach(() => {
    joinRoomForSocketHelloMock.mockReset();
    joinRoomForSocketHelloMock.mockResolvedValue({
      room: {
        id: 'room-local',
        dmUserId: 'user-host',
        storageMode: 'LOCAL'
      },
      userId: 'user-host',
      roleAssigned: 'DM',
      member: {
        roomId: 'room-local',
        userId: 'user-host',
        role: 'DM',
        displayName: 'Host',
        joinedAt: '2026-01-01T00:00:00.000Z',
        lastSeenAt: '2026-01-01T00:00:00.000Z'
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sends minimal WELCOME_LOCAL and rejects direct state messages in LOCAL', async () => {
    const app = Fastify();
    await app.register(websocket);
    await app.register(wsRoutes);
    await app.listen({
      host: '127.0.0.1',
      port: 0
    });

    const address = app.server.address();
    if (!address || typeof address === 'string') {
      await app.close();
      throw new Error('Could not resolve test server address');
    }

    const socket = await connectWs(`ws://127.0.0.1:${address.port}/ws`);

    socket.send(
      JSON.stringify({
        type: 'HELLO',
        payload: {
          clientId: 'client-host',
          displayName: 'Host',
          roomId: 'room-local'
        }
      })
    );

    const welcomeLocal = await waitForMessageType(socket, 'WELCOME_LOCAL');

    expect(welcomeLocal.payload).toEqual(
      expect.objectContaining({
        roomId: 'room-local',
        userId: 'user-host',
        role: 'DM',
        storageMode: 'LOCAL',
        hostUserId: 'user-host'
      })
    );
    expect(welcomeLocal.payload).not.toHaveProperty('settings');
    expect(welcomeLocal.payload).not.toHaveProperty('tokens');
    expect(welcomeLocal.payload).not.toHaveProperty('currentMapAssetId');
    expect(welcomeLocal.payload).not.toHaveProperty('currentMapAsset');
    expect(welcomeLocal.payload).not.toHaveProperty('mapEditSnapshot');

    const assertLocalDirectStateMessageRejected = async (message: Record<string, unknown>, rejectedType: string) => {
      socket.send(JSON.stringify(message));

      const errorMessage = await waitForMessageType(socket, 'ERROR');
      expect(errorMessage.payload).toEqual(
        expect.objectContaining({
          code: 'LOCAL_REQUIRES_RELAY_TO_HOST',
          rejectedType
        })
      );
      expect(String(errorMessage.payload?.hint)).toContain('RELAY_TO_HOST');
    };

    await assertLocalDirectStateMessageRejected(
      {
        type: 'TOKEN_MOVE',
        payload: {
          tokenId: 'token-1',
          x: 10,
          y: 20
        }
      },
      'TOKEN_MOVE'
    );

    await assertLocalDirectStateMessageRejected(
      {
        type: 'ROOM_SET_MAP',
        payload: {
          assetId: 'asset-1'
        }
      },
      'ROOM_SET_MAP'
    );

    await assertLocalDirectStateMessageRejected(
      {
        type: 'MAP_EDIT_OPS',
        payload: {
          operations: [{ kind: 'CLEAR' }]
        }
      },
      'MAP_EDIT_OPS'
    );

    socket.close();
    await app.close();
  });
});
