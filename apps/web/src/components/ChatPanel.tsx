import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode
} from 'react';

import type {
  ChatAttachment,
  ChatMessage,
  ChatSendKind,
  PresenceMember,
  Role,
  RoomMember,
  StorageMode
} from '@dnd-vtt/shared';

import { LOCAL_CHAT_MAX_ATTACHMENT_BYTES, LOCAL_CHAT_MAX_ATTACHMENTS } from '../local/chatHost';

type ChatPanelProps = {
  storageMode: StorageMode | null;
  role: Role | null;
  userId: string | null;
  hostUserId: string | null;
  members: RoomMember[];
  membersOnline: PresenceMember[];
  isWaitingForHostSnapshot: boolean;
  isLocalNonHostBlockedByOfflineHost: boolean;
  messages: ChatMessage[];
  composeKind: ChatSendKind;
  composeRecipients: string[];
  attachmentUrlByHash: Record<string, string>;
  attachmentTransferByHash: Record<
    string,
    {
      status: 'available' | 'not_downloaded' | 'downloading' | 'failed';
      progress: number;
      error?: string;
    }
  >;
  onComposeKindChange: (kind: ChatSendKind) => void;
  onComposeRecipientsChange: (userIds: string[]) => void;
  onPrepareAttachment: (file: File) => Promise<ChatAttachment>;
  onRequestAttachmentDownload: (attachment: ChatAttachment) => void;
  onOpenAttachment: (attachment: ChatAttachment) => void;
  onDownloadAttachment: (attachment: ChatAttachment) => void;
  onSendMessage: (args: {
    kind: ChatSendKind;
    text: string;
    recipients: string[];
    attachments: ChatAttachment[];
  }) => void;
};

const CHAT_MAX_TEXT_LENGTH = 4_000;
const LINK_PATTERN = /https?:\/\/[^\s]+/gi;

const formatMessageTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const dedupeMembers = (
  members: RoomMember[],
  membersOnline: PresenceMember[]
): Array<{ userId: string; name: string; role: Role }> => {
  const byUserId = new Map<string, { userId: string; name: string; role: Role }>();

  for (const member of members) {
    byUserId.set(member.userId, {
      userId: member.userId,
      name: member.displayName,
      role: member.role
    });
  }

  for (const online of membersOnline) {
    byUserId.set(online.userId, {
      userId: online.userId,
      name: online.displayName,
      role: online.role
    });
  }

  return [...byUserId.values()];
};

const toDisplayName = (userId: string, byUserId: Map<string, string>): string => {
  return byUserId.get(userId) ?? userId.slice(0, 8);
};

const trimTrailingPunctuation = (url: string): { href: string; trailing: string } => {
  let href = url;
  let trailing = '';
  while (/[),.;!?]$/.test(href)) {
    trailing = href[href.length - 1] + trailing;
    href = href.slice(0, -1);
  }

  return {
    href,
    trailing
  };
};

const renderTextWithLinks = (text: string): ReactNode => {
  if (!text) {
    return null;
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const raw = match[0];
    const index = match.index ?? -1;
    if (index < cursor) {
      continue;
    }

    if (index > cursor) {
      nodes.push(text.slice(cursor, index));
    }

    const { href, trailing } = trimTrailingPunctuation(raw);
    nodes.push(
      <a
        key={`${href}-${index}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-sky-500 hover:text-sky-500"
      >
        {href}
      </a>
    );

    if (trailing) {
      nodes.push(trailing);
    }

    cursor = index + raw.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return <>{nodes}</>;
};

const formatBytes = (size: number): string => {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const ChatPanel = ({
  storageMode,
  role,
  userId,
  hostUserId,
  members,
  membersOnline,
  isWaitingForHostSnapshot,
  isLocalNonHostBlockedByOfflineHost,
  messages,
  composeKind,
  composeRecipients,
  attachmentUrlByHash,
  attachmentTransferByHash,
  onComposeKindChange,
  onComposeRecipientsChange,
  onPrepareAttachment,
  onRequestAttachmentDownload,
  onOpenAttachment,
  onDownloadAttachment,
  onSendMessage
}: ChatPanelProps) => {
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [isPreparingAttachments, setIsPreparingAttachments] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);

  const allMembers = useMemo(() => dedupeMembers(members, membersOnline), [members, membersOnline]);
  const displayNameById = useMemo(() => {
    return new Map(allMembers.map((entry) => [entry.userId, entry.name]));
  }, [allMembers]);

  const whisperCandidates = useMemo(() => {
    return allMembers.filter((entry) => entry.userId !== hostUserId);
  }, [allMembers, hostUserId]);

  const canSelectWhisper = storageMode === 'LOCAL' && role === 'DM';
  const canSendInLocal =
    storageMode === 'LOCAL' &&
    !isWaitingForHostSnapshot &&
    !isLocalNonHostBlockedByOfflineHost &&
    (role === 'DM' || role === 'PLAYER');
  const text = draft.trim();
  const isWhisperWithoutRecipients = composeKind === 'WHISPER' && composeRecipients.length === 0;
  const hasContent = text.length > 0 || pendingAttachments.length > 0;
  const canSend =
    canSendInLocal &&
    hasContent &&
    text.length <= CHAT_MAX_TEXT_LENGTH &&
    !isWhisperWithoutRecipients &&
    !isPreparingAttachments;

  const handleSend = () => {
    if (!canSend) {
      return;
    }

    onSendMessage({
      kind: composeKind,
      text,
      recipients: composeKind === 'WHISPER' ? composeRecipients : [],
      attachments: pendingAttachments
    });
    setDraft('');
    setPendingAttachments([]);
    setComposeError(null);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    handleSend();
  };

  const handleAttachmentInput = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (selectedFiles.length === 0) {
      return;
    }

    if (pendingAttachments.length + selectedFiles.length > LOCAL_CHAT_MAX_ATTACHMENTS) {
      setComposeError(`Max ${LOCAL_CHAT_MAX_ATTACHMENTS} attachments per message.`);
      return;
    }

    setIsPreparingAttachments(true);
    setComposeError(null);
    const next: ChatAttachment[] = [];

    try {
      for (const file of selectedFiles) {
        if (file.size > LOCAL_CHAT_MAX_ATTACHMENT_BYTES) {
          setComposeError(`${file.name} is too large (${formatBytes(file.size)}).`);
          continue;
        }

        const prepared = await onPrepareAttachment(file);
        next.push(prepared);
      }

      if (next.length > 0) {
        setPendingAttachments((previous) => {
          const byHash = new Map<string, ChatAttachment>(
            previous.map((attachment) => [attachment.hash, attachment])
          );
          for (const attachment of next) {
            byHash.set(attachment.hash, attachment);
          }
          return [...byHash.values()].slice(0, LOCAL_CHAT_MAX_ATTACHMENTS);
        });
      }
    } catch (error) {
      setComposeError(error instanceof Error ? error.message : 'Could not prepare attachment');
    } finally {
      setIsPreparingAttachments(false);
    }
  };

  useEffect(() => {
    const list = listRef.current;
    if (!list || !shouldAutoScroll) {
      return;
    }

    list.scrollTop = list.scrollHeight;
  }, [messages.length, shouldAutoScroll]);

  const handleListScroll = () => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    setShouldAutoScroll(distanceToBottom < 64);
  };

  const statusHint =
    storageMode !== 'LOCAL'
      ? 'CLOUD_CHAT_NOT_IMPLEMENTED'
      : isWaitingForHostSnapshot
        ? 'Waiting for host snapshot...'
        : isLocalNonHostBlockedByOfflineHost
          ? 'Host (DM) is offline.'
          : role === 'SPECTATOR'
            ? 'Spectators cannot chat.'
            : null;

  return (
    <section className="rounded border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Chat</h3>

      <div
        ref={listRef}
        onScroll={handleListScroll}
        className="mt-2 max-h-72 space-y-2 overflow-y-auto rounded border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
      >
        {messages.map((message) => {
          const isOwn = !!userId && message.fromUserId === userId;
          const fromName = message.fromName || toDisplayName(message.fromUserId, displayNameById);
          const baseMeta = `${fromName} | ${formatMessageTime(message.ts)}`;
          const whisperTo =
            message.kind === 'WHISPER'
              ? message.toUserIds
                  .map((toUserId) => toDisplayName(toUserId, displayNameById))
                  .join(', ')
              : '';

          return (
            <article
              key={message.id}
              className={`rounded border px-2 py-1 text-xs ${
                isOwn
                  ? 'border-sky-300 bg-sky-50 text-slate-800 dark:border-sky-700 dark:bg-sky-950/30 dark:text-slate-100'
                  : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              }`}
            >
              <header className="mb-1 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="truncate">
                  {message.kind === 'PUBLIC'
                    ? baseMeta
                    : message.kind === 'WHISPER'
                      ? role === 'DM'
                        ? `${baseMeta} | Whisper to: ${whisperTo}`
                        : `${baseMeta} | Whisper`
                      : `${baseMeta} | DM Note`}
                </span>
              </header>

              {message.text ? (
                <p className="whitespace-pre-wrap break-words">
                  {renderTextWithLinks(message.text)}
                </p>
              ) : null}

              {message.attachments && message.attachments.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {message.attachments.map((attachment, index) => {
                    const transferState = attachmentTransferByHash[attachment.hash];
                    const url = attachmentUrlByHash[attachment.hash];
                    const resolvedState =
                      transferState?.status ??
                      (url ? ('available' as const) : ('not_downloaded' as const));
                    const isImage = attachment.mime.startsWith('image/');

                    return (
                      <li
                        key={`${message.id}:${attachment.hash}:${index}`}
                        className="rounded border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
                      >
                        {isImage && url ? (
                          <button
                            type="button"
                            className="mb-2 block w-full cursor-zoom-in"
                            onClick={() => onOpenAttachment(attachment)}
                          >
                            <img
                              src={url}
                              alt={attachment.name}
                              className="max-h-28 max-w-full rounded border border-slate-300 object-contain dark:border-slate-700"
                            />
                          </button>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px]">
                            {attachment.name} ({formatBytes(attachment.size)})
                          </span>

                          {resolvedState === 'available' && url ? (
                            <>
                              <button
                                type="button"
                                className="rounded border border-slate-400 bg-slate-100 px-2 py-1 text-[11px] hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600"
                                onClick={() => onOpenAttachment(attachment)}
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                className="rounded border border-slate-400 bg-slate-100 px-2 py-1 text-[11px] hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600"
                                onClick={() => onDownloadAttachment(attachment)}
                              >
                                Download
                              </button>
                            </>
                          ) : null}

                          {resolvedState === 'not_downloaded' ? (
                            <button
                              type="button"
                              className="rounded border border-sky-400 bg-sky-50 px-2 py-1 text-[11px] text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200"
                              onClick={() => onRequestAttachmentDownload(attachment)}
                            >
                              Request download
                            </button>
                          ) : null}

                          {resolvedState === 'downloading' ? (
                            <span className="text-[11px] text-amber-700 dark:text-amber-200">
                              Downloading{' '}
                              {Math.max(0, Math.min(100, Math.round(transferState?.progress ?? 0)))}
                              %
                            </span>
                          ) : null}

                          {resolvedState === 'failed' ? (
                            <>
                              <span className="text-[11px] text-rose-700 dark:text-rose-300">
                                {transferState?.error ?? 'Download failed'}
                              </span>
                              <button
                                type="button"
                                className="rounded border border-rose-400 bg-rose-50 px-2 py-1 text-[11px] text-rose-800 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
                                onClick={() => onRequestAttachmentDownload(attachment)}
                              >
                                Retry
                              </button>
                            </>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </article>
          );
        })}
        {messages.length === 0 ? <p className="text-xs text-slate-500">No messages yet.</p> : null}
      </div>

      {canSelectWhisper ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-700 dark:text-slate-300">
            Mode
            <select
              value={composeKind}
              onChange={(event) => onComposeKindChange(event.target.value as ChatSendKind)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="PUBLIC">Public</option>
              <option value="WHISPER">Whisper</option>
              <option value="DM_NOTE">DM Note</option>
            </select>
          </label>

          {composeKind === 'WHISPER' ? (
            <label className="text-xs text-slate-700 dark:text-slate-300">
              Recipients
              <select
                multiple
                value={composeRecipients}
                onChange={(event) =>
                  onComposeRecipientsChange(
                    [...event.currentTarget.selectedOptions]
                      .map((option) => option.value)
                      .filter(Boolean)
                  )
                }
                className="mt-1 h-20 w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
              >
                {whisperCandidates.map((entry) => (
                  <option key={entry.userId} value={entry.userId}>
                    {entry.name} ({entry.role})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div />
          )}
        </div>
      ) : null}

      <label className="mt-2 block text-xs text-slate-700 dark:text-slate-300">
        Message
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleInputKeyDown}
          maxLength={CHAT_MAX_TEXT_LENGTH}
          rows={3}
          placeholder={statusHint ? statusHint : 'Press Enter to send, Shift+Enter for a new line'}
          disabled={!canSendInLocal}
          className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
      </label>

      <div className="mt-2 flex items-center gap-2">
        <label className="cursor-pointer rounded bg-slate-200 px-3 py-1 text-xs text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
          Attach file
          <input
            type="file"
            multiple
            className="hidden"
            accept="image/*,.pdf,.txt,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.json"
            disabled={
              !canSendInLocal ||
              pendingAttachments.length >= LOCAL_CHAT_MAX_ATTACHMENTS ||
              isPreparingAttachments
            }
            onChange={(event) => {
              void handleAttachmentInput(event);
            }}
          />
        </label>

        {pendingAttachments.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {pendingAttachments.map((attachment) => (
              <button
                key={attachment.hash}
                type="button"
                className="rounded border border-slate-400 bg-white px-2 py-1 text-[11px] dark:border-slate-600 dark:bg-slate-800"
                onClick={() =>
                  setPendingAttachments((previous) =>
                    previous.filter((entry) => entry.hash !== attachment.hash)
                  )
                }
                title="Remove attachment"
              >
                {attachment.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {composeError ?? statusHint ?? `${text.length}/${CHAT_MAX_TEXT_LENGTH}`}
        </span>
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="rounded bg-sky-700 px-3 py-1 text-xs text-slate-100 hover:bg-sky-600 disabled:opacity-40"
        >
          {isPreparingAttachments ? 'Preparing...' : 'Send'}
        </button>
      </div>
    </section>
  );
};
