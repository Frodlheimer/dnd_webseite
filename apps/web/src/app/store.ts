import { create } from 'zustand';

import type { Role } from '@dnd-vtt/shared';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

type AppState = {
  currentRoomId: string | null;
  role: Role;
  connectionStatus: ConnectionStatus;
  setCurrentRoomId: (roomId: string | null) => void;
  setRole: (role: Role) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
};

export const useAppStore = create<AppState>((set) => ({
  currentRoomId: null,
  role: 'SPECTATOR',
  connectionStatus: 'disconnected',
  setCurrentRoomId: (roomId) => set({ currentRoomId: roomId }),
  setRole: (role) => set({ role }),
  setConnectionStatus: (status) => set({ connectionStatus: status })
}));
