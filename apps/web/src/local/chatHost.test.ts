import { describe, expect, it } from 'vitest';

import { LocalSessionSettingsSchema, type RoomSnapshot } from '@dnd-vtt/shared';

import { DEFAULT_BOARD_SETTINGS } from '../components/boardTypes';
import { buildDefaultPolicies, buildLocalSnapshot } from './localSync';
import {
  appendChatMessage,
  filterSnapshotForUser,
  processChatSendRequest,
  type ProcessChatSendRequestResult
} from './chatHost';

const createSnapshot = (): RoomSnapshot => {
  return buildLocalSnapshot({
    roomId: 'room-1',
    hostUserId: 'dm-1',
    settings: LocalSessionSettingsSchema.parse({
      ...defaultSettings,
      ...buildDefaultPolicies()
    }),
    currentMapRef: null,
    tokens: [],
    mapEditElements: [],
    mapEditRev: 0
  });
};

const defaultSettings = {
  ...DEFAULT_BOARD_SETTINGS,
  tokenMovePolicy: 'ALL' as const,
  tokenEditPolicy: 'DM_ONLY' as const,
  mapEditPolicy: 'DM_ONLY' as const,
  mapEditUserOverrides: [],
  autoExportEnabled: true,
  autoExportIntervalMinutes: 30
};

const assertSuccess = (result: ProcessChatSendRequestResult): Exclude<ProcessChatSendRequestResult, { ok: false }> => {
  if (!result.ok) {
    throw new Error(`Expected success, got ${result.code}`);
  }

  return result;
};

describe('chatHost', () => {
  it('dedupes messages by id', () => {
    const message = {
      kind: 'PUBLIC' as const,
      id: 'm-1',
      ts: 100,
      fromUserId: 'dm-1',
      fromName: 'DM',
      text: 'test'
    };

    const appended = appendChatMessage({
      messages: [message],
      message,
      maxMessages: 500
    });

    expect(appended).toHaveLength(1);
  });

  it('filters snapshot chat visibility per target user', () => {
    const snapshot = createSnapshot();
    const nextSnapshot = {
      ...snapshot,
      chat: {
        ...snapshot.chat,
        messages: [
          {
            kind: 'PUBLIC' as const,
            id: 'p-1',
            ts: 1,
            fromUserId: 'dm-1',
            fromName: 'DM',
            text: 'all'
          },
          {
            kind: 'WHISPER' as const,
            id: 'w-1',
            ts: 2,
            fromUserId: 'dm-1',
            fromName: 'DM',
            toUserIds: ['player-1'],
            text: 'secret'
          },
          {
            kind: 'DM_NOTE' as const,
            id: 'd-1',
            ts: 3,
            fromUserId: 'dm-1',
            fromName: 'DM',
            text: 'note'
          }
        ]
      }
    };

    const filteredForPlayer1 = filterSnapshotForUser(nextSnapshot, 'player-1');
    const filteredForPlayer2 = filterSnapshotForUser(nextSnapshot, 'player-2');

    expect(filteredForPlayer1.chat.messages.map((entry) => entry.id)).toEqual(['p-1', 'w-1']);
    expect(filteredForPlayer2.chat.messages.map((entry) => entry.id)).toEqual(['p-1']);
  });

  it('accepts PUBLIC from player and appends to snapshot', () => {
    const snapshot = createSnapshot();
    const result = assertSuccess(
      processChatSendRequest({
        snapshot,
        request: {
          type: 'REQUEST_CHAT_SEND',
          kind: 'PUBLIC',
          text: 'hello'
        },
        fromUserId: 'player-1',
        fromName: 'Player One',
        fromRole: 'PLAYER',
        knownUserIds: ['dm-1', 'player-1'],
        now: () => 123,
        createId: () => 'public-1'
      })
    );

    expect(result.hostEvent.type).toBe('CHAT_MESSAGE_PUBLIC');
    expect(result.directMessages).toHaveLength(0);
    expect(result.nextSnapshot.chat.messages.map((entry) => entry.id)).toEqual(['public-1']);
  });

  it('rejects whisper from non-DM', () => {
    const snapshot = createSnapshot();
    const result = processChatSendRequest({
      snapshot,
      request: {
        type: 'REQUEST_CHAT_SEND',
        kind: 'WHISPER',
        text: 'secret',
        recipients: ['dm-1']
      },
      fromUserId: 'player-1',
      fromName: 'Player One',
      fromRole: 'PLAYER',
      knownUserIds: ['dm-1', 'player-1'],
      now: () => 123,
      createId: () => 'w-1'
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('FORBIDDEN');
    }
  });

  it('sends whisper as direct messages for recipients', () => {
    const snapshot = createSnapshot();
    const result = assertSuccess(
      processChatSendRequest({
        snapshot,
        request: {
          type: 'REQUEST_CHAT_SEND',
          kind: 'WHISPER',
          text: 'secret',
          recipients: ['player-1', 'player-2']
        },
        fromUserId: 'dm-1',
        fromName: 'DM',
        fromRole: 'DM',
        knownUserIds: ['dm-1', 'player-1', 'player-2'],
        now: () => 123,
        createId: () => 'w-2'
      })
    );

    expect(result.hostEvent.type).toBe('CHAT_MESSAGE_WHISPER');
    expect(result.nextSnapshot.chat.messages).toHaveLength(1);
    expect(result.directMessages.map((entry) => entry.userId).sort()).toEqual(['player-1', 'player-2']);
  });

  it('accepts attachment-only public message', () => {
    const snapshot = createSnapshot();
    const result = assertSuccess(
      processChatSendRequest({
        snapshot,
        request: {
          type: 'REQUEST_CHAT_SEND',
          kind: 'PUBLIC',
          text: '',
          attachments: [
            {
              hash: 'a'.repeat(64),
              name: 'note.txt',
              mime: 'text/plain',
              size: 3
            }
          ]
        },
        fromUserId: 'player-1',
        fromName: 'Player One',
        fromRole: 'PLAYER',
        knownUserIds: ['dm-1', 'player-1'],
        now: () => 123,
        createId: () => 'public-att-1'
      })
    );

    expect(result.hostEvent.type).toBe('CHAT_MESSAGE_PUBLIC');
    if (result.hostEvent.type === 'CHAT_MESSAGE_PUBLIC') {
      expect(result.hostEvent.attachments?.[0]?.name).toBe('note.txt');
      expect(result.hostEvent.attachments?.[0]?.seedUserId).toBe('player-1');
    }
    expect(result.nextSnapshot.chat.messages).toHaveLength(1);
  });

  it('rejects message without text and without attachment', () => {
    const snapshot = createSnapshot();
    const result = processChatSendRequest({
      snapshot,
      request: {
        type: 'REQUEST_CHAT_SEND',
        kind: 'PUBLIC',
        text: ''
      },
      fromUserId: 'player-1',
      fromName: 'Player One',
      fromRole: 'PLAYER',
      knownUserIds: ['dm-1', 'player-1']
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_CHAT_TEXT');
    }
  });
});
