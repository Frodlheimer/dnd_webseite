import { describe, expect, it } from 'vitest';

import { createErrorMessage, parseClientMessage, serializeServerMessage } from '../src/ws/protocol.js';

describe('ws protocol helpers', () => {
  it('accepts valid HELLO payloads', () => {
    const message = JSON.stringify({
      type: 'HELLO',
      payload: {
        clientId: 'client-1',
        displayName: 'Rin',
        roomId: 'room-42'
      }
    });

    const parsed = parseClientMessage(message);

    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('HELLO');
  });

  it('rejects invalid payloads', () => {
    const parsed = parseClientMessage(
      JSON.stringify({
        type: 'HELLO',
        payload: {
          clientId: 'client-1',
          displayName: 'Rin'
        }
      })
    );

    expect(parsed).toBeNull();
  });

  it('serializes server events through schema validation', () => {
    const payload = serializeServerMessage({
      type: 'ERROR',
      payload: {
        code: 'FORBIDDEN',
        message: 'Not allowed'
      }
    });

    expect(payload).toContain('FORBIDDEN');
  });

  it('builds error payload with LOCAL relay hint details', () => {
    const message = createErrorMessage(
      'LOCAL_REQUIRES_RELAY_TO_HOST',
      'LOCAL mode rejects direct TOKEN_MOVE messages',
      {
        rejectedType: 'TOKEN_MOVE',
        hint: 'Send RELAY_TO_HOST with a HostRequest'
      }
    );

    expect(message.payload).toEqual(
      expect.objectContaining({
        code: 'LOCAL_REQUIRES_RELAY_TO_HOST',
        rejectedType: 'TOKEN_MOVE'
      })
    );
  });
});
