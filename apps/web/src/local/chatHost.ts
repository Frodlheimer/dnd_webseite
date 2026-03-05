import type {
  ChatAttachment,
  ChatMessage,
  ChatMessageDmNote,
  ChatMessagePublic,
  ChatMessageWhisper,
  HostDirect,
  HostEvent,
  HostRequest,
  Role,
  RoomSnapshot
} from '@dnd-vtt/shared';

export const LOCAL_CHAT_MAX_MESSAGES = 500;
export const LOCAL_CHAT_MAX_TEXT_LENGTH = 4_000;
export const LOCAL_CHAT_CLIENT_RATE_LIMIT_MS = 300;
export const LOCAL_CHAT_MAX_ATTACHMENTS = 4;
export const LOCAL_CHAT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

type ChatHostEvent = Extract<HostEvent, { type: 'CHAT_MESSAGE_PUBLIC' | 'CHAT_MESSAGE_WHISPER' | 'CHAT_MESSAGE_DM_NOTE' }>;
type ChatHostDirect = Extract<HostDirect, { type: 'CHAT_MESSAGE_WHISPER' | 'CHAT_MESSAGE_DM_NOTE' }>;
type ChatSendRequest = Extract<HostRequest, { type: 'REQUEST_CHAT_SEND' }>;

type ProcessChatSendRequestError = {
  ok: false;
  code: string;
  message: string;
};

type ProcessChatSendRequestSuccess = {
  ok: true;
  hostEvent: ChatHostEvent;
  nextSnapshot: RoomSnapshot;
  directMessages: Array<{
    userId: string;
    payload: ChatHostDirect;
  }>;
};

export type ProcessChatSendRequestResult = ProcessChatSendRequestError | ProcessChatSendRequestSuccess;

const normalizeUserIdList = (userIds: string[]): string[] => {
  const unique = new Set<string>();

  for (const userId of userIds) {
    const trimmed = userId.trim();
    if (trimmed.length === 0) {
      continue;
    }

    unique.add(trimmed);
  }

  return [...unique];
};

const createChatMessageId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeChatAttachmentList = (attachments: ChatAttachment[] | undefined): ChatAttachment[] => {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  const byHash = new Map<string, ChatAttachment>();
  for (const attachment of attachments) {
    const hash = attachment.hash.trim().toLowerCase();
    const name = attachment.name.trim();
    const mime = attachment.mime.trim();

    if (!hash || !name || !mime) {
      continue;
    }

    byHash.set(hash, {
      ...attachment,
      hash,
      name,
      mime
    });
  }

  return [...byHash.values()];
};

const withOptionalAttachments = (attachments: ChatAttachment[] | undefined): { attachments?: ChatAttachment[] } => {
  if (!attachments || attachments.length === 0) {
    return {};
  }

  return {
    attachments
  };
};

export const normalizeChatText = (text: string): string => {
  return text.trim();
};

const buildPublicChatMessage = (args: {
  id: string;
  ts: number;
  fromUserId: string;
  fromName: string;
  text: string;
  attachments?: ChatAttachment[];
}): ChatMessagePublic => ({
  kind: 'PUBLIC',
  id: args.id,
  ts: args.ts,
  fromUserId: args.fromUserId,
  fromName: args.fromName,
  text: args.text,
  attachments: args.attachments && args.attachments.length > 0 ? args.attachments : undefined
});

const buildWhisperChatMessage = (args: {
  id: string;
  ts: number;
  fromUserId: string;
  fromName: string;
  text: string;
  toUserIds: string[];
  attachments?: ChatAttachment[];
}): ChatMessageWhisper => ({
  kind: 'WHISPER',
  id: args.id,
  ts: args.ts,
  fromUserId: args.fromUserId,
  fromName: args.fromName,
  toUserIds: normalizeUserIdList(args.toUserIds),
  text: args.text,
  attachments: args.attachments && args.attachments.length > 0 ? args.attachments : undefined
});

const buildDmNoteMessage = (args: {
  id: string;
  ts: number;
  fromUserId: string;
  fromName: string;
  text: string;
  attachments?: ChatAttachment[];
}): ChatMessageDmNote => ({
  kind: 'DM_NOTE',
  id: args.id,
  ts: args.ts,
  fromUserId: args.fromUserId,
  fromName: args.fromName,
  text: args.text,
  attachments: args.attachments && args.attachments.length > 0 ? args.attachments : undefined
});

export const appendChatMessage = (args: {
  messages: ChatMessage[];
  message: ChatMessage;
  maxMessages: number;
}): ChatMessage[] => {
  if (args.messages.some((entry) => entry.id === args.message.id)) {
    return args.messages;
  }

  const next = [...args.messages, args.message];
  const maxMessages = Math.max(1, Math.min(5_000, Math.floor(args.maxMessages)));

  if (next.length <= maxMessages) {
    return next;
  }

  return next.slice(next.length - maxMessages);
};

export const appendChatMessageToSnapshot = (
  snapshot: RoomSnapshot,
  message: ChatMessage,
  maxMessagesOverride?: number
): RoomSnapshot => {
  const maxMessages = maxMessagesOverride ?? snapshot.chat.maxMessages ?? LOCAL_CHAT_MAX_MESSAGES;
  const nextMessages = appendChatMessage({
    messages: snapshot.chat.messages,
    message,
    maxMessages
  });

  if (nextMessages === snapshot.chat.messages) {
    return snapshot;
  }

  return {
    ...snapshot,
    generatedAt: new Date().toISOString(),
    chat: {
      ...snapshot.chat,
      maxMessages,
      messages: nextMessages
    }
  };
};

export const isChatMessageVisibleToUser = (args: {
  message: ChatMessage;
  targetUserId: string;
  hostUserId: string;
}): boolean => {
  if (args.message.kind === 'PUBLIC') {
    return true;
  }

  if (args.message.kind === 'WHISPER') {
    if (args.targetUserId === args.hostUserId) {
      return true;
    }

    if (args.message.fromUserId === args.targetUserId) {
      return true;
    }

    return args.message.toUserIds.includes(args.targetUserId);
  }

  return args.targetUserId === args.hostUserId;
};

export const filterChatMessagesForUser = (args: {
  messages: ChatMessage[];
  targetUserId: string;
  hostUserId: string;
}): ChatMessage[] => {
  return args.messages.filter((message) =>
    isChatMessageVisibleToUser({
      message,
      targetUserId: args.targetUserId,
      hostUserId: args.hostUserId
    })
  );
};

export const filterSnapshotForUser = (snapshot: RoomSnapshot, targetUserId: string): RoomSnapshot => {
  if (targetUserId === snapshot.hostUserId) {
    return snapshot;
  }

  return {
    ...snapshot,
    chat: {
      ...snapshot.chat,
      messages: filterChatMessagesForUser({
        messages: snapshot.chat.messages,
        targetUserId,
        hostUserId: snapshot.hostUserId
      })
    }
  };
};

export const chatMessageFromHostEvent = (event: ChatHostEvent): ChatMessage => {
  if (event.type === 'CHAT_MESSAGE_PUBLIC') {
    return buildPublicChatMessage({
      id: event.id,
      ts: event.ts,
      fromUserId: event.fromUserId,
      fromName: event.fromName,
      text: event.text,
      ...withOptionalAttachments(event.attachments)
    });
  }

  if (event.type === 'CHAT_MESSAGE_WHISPER') {
    return buildWhisperChatMessage({
      id: event.id,
      ts: event.ts,
      fromUserId: event.fromUserId,
      fromName: event.fromName,
      text: event.text,
      toUserIds: event.toUserIds,
      ...withOptionalAttachments(event.attachments)
    });
  }

  return buildDmNoteMessage({
    id: event.id,
    ts: event.ts,
    fromUserId: event.fromUserId,
    fromName: event.fromName,
    text: event.text,
    ...withOptionalAttachments(event.attachments)
  });
};

export const chatMessageFromHostDirect = (message: ChatHostDirect): ChatMessage => {
  if (message.type === 'CHAT_MESSAGE_WHISPER') {
    return buildWhisperChatMessage({
      id: message.id,
      ts: message.ts,
      fromUserId: message.fromUserId,
      fromName: message.fromName,
      text: message.text,
      toUserIds: message.toUserIds,
      ...withOptionalAttachments(message.attachments)
    });
  }

  return buildDmNoteMessage({
    id: message.id,
    ts: message.ts,
    fromUserId: message.fromUserId,
    fromName: message.fromName,
    text: message.text,
    ...withOptionalAttachments(message.attachments)
  });
};

export const processChatSendRequest = (args: {
  snapshot: RoomSnapshot;
  request: ChatSendRequest;
  fromUserId: string;
  fromName: string;
  fromRole: Role;
  knownUserIds: string[];
  maxMessages?: number;
  now?: () => number;
  createId?: () => string;
}): ProcessChatSendRequestResult => {
  const text = normalizeChatText(args.request.text);
  const attachments = normalizeChatAttachmentList(args.request.attachments);

  if (text.length > LOCAL_CHAT_MAX_TEXT_LENGTH) {
    return {
      ok: false,
      code: 'CHAT_TEXT_TOO_LONG',
      message: `Chat message exceeds ${LOCAL_CHAT_MAX_TEXT_LENGTH} characters`
    };
  }

  if (attachments.length > LOCAL_CHAT_MAX_ATTACHMENTS) {
    return {
      ok: false,
      code: 'CHAT_TOO_MANY_ATTACHMENTS',
      message: `Chat message supports up to ${LOCAL_CHAT_MAX_ATTACHMENTS} attachments`
    };
  }

  for (const attachment of attachments) {
    if (attachment.hash.length !== 64 || !/^[a-f0-9]{64}$/i.test(attachment.hash)) {
      return {
        ok: false,
        code: 'INVALID_ATTACHMENT_HASH',
        message: 'Attachment hash must be a SHA-256 hex string'
      };
    }

    if (!attachment.name || attachment.name.length > 255) {
      return {
        ok: false,
        code: 'INVALID_ATTACHMENT_NAME',
        message: 'Attachment name is invalid'
      };
    }

    if (!attachment.mime || attachment.mime.length > 255) {
      return {
        ok: false,
        code: 'INVALID_ATTACHMENT_MIME',
        message: 'Attachment MIME is invalid'
      };
    }

    if (!Number.isFinite(attachment.size) || attachment.size <= 0 || attachment.size > LOCAL_CHAT_MAX_ATTACHMENT_BYTES) {
      return {
        ok: false,
        code: 'CHAT_ATTACHMENT_TOO_LARGE',
        message: `Attachment exceeds ${LOCAL_CHAT_MAX_ATTACHMENT_BYTES} bytes`
      };
    }
  }

  if (text.length === 0 && attachments.length === 0) {
    return {
      ok: false,
      code: 'INVALID_CHAT_TEXT',
      message: 'Chat message must include text or an attachment'
    };
  }

  const ts = args.now ? args.now() : Date.now();
  const id = args.createId ? args.createId() : createChatMessageId();
  const fromName = args.fromName.trim().length > 0 ? args.fromName.trim() : 'Unknown';
  const maxMessages = args.maxMessages ?? args.snapshot.chat.maxMessages ?? LOCAL_CHAT_MAX_MESSAGES;
  const attachmentsWithSeed = attachments.map((attachment) => ({
    ...attachment,
    seedUserId: args.fromUserId
  }));

  if (args.request.kind === 'PUBLIC') {
    const hostEvent: ChatHostEvent = {
      type: 'CHAT_MESSAGE_PUBLIC',
      id,
      ts,
      fromUserId: args.fromUserId,
      fromName,
      text,
      ...withOptionalAttachments(attachmentsWithSeed)
    };

    return {
      ok: true,
      hostEvent,
      nextSnapshot: appendChatMessageToSnapshot(args.snapshot, chatMessageFromHostEvent(hostEvent), maxMessages),
      directMessages: []
    };
  }

  if (args.fromRole !== 'DM') {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Only DM can send whispers and DM notes'
    };
  }

  if (args.request.kind === 'WHISPER') {
    const knownUserIds = new Set(normalizeUserIdList(args.knownUserIds));
    const normalizedRecipients = normalizeUserIdList(args.request.recipients ?? []).filter((userId) =>
      knownUserIds.has(userId)
    );

    if (normalizedRecipients.length === 0) {
      return {
        ok: false,
        code: 'INVALID_RECIPIENTS',
        message: 'Whisper requires at least one valid recipient'
      };
    }

    const hostEvent: ChatHostEvent = {
      type: 'CHAT_MESSAGE_WHISPER',
      id,
      ts,
      fromUserId: args.fromUserId,
      fromName,
      toUserIds: normalizedRecipients,
      text,
      ...withOptionalAttachments(attachmentsWithSeed)
    };

    const payload: ChatHostDirect = {
      type: 'CHAT_MESSAGE_WHISPER',
      id,
      ts,
      fromUserId: args.fromUserId,
      fromName,
      toUserIds: normalizedRecipients,
      text,
      ...withOptionalAttachments(attachmentsWithSeed)
    };

    const directMessages = normalizedRecipients.map((userId) => ({
      userId,
      payload
    }));

    return {
      ok: true,
      hostEvent,
      nextSnapshot: appendChatMessageToSnapshot(args.snapshot, chatMessageFromHostEvent(hostEvent), maxMessages),
      directMessages
    };
  }

  const hostEvent: ChatHostEvent = {
    type: 'CHAT_MESSAGE_DM_NOTE',
    id,
    ts,
    fromUserId: args.fromUserId,
    fromName,
    text,
    ...withOptionalAttachments(attachmentsWithSeed)
  };

  return {
    ok: true,
    hostEvent,
    nextSnapshot: appendChatMessageToSnapshot(args.snapshot, chatMessageFromHostEvent(hostEvent), maxMessages),
    directMessages: []
  };
};
