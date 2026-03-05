import { describe, expect, it } from 'vitest';

import { useAppStore } from './store';

describe('app store', () => {
  it('applies room join response and token updates', () => {
    const iso = new Date('2026-01-01T00:00:00.000Z').toISOString();

    useAppStore.setState({
      clientId: 'client-1',
      userId: null,
      displayName: '',
      roomId: null,
      joinSecret: null,
      wsUrl: null,
      role: null,
      member: null,
      storageMode: null,
      hostUserId: null,
      settings: null,
      currentMapAssetId: null,
      currentMapAsset: null,
      tokens: [],
      members: [],
      membersOnline: [],
      chatMessages: [],
      chatComposeKind: 'PUBLIC',
      chatComposeRecipients: [],
      connectionStatus: 'disconnected',
      lastError: null
    });

    useAppStore.getState().applyJoinRoomResponse({
      roomId: 'room-1',
      storageMode: 'LOCAL',
      hostUserId: 'user-dm',
      wsUrl: 'ws://localhost:3000/ws',
      roleAssigned: 'PLAYER',
      member: {
        roomId: 'room-1',
        userId: 'user-1',
        role: 'PLAYER',
        displayName: 'Rin',
        joinedAt: iso,
        lastSeenAt: iso
      }
    });

    useAppStore.getState().upsertToken({
      id: 'token-1',
      roomId: 'room-1',
      name: 'Goblin',
      x: 10,
      y: 20,
      size: 1,
      assetId: null,
      kind: 'ENEMY',
      color: '#ef4444',
      elevation: 0,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageScale: 1,
      imageRotationDeg: 0,
      controlledBy: {
        mode: 'ALL'
      },
      createdAt: iso,
      updatedAt: iso
    });

    useAppStore.getState().updateTokenPositionLocal('token-1', 100, 120);

    const state = useAppStore.getState();

    expect(state.roomId).toBe('room-1');
    expect(state.role).toBe('PLAYER');
    expect(state.settings).toEqual({
      roomId: 'room-1',
      tokenMovePolicy: 'ALL',
      mapEditPolicy: 'DM_ONLY',
      mapEditUserOverrides: []
    });
    expect(state.tokens).toHaveLength(1);
    expect(state.tokens[0]?.x).toBe(100);
    expect(state.tokens[0]?.y).toBe(120);
  });

  it('dedupes chat messages by id', () => {
    useAppStore.setState({
      chatMessages: []
    });

    const message = {
      kind: 'PUBLIC' as const,
      id: 'chat-1',
      ts: Date.now(),
      fromUserId: 'dm-1',
      fromName: 'DM',
      text: 'Hello'
    };

    useAppStore.getState().appendChatMessage(message);
    useAppStore.getState().appendChatMessage(message);

    const state = useAppStore.getState();
    expect(state.chatMessages).toHaveLength(1);
    expect(state.chatMessages[0]?.id).toBe('chat-1');
  });
});
