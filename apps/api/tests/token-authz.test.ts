import { describe, expect, it } from 'vitest';

import { canPerformTokenAction, canSetRoomMap, canUpdateRoomSettings, canUseMapEdit } from '../src/ws/authz.js';

describe('token authz policy', () => {
  it('allows DM to update settings and move tokens under DM_ONLY', () => {
    const canUpdate = canUpdateRoomSettings('DM');
    const canMove = canPerformTokenAction({
      role: 'DM',
      tokenMovePolicy: 'DM_ONLY',
      action: 'move',
      userId: 'dm-user',
      controlledBy: {
        mode: 'USERS',
        userIds: ['other-user']
      }
    });

    expect(canUpdate).toBe(true);
    expect(canMove).toBe(true);
  });

  it('allows only DM to set room map', () => {
    expect(canSetRoomMap('DM')).toBe(true);
    expect(canSetRoomMap('PLAYER')).toBe(false);
    expect(canSetRoomMap('SPECTATOR')).toBe(false);
  });

  it('blocks PLAYER from moving foreign tokens in OWNED_ONLY', () => {
    const canMove = canPerformTokenAction({
      role: 'PLAYER',
      tokenMovePolicy: 'OWNED_ONLY',
      action: 'move',
      userId: 'player-1',
      controlledBy: {
        mode: 'USERS',
        userIds: ['player-2']
      }
    });

    expect(canMove).toBe(false);
  });

  it('blocks SPECTATOR from all token actions', () => {
    const canCreate = canPerformTokenAction({
      role: 'SPECTATOR',
      tokenMovePolicy: 'ALL',
      action: 'create',
      userId: 'spectator-1'
    });

    expect(canCreate).toBe(false);
  });

  it('respects map edit policy and per-user overrides', () => {
    expect(
      canUseMapEdit({
        role: 'PLAYER',
        userId: 'player-1',
        mapEditPolicy: 'DM_ONLY',
        mapEditUserOverrides: []
      })
    ).toBe(false);

    expect(
      canUseMapEdit({
        role: 'PLAYER',
        userId: 'player-1',
        mapEditPolicy: 'PLAYERS',
        mapEditUserOverrides: []
      })
    ).toBe(true);

    expect(
      canUseMapEdit({
        role: 'SPECTATOR',
        userId: 'spectator-1',
        mapEditPolicy: 'PLAYERS',
        mapEditUserOverrides: [
          {
            userId: 'spectator-1',
            enabled: true
          }
        ]
      })
    ).toBe(true);
  });
});
