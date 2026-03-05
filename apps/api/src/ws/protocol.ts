import type { ClientToServerMessage, ErrorMessage, ServerToClientMessage } from '@dnd-vtt/shared';
import { ClientToServerMessageSchema, ServerToClientMessageSchema } from '@dnd-vtt/shared';

export const parseClientMessage = (raw: string): ClientToServerMessage | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const result = ClientToServerMessageSchema.safeParse(parsed);
  return result.success ? result.data : null;
};

export const serializeServerMessage = (message: ServerToClientMessage): string => {
  return JSON.stringify(ServerToClientMessageSchema.parse(message));
};

export const createErrorMessage = (
  code: string,
  message: string,
  details?: {
    rejectedType?: string | undefined;
    hint?: string | undefined;
  }
): ErrorMessage => {
  return {
    type: 'ERROR',
    payload: {
      code,
      message,
      ...(details
        ? {
            ...details
          }
        : {})
    }
  };
};
