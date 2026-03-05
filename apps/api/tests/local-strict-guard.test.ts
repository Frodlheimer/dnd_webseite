import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { roomFindUniqueMock, roomSettingsUpsertMock } = vi.hoisted(() => {
  return {
    roomFindUniqueMock: vi.fn(),
    roomSettingsUpsertMock: vi.fn()
  };
});

vi.mock('../src/db/prisma.js', () => ({
  prisma: {
    room: {
      findUnique: roomFindUniqueMock
    },
    roomSettings: {
      upsert: roomSettingsUpsertMock
    }
  }
}));

import { getRoomSettings } from '../src/rooms/service.js';

const buildDbSettings = () => ({
  roomId: 'room-1',
  tokenMovePolicy: 'ALL',
  mapEditPolicy: 'DM_ONLY',
  mapEditUserOverridesJson: []
});

describe('LOCAL_STRICT guardrails', () => {
  beforeEach(() => {
    roomFindUniqueMock.mockReset();
    roomSettingsUpsertMock.mockReset();
    process.env.LOCAL_STRICT = '1';
  });

  afterEach(() => {
    delete process.env.LOCAL_STRICT;
  });

  it('throws fail-fast error when LOCAL room code path tries to access RoomSettings', async () => {
    roomFindUniqueMock.mockResolvedValue({
      storageMode: 'LOCAL'
    });

    await expect(getRoomSettings('room-1')).rejects.toMatchObject({
      code: 'LOCAL_MODE_DB_ACCESS_FORBIDDEN',
      message: 'LOCAL_MODE_DB_ACCESS_FORBIDDEN: RoomSettings.upsert'
    });
    expect(roomSettingsUpsertMock).not.toHaveBeenCalled();
  });

  it('allows state access when LOCAL_STRICT is disabled explicitly', async () => {
    process.env.LOCAL_STRICT = '0';
    roomFindUniqueMock.mockResolvedValue({
      storageMode: 'LOCAL'
    });
    roomSettingsUpsertMock.mockResolvedValue(buildDbSettings());

    const settings = await getRoomSettings('room-1');

    expect(settings.roomId).toBe('room-1');
    expect(roomSettingsUpsertMock).toHaveBeenCalledTimes(1);
  });
});
