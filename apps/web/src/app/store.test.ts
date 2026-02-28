import { describe, expect, it } from 'vitest';

import { useAppStore } from './store';

describe('app store', () => {
  it('updates room id and connection state', () => {
    useAppStore.setState({
      currentRoomId: null,
      role: 'SPECTATOR',
      connectionStatus: 'disconnected'
    });

    useAppStore.getState().setCurrentRoomId('room-123');
    useAppStore.getState().setConnectionStatus('connected');

    const state = useAppStore.getState();

    expect(state.currentRoomId).toBe('room-123');
    expect(state.connectionStatus).toBe('connected');
  });
});
