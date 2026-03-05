import { describe, expect, it } from 'vitest';

import {
  ClientToServerMessageSchema,
  ChatMessageSchema,
  HostDirectSchema,
  HostEventSchema,
  HostRequestSchema,
  RoomSnapshotSchema,
  EventEnvelopeSchema,
  ServerToClientMessageSchema,
  WelcomeMessageSchema
} from '../src/contracts/events';
import {
  CreateRoomResponseSchema,
  JoinRoomResponseSchema,
  CreateRoomRequestSchema,
  JoinRoomRequestSchema,
  RoomStateResponseSchema
} from '../src/contracts/http';

describe('shared contracts', () => {
  it('parses HELLO with room target', () => {
    const parsed = ClientToServerMessageSchema.safeParse({
      type: 'HELLO',
      payload: {
        clientId: 'client-1',
        displayName: 'Lia',
        roomId: 'room-1'
      }
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects HELLO without roomId/joinSecret', () => {
    const parsed = ClientToServerMessageSchema.safeParse({
      type: 'HELLO',
      payload: {
        clientId: 'client-1',
        displayName: 'Lia'
      }
    });

    expect(parsed.success).toBe(false);
  });

  it('validates WELCOME messages', () => {
    const iso = new Date().toISOString();
    const parsed = WelcomeMessageSchema.safeParse({
      type: 'WELCOME',
      payload: {
        userId: 'user-1',
        roomId: 'room-1',
        role: 'DM',
        member: {
          roomId: 'room-1',
          userId: 'user-1',
          role: 'DM',
          displayName: 'Lia',
          joinedAt: iso,
          lastSeenAt: iso
        },
        settings: {
          roomId: 'room-1',
          tokenMovePolicy: 'ALL',
          mapEditPolicy: 'DM_ONLY',
          mapEditUserOverrides: []
        },
        tokens: [],
        currentMapAssetId: null,
        currentMapAsset: null,
        mapEditSnapshot: {
          revision: 0,
          elements: []
        },
        membersOnline: [
          {
            userId: 'user-1',
            role: 'DM',
            displayName: 'Lia'
          }
        ]
      }
    });

    expect(parsed.success).toBe(true);
  });

  it('validates all server message variants via discriminated union', () => {
    const parsed = ServerToClientMessageSchema.safeParse({
      type: 'ERROR',
      payload: {
        code: 'FORBIDDEN',
        message: 'You are not allowed to move this token'
      }
    });

    expect(parsed.success).toBe(true);
  });

  it('validates map websocket events', () => {
    const clientMessage = ClientToServerMessageSchema.safeParse({
      type: 'ROOM_SET_MAP',
      payload: {
        assetId: 'asset-1'
      }
    });

    const serverMessage = ServerToClientMessageSchema.safeParse({
      type: 'ROOM_MAP_UPDATED',
      payload: {
        currentMapAssetId: 'asset-1',
        asset: {
          id: 'asset-1',
          roomId: 'room-1',
          ownerUserId: 'user-1',
          type: 'MAP',
          mime: 'image/png',
          size: 120_000,
          originalName: 'battlemap.png',
          storageKey: 'asset-1.png',
          createdAt: new Date().toISOString()
        }
      }
    });

    expect(clientMessage.success).toBe(true);
    expect(serverMessage.success).toBe(true);
  });

  it('validates map edit operation websocket events', () => {
    const clientMessage = ClientToServerMessageSchema.safeParse({
      type: 'MAP_EDIT_OPS',
      payload: {
        operations: [
          {
            kind: 'UPSERT',
            elements: [
              {
                id: 'element-1',
                type: 'TEXT',
                x: 120,
                y: 240,
                rotationDeg: 0,
                scale: 1,
                opacity: 1,
                text: 'Hello',
                color: '#38bdf8',
                fontSize: 24,
                fontFamily: 'Cinzel',
                lineHeight: 1.2,
                align: 'left',
                eraseStrokes: [
                  {
                    strokeWidth: 12,
                    points: [
                      { x: -10, y: 0 },
                      { x: 8, y: 2 }
                    ]
                  }
                ],
                width: 88,
                height: 26
              }
            ]
          }
        ]
      }
    });

    const serverMessage = ServerToClientMessageSchema.safeParse({
      type: 'MAP_EDIT_OPS_APPLIED',
      payload: {
        revision: 2,
        operations: [
          {
            kind: 'DELETE',
            elementIds: ['element-2']
          }
        ]
      }
    });

    expect(clientMessage.success).toBe(true);
    expect(serverMessage.success).toBe(true);
  });

  it('validates token create/update metadata payloads', () => {
    const createMessage = ClientToServerMessageSchema.safeParse({
      type: 'TOKEN_CREATE',
      payload: {
        name: 'Flying Imp',
        x: 120,
        y: 160,
        size: 1,
        kind: 'ENEMY',
        color: '#ef4444',
        elevation: 20
      }
    });

    const updateMessage = ClientToServerMessageSchema.safeParse({
      type: 'TOKEN_UPDATE',
      payload: {
        tokenId: 'token-1',
        name: 'Flying Imp (Wounded)',
        color: '#f97316'
      }
    });

    expect(createMessage.success).toBe(true);
    expect(updateMessage.success).toBe(true);
  });

  it('validates HTTP room schemas', () => {
    const createReq = CreateRoomRequestSchema.safeParse({
      name: 'Crypt of the Mad Mage',
      displayName: 'DM Lia',
      clientId: 'client-1'
    });

    const joinReq = JoinRoomRequestSchema.safeParse({
      joinSecret: 'ABCD1234',
      displayName: 'Player Ron',
      clientId: 'client-2',
      roleDesired: 'PLAYER'
    });

    const roomState = RoomStateResponseSchema.safeParse({
      roomId: 'room-1',
      storageMode: 'CLOUD',
      hostUserId: 'user-1',
      settings: {
        roomId: 'room-1',
        tokenMovePolicy: 'OWNED_ONLY',
        mapEditPolicy: 'PLAYERS',
        mapEditUserOverrides: []
      },
      members: [],
      currentMapAssetId: null,
      currentMapAsset: null,
      tokens: [
        {
          id: 'token-1',
          roomId: 'room-1',
          name: 'Goblin',
          x: 12,
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
            mode: 'USERS',
            userIds: ['user-1']
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    });

    expect(createReq.success).toBe(true);
    expect(joinReq.success).toBe(true);
    expect(roomState.success).toBe(true);
  });

  it('validates LOCAL create/join HTTP responses without server game-state payload', () => {
    const iso = new Date().toISOString();

    const createLocal = CreateRoomResponseSchema.safeParse({
      roomId: 'room-1',
      joinSecret: 'ABCD1234',
      storageMode: 'LOCAL',
      hostUserId: 'user-dm',
      wsUrl: 'ws://localhost:3000/ws',
      roleAssigned: 'DM',
      member: {
        roomId: 'room-1',
        userId: 'user-dm',
        role: 'DM',
        displayName: 'DM',
        joinedAt: iso,
        lastSeenAt: iso
      }
    });

    const joinLocal = JoinRoomResponseSchema.safeParse({
      roomId: 'room-1',
      storageMode: 'LOCAL',
      hostUserId: 'user-dm',
      wsUrl: 'ws://localhost:3000/ws',
      roleAssigned: 'PLAYER',
      member: {
        roomId: 'room-1',
        userId: 'user-2',
        role: 'PLAYER',
        displayName: 'Player',
        joinedAt: iso,
        lastSeenAt: iso
      }
    });

    expect(createLocal.success).toBe(true);
    expect(joinLocal.success).toBe(true);
  });

  it('validates local relay payload contracts', () => {
    const hostRequest = HostRequestSchema.safeParse({
      type: 'REQUEST_MAPEDIT_OPS',
      baseRev: 2,
      ops: [
        {
          kind: 'CLEAR'
        }
      ]
    });

    const hostEvent = HostEventSchema.safeParse({
      type: 'MAP_ACTIVE_SET',
      mapRef: {
        kind: 'LOCAL_ASSET',
        hash: 'a'.repeat(64)
      }
    });

    const hostDirect = HostDirectSchema.safeParse({
      type: 'ASSET_CHUNK',
      hash: 'b'.repeat(64),
      seq: 0,
      total: 1,
      bytesBase64: 'Zm9v'
    });

    expect(hostRequest.success).toBe(true);
    expect(hostEvent.success).toBe(true);
    expect(hostDirect.success).toBe(true);
  });

  it('validates local chat request/event/direct contracts', () => {
    const hostRequestPublic = HostRequestSchema.safeParse({
      type: 'REQUEST_CHAT_SEND',
      kind: 'PUBLIC',
      text: 'Hello party'
    });

    const hostRequestWhisper = HostRequestSchema.safeParse({
      type: 'REQUEST_CHAT_SEND',
      kind: 'WHISPER',
      text: 'Secret for Player 1',
      recipients: ['user-player-1']
    });

    const hostRequestFileRequest = HostRequestSchema.safeParse({
      type: 'FILE_REQUEST',
      transferId: 'transfer-1',
      hash: 'e'.repeat(64),
      name: 'notes.pdf',
      mime: 'application/pdf',
      size: 4096,
      seedUserId: 'user-player-2'
    });

    const hostRequestAttachmentOnly = HostRequestSchema.safeParse({
      type: 'REQUEST_CHAT_SEND',
      kind: 'PUBLIC',
      text: '',
      attachments: [
        {
          hash: 'a'.repeat(64),
          name: 'notes.pdf',
          mime: 'application/pdf',
          size: 1024
        }
      ]
    });

    const hostEventPublic = HostEventSchema.safeParse({
      type: 'CHAT_MESSAGE_PUBLIC',
      id: 'chat-1',
      ts: Date.now(),
      fromUserId: 'user-dm',
      fromName: 'DM',
      text: 'Welcome to the dungeon',
      attachments: [
        {
          hash: 'b'.repeat(64),
          name: 'map.png',
          mime: 'image/png',
          size: 2048
        }
      ]
    });

    const hostDirectWhisper = HostDirectSchema.safeParse({
      type: 'CHAT_MESSAGE_WHISPER',
      id: 'chat-2',
      ts: Date.now(),
      fromUserId: 'user-dm',
      fromName: 'DM',
      toUserIds: ['user-player-1'],
      text: 'Check the hidden door'
    });

    const fileSignal = HostDirectSchema.safeParse({
      type: 'FILE_SIGNAL',
      fromUserId: 'user-player-1',
      transferId: 'transfer-1',
      hash: 'c'.repeat(64),
      kind: 'offer',
      data: {
        sdp: 'dummy'
      }
    });

    expect(hostRequestPublic.success).toBe(true);
    expect(hostRequestWhisper.success).toBe(true);
    expect(hostRequestFileRequest.success).toBe(true);
    expect(hostRequestAttachmentOnly.success).toBe(true);
    expect(hostEventPublic.success).toBe(true);
    expect(hostDirectWhisper.success).toBe(true);
    expect(fileSignal.success).toBe(true);
  });

  it('validates local room snapshots', () => {
    const snapshot = RoomSnapshotSchema.safeParse({
      snapshotVersion: 1,
      roomId: 'room-1',
      generatedAt: new Date().toISOString(),
      hostUserId: 'user-1',
      settings: {
        tokenMovePolicy: 'ALL',
        mapEditPolicy: 'DM_ONLY',
        mapEditUserOverrides: [],
        gridType: 'SQUARE',
        cellSizePx: 48,
        cellDistance: 5,
        cellUnit: 'ft',
        gridOriginX: 0,
        gridOriginY: 0,
        gridOriginZ: 0,
        snapToGrid: true,
        stackDisplay: 'FAN',
        mapOffsetX: 0,
        mapOffsetY: 0,
        mapScale: 1,
        mapRotationDeg: 0
      },
      currentMapRef: null,
      tokens: [],
      mapEdit: {
        rev: 0,
        document: {
          elements: []
        }
      },
      chat: {
        messages: [
          {
            kind: 'PUBLIC',
            id: 'chat-1',
            ts: Date.now(),
            fromUserId: 'user-1',
            fromName: 'DM Lia',
            text: 'Welcome adventurers.',
            attachments: [
              {
                hash: 'd'.repeat(64),
                name: 'scene.webp',
                mime: 'image/webp',
                size: 3333
              }
            ]
          }
        ],
        maxMessages: 500
      },
      assetsManifest: {
        hashes: [],
        byHash: {}
      }
    });

    expect(snapshot.success).toBe(true);
  });

  it('keeps event envelope open for future events', () => {
    const parsed = EventEnvelopeSchema.safeParse({
      type: 'TOKEN_MOVE',
      payload: {
        tokenId: 't1',
        x: 10,
        y: 20
      },
      ts: Date.now()
    });

    expect(parsed.success).toBe(true);
  });

  it('validates chat message snapshot union', () => {
    const parsed = ChatMessageSchema.safeParse({
      kind: 'WHISPER',
      id: 'chat-whisper-1',
      ts: Date.now(),
      fromUserId: 'user-dm',
      fromName: 'DM',
      toUserIds: ['user-player-1', 'user-player-2'],
      text: 'Only you can see this'
    });

    expect(parsed.success).toBe(true);
  });
});
