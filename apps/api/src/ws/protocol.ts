import type { ClientToServerMessage, WelcomeMessage } from '@dnd-vtt/shared';
import { ClientToServerMessageSchema, WelcomeMessageSchema } from '@dnd-vtt/shared';

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

export const createWelcomeMessage = (now: Date = new Date()): WelcomeMessage => {
  return WelcomeMessageSchema.parse({
    type: 'WELCOME',
    payload: {
      serverTime: now.toISOString()
    }
  });
};
