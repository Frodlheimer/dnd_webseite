import { z } from 'zod';

export const EventEnvelopeSchema = z.object({
  type: z.string().min(1),
  payload: z.unknown(),
  ts: z.number().int().nonnegative().optional()
});

export const HelloMessageSchema = z.object({
  type: z.literal('HELLO'),
  payload: z.object({
    clientId: z.string().min(1),
    desiredRoomId: z.string().min(1).optional()
  })
});

export const WelcomeMessageSchema = z.object({
  type: z.literal('WELCOME'),
  payload: z.object({
    serverTime: z.string().datetime()
  })
});

export const ClientToServerMessageSchema = z.discriminatedUnion('type', [HelloMessageSchema]);
export const ServerToClientMessageSchema = z.discriminatedUnion('type', [WelcomeMessageSchema]);

export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
export type HelloMessage = z.infer<typeof HelloMessageSchema>;
export type WelcomeMessage = z.infer<typeof WelcomeMessageSchema>;
export type ClientToServerMessage = z.infer<typeof ClientToServerMessageSchema>;
export type ServerToClientMessage = z.infer<typeof ServerToClientMessageSchema>;
