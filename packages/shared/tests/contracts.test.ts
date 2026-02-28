import { describe, expect, it } from 'vitest';

import {
  ClientToServerMessageSchema,
  EventEnvelopeSchema,
  WelcomeMessageSchema
} from '../src/contracts/events';

describe('shared contracts', () => {
  it('parses HELLO messages', () => {
    const parsed = ClientToServerMessageSchema.safeParse({
      type: 'HELLO',
      payload: {
        clientId: 'client-1',
        desiredRoomId: 'room-1'
      }
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects invalid HELLO payload', () => {
    const parsed = ClientToServerMessageSchema.safeParse({
      type: 'HELLO',
      payload: {
        clientId: ''
      }
    });

    expect(parsed.success).toBe(false);
  });

  it('validates welcome messages', () => {
    const parsed = WelcomeMessageSchema.safeParse({
      type: 'WELCOME',
      payload: {
        serverTime: new Date().toISOString()
      }
    });

    expect(parsed.success).toBe(true);
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
});
