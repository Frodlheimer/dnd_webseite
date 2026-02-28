import { z } from 'zod';

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  version: z.string().min(1),
  time: z.string().datetime()
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
