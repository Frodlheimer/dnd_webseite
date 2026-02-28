import { describe, expect, it } from 'vitest';

import { createWelcomeMessage, parseClientMessage } from '../src/ws/protocol.js';

describe('ws protocol helpers', () => {
  it('accepts valid HELLO payloads', () => {
    const message = JSON.stringify({
      type: 'HELLO',
      payload: {
        clientId: 'client-1',
        desiredRoomId: 'room-42'
      }
    });

    const parsed = parseClientMessage(message);

    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('HELLO');
  });

  it('builds WELCOME payloads with ISO timestamps', () => {
    const message = createWelcomeMessage(new Date('2026-01-01T00:00:00.000Z'));

    expect(message.type).toBe('WELCOME');
    expect(message.payload.serverTime).toBe('2026-01-01T00:00:00.000Z');
  });
});
