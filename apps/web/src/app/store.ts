import { create } from 'zustand';

import type {
  ChatMessage,
  ChatSendKind,
  CreateRoomResponse,
  JoinRoomResponse,
  PresenceMember,
  Role,
  RoomAsset,
  RoomMember,
  RoomSettings,
  StorageMode,
  VttToken,
  WelcomeLocalMessage,
  WelcomeMessage
} from '@dnd-vtt/shared';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

const createDefaultRoomSettings = (roomId: string): RoomSettings => ({
  roomId,
  tokenMovePolicy: 'ALL',
  mapEditPolicy: 'DM_ONLY',
  mapEditUserOverrides: []
});

type ApplyRoomStatePayload = {
  roomId: string;
  storageMode: StorageMode;
  hostUserId: string;
  roleAssigned: Role;
  member: RoomMember;
  settings: RoomSettings;
  tokens: VttToken[];
  members: RoomMember[];
  wsUrl: string;
  joinSecret?: string | null;
  currentMapAssetId: string | null;
  currentMapAsset: RoomAsset | null;
};

type AppState = {
  clientId: string;
  userId: string | null;
  displayName: string;
  roomId: string | null;
  joinSecret: string | null;
  wsUrl: string | null;
  storageMode: StorageMode | null;
  hostUserId: string | null;
  role: Role | null;
  member: RoomMember | null;
  settings: RoomSettings | null;
  currentMapAssetId: string | null;
  currentMapAsset: RoomAsset | null;
  tokens: VttToken[];
  members: RoomMember[];
  membersOnline: PresenceMember[];
  chatMessages: ChatMessage[];
  chatComposeKind: ChatSendKind;
  chatComposeRecipients: string[];
  connectionStatus: ConnectionStatus;
  lastError: string | null;
  setClientId: (clientId: string) => void;
  setDisplayName: (displayName: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLastError: (message: string | null) => void;
  clearRoom: () => void;
  applyCreateRoomResponse: (payload: CreateRoomResponse) => void;
  applyJoinRoomResponse: (payload: JoinRoomResponse) => void;
  applyWelcomeMessage: (payload: WelcomeMessage['payload']) => void;
  applyWelcomeLocalMessage: (payload: WelcomeLocalMessage['payload']) => void;
  setCurrentMapState: (currentMapAssetId: string | null, currentMapAsset: RoomAsset | null) => void;
  setMembersOnline: (membersOnline: PresenceMember[]) => void;
  setMembers: (members: RoomMember[]) => void;
  setTokens: (tokens: VttToken[]) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  appendChatMessage: (message: ChatMessage) => void;
  clearChatMessages: () => void;
  setChatComposeKind: (kind: ChatSendKind) => void;
  setChatComposeRecipients: (userIds: string[]) => void;
  resetChatCompose: () => void;
  upsertToken: (token: VttToken) => void;
  removeToken: (tokenId: string) => void;
  updateTokenPositionLocal: (tokenId: string, x: number, y: number) => void;
  setSettings: (settings: RoomSettings) => void;
};

const applyRoomState = (set: (partial: Partial<AppState>) => void, payload: ApplyRoomStatePayload) => {
  set({
    roomId: payload.roomId,
    storageMode: payload.storageMode,
    hostUserId: payload.hostUserId,
    role: payload.roleAssigned,
    member: payload.member,
    displayName: payload.member.displayName,
    userId: payload.member.userId,
    settings: payload.settings,
    tokens: payload.tokens,
    members: payload.members,
    wsUrl: payload.wsUrl,
    joinSecret: payload.joinSecret ?? null,
    currentMapAssetId: payload.currentMapAssetId,
    currentMapAsset: payload.currentMapAsset,
    chatMessages: [],
    chatComposeKind: 'PUBLIC',
    chatComposeRecipients: [],
    lastError: null
  });
};

export const useAppStore = create<AppState>((set) => ({
  clientId: '',
  userId: null,
  displayName: '',
  roomId: null,
  storageMode: null,
  hostUserId: null,
  joinSecret: null,
  wsUrl: null,
  role: null,
  member: null,
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
  lastError: null,
  setClientId: (clientId) => set({ clientId }),
  setDisplayName: (displayName) => set({ displayName }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setLastError: (lastError) => set({ lastError }),
  clearRoom: () =>
    set({
      userId: null,
      roomId: null,
      storageMode: null,
      hostUserId: null,
      joinSecret: null,
      wsUrl: null,
      role: null,
      member: null,
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
    }),
  applyCreateRoomResponse: (payload) => {
    if (payload.storageMode === 'LOCAL') {
      applyRoomState(set, {
        roomId: payload.roomId,
        storageMode: payload.storageMode,
        hostUserId: payload.hostUserId,
        roleAssigned: payload.roleAssigned,
        member: payload.member,
        settings: createDefaultRoomSettings(payload.roomId),
        tokens: [],
        members: [payload.member],
        wsUrl: payload.wsUrl,
        joinSecret: payload.joinSecret,
        currentMapAssetId: null,
        currentMapAsset: null
      });
      return;
    }

    applyRoomState(set, {
      roomId: payload.roomId,
      storageMode: payload.storageMode,
      hostUserId: payload.hostUserId,
      roleAssigned: payload.roleAssigned,
      member: payload.member,
      settings: payload.settings,
      tokens: payload.tokens,
      members: payload.members,
      wsUrl: payload.wsUrl,
      joinSecret: payload.joinSecret,
      currentMapAssetId: payload.currentMapAssetId,
      currentMapAsset: payload.currentMapAsset
    });
  },
  applyJoinRoomResponse: (payload) => {
    if (payload.storageMode === 'LOCAL') {
      applyRoomState(set, {
        roomId: payload.roomId,
        storageMode: payload.storageMode,
        hostUserId: payload.hostUserId,
        roleAssigned: payload.roleAssigned,
        member: payload.member,
        settings: createDefaultRoomSettings(payload.roomId),
        tokens: [],
        members: [payload.member],
        wsUrl: payload.wsUrl,
        joinSecret: null,
        currentMapAssetId: null,
        currentMapAsset: null
      });
      return;
    }

    applyRoomState(set, {
      roomId: payload.roomId,
      storageMode: payload.storageMode,
      hostUserId: payload.hostUserId,
      roleAssigned: payload.roleAssigned,
      member: payload.member,
      settings: payload.settings,
      tokens: payload.tokens,
      members: payload.members,
      wsUrl: payload.wsUrl,
      joinSecret: null,
      currentMapAssetId: payload.currentMapAssetId,
      currentMapAsset: payload.currentMapAsset
    });
  },
  applyWelcomeMessage: (payload) =>
    set({
      userId: payload.userId,
      roomId: payload.roomId,
      storageMode: 'CLOUD',
      role: payload.role,
      member: payload.member,
      settings: payload.settings,
      hostUserId: payload.membersOnline.find((memberOnline) => memberOnline.role === 'DM')?.userId ?? null,
      currentMapAssetId: payload.currentMapAssetId,
      currentMapAsset: payload.currentMapAsset,
      tokens: payload.tokens,
      membersOnline: payload.membersOnline,
      displayName: payload.member.displayName,
      connectionStatus: 'connected',
      chatMessages: [],
      chatComposeKind: 'PUBLIC',
      chatComposeRecipients: [],
      lastError: null
    }),
  applyWelcomeLocalMessage: (payload) =>
    set((state) => ({
      userId: payload.userId,
      roomId: payload.roomId,
      role: payload.role,
      storageMode: 'LOCAL',
      hostUserId: payload.hostUserId,
      membersOnline: payload.membersOnline,
      connectionStatus: 'connected',
      lastError: null,
      currentMapAssetId: null,
      currentMapAsset: null,
      settings: state.settings,
      tokens: state.tokens,
      chatMessages: [],
      chatComposeKind: 'PUBLIC',
      chatComposeRecipients: []
    })),
  setCurrentMapState: (currentMapAssetId, currentMapAsset) =>
    set({
      currentMapAssetId,
      currentMapAsset
    }),
  setMembersOnline: (membersOnline) => set({ membersOnline }),
  setMembers: (members) => set({ members }),
  setTokens: (tokens) => set({ tokens }),
  setChatMessages: (chatMessages) => set({ chatMessages }),
  appendChatMessage: (message) =>
    set((state) => {
      if (state.chatMessages.some((entry) => entry.id === message.id)) {
        return state;
      }

      return {
        chatMessages: [...state.chatMessages, message]
      };
    }),
  clearChatMessages: () => set({ chatMessages: [] }),
  setChatComposeKind: (chatComposeKind) => set({ chatComposeKind }),
  setChatComposeRecipients: (chatComposeRecipients) =>
    set({
      chatComposeRecipients: [...new Set(chatComposeRecipients.map((userId) => userId.trim()).filter(Boolean))]
    }),
  resetChatCompose: () =>
    set({
      chatComposeKind: 'PUBLIC',
      chatComposeRecipients: []
    }),
  upsertToken: (token) =>
    set((state) => {
      const index = state.tokens.findIndex((item) => item.id === token.id);

      if (index < 0) {
        return {
          tokens: [...state.tokens, token]
        };
      }

      const nextTokens = [...state.tokens];
      nextTokens[index] = token;
      return {
        tokens: nextTokens
      };
    }),
  removeToken: (tokenId) =>
    set((state) => ({
      tokens: state.tokens.filter((token) => token.id !== tokenId)
    })),
  updateTokenPositionLocal: (tokenId, x, y) =>
    set((state) => ({
      tokens: state.tokens.map((token) => (token.id === tokenId ? { ...token, x, y } : token))
    })),
  setSettings: (settings) => set({ settings })
}));
