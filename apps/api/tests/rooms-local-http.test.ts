import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createRoomForGuestMock, joinRoomBySecretForGuestMock, getRoomStateByIdMock, MockRoomServiceError } =
  vi.hoisted(() => {
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
      createRoomForGuestMock: vi.fn(),
      joinRoomBySecretForGuestMock: vi.fn(),
      getRoomStateByIdMock: vi.fn(),
      MockRoomServiceError: RoomServiceErrorMock
    };
  });

vi.mock('../src/rooms/service.js', () => ({
  RoomServiceError: MockRoomServiceError,
  createRoomForGuest: createRoomForGuestMock,
  joinRoomBySecretForGuest: joinRoomBySecretForGuestMock,
  getRoomStateById: getRoomStateByIdMock,
  getRoomMemberForClientId: vi.fn(),
  getRoomStorageMode: vi.fn(),
  setCurrentMapForRoom: vi.fn()
}));

vi.mock('../src/ws/presence-registry.js', () => ({
  isRoomUserOnline: vi.fn().mockReturnValue(true)
}));

vi.mock('../src/assets/service.js', () => ({
  listRoomAssets: vi.fn().mockResolvedValue([])
}));

vi.mock('../src/ws/authz.js', () => ({
  canSetRoomMap: vi.fn().mockReturnValue(true)
}));

vi.mock('../src/ws/room-events.js', () => ({
  emitRoomMapUpdated: vi.fn()
}));

import { roomRoutes } from '../src/routes/rooms.js';

const iso = new Date('2026-01-01T00:00:00.000Z').toISOString();

const buildMember = (role: 'DM' | 'PLAYER' | 'SPECTATOR') => ({
  roomId: 'room-1',
  userId: role === 'DM' ? 'user-dm' : 'user-player',
  role,
  displayName: role === 'DM' ? 'Dungeon Master' : 'Player One',
  joinedAt: iso,
  lastSeenAt: iso
});

describe('room routes LOCAL hardening', () => {
  beforeEach(() => {
    createRoomForGuestMock.mockReset();
    joinRoomBySecretForGuestMock.mockReset();
    getRoomStateByIdMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns minimal LOCAL payload for POST /rooms', async () => {
    createRoomForGuestMock.mockResolvedValue({
      room: {
        id: 'room-1',
        dmUserId: 'user-dm',
        storageMode: 'LOCAL',
        joinSecret: 'ABCD1234'
      },
      roleAssigned: 'DM',
      member: buildMember('DM')
    });

    const app = Fastify();
    await app.register(roomRoutes);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/rooms',
      payload: {
        name: 'Test Room',
        displayName: 'Dungeon Master',
        clientId: 'client-dm',
        storageMode: 'LOCAL'
      }
    });

    expect(response.statusCode).toBe(201);

    const payload = response.json();
    expect(payload.storageMode).toBe('LOCAL');
    expect(payload).toHaveProperty('roomId', 'room-1');
    expect(payload).toHaveProperty('joinSecret', 'ABCD1234');
    expect(payload).toHaveProperty('hostUserId', 'user-dm');
    expect(payload).toHaveProperty('member');
    expect(payload).not.toHaveProperty('settings');
    expect(payload).not.toHaveProperty('tokens');
    expect(payload).not.toHaveProperty('members');
    expect(payload).not.toHaveProperty('currentMapAssetId');
    expect(payload).not.toHaveProperty('currentMapAsset');

    await app.close();
  });

  it('returns minimal LOCAL payload for POST /rooms/join', async () => {
    joinRoomBySecretForGuestMock.mockResolvedValue({
      room: {
        id: 'room-1',
        dmUserId: 'user-dm',
        storageMode: 'LOCAL'
      },
      userId: 'user-player',
      roleAssigned: 'PLAYER',
      member: buildMember('PLAYER')
    });

    const app = Fastify();
    await app.register(roomRoutes);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/rooms/join',
      payload: {
        joinSecret: 'ABCD1234',
        displayName: 'Player One',
        clientId: 'client-player',
        roleDesired: 'PLAYER'
      }
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json();
    expect(payload.storageMode).toBe('LOCAL');
    expect(payload).toHaveProperty('roomId', 'room-1');
    expect(payload).toHaveProperty('hostUserId', 'user-dm');
    expect(payload).toHaveProperty('member');
    expect(payload).not.toHaveProperty('settings');
    expect(payload).not.toHaveProperty('tokens');
    expect(payload).not.toHaveProperty('members');
    expect(payload).not.toHaveProperty('currentMapAssetId');
    expect(payload).not.toHaveProperty('currentMapAsset');

    await app.close();
  });

  it('returns 409 for LOCAL room state endpoint', async () => {
    getRoomStateByIdMock.mockRejectedValue(
      new MockRoomServiceError(
        'LOCAL_STATE_NOT_AVAILABLE',
        409,
        'LOCAL rooms do not expose server-side game state'
      )
    );

    const app = Fastify();
    await app.register(roomRoutes);
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/rooms/room-1/state'
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: 'LOCAL_STATE_NOT_AVAILABLE',
      message: 'LOCAL rooms do not expose server-side game state'
    });

    await app.close();
  });
});
