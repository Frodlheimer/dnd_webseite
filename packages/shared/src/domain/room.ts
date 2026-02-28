import { z } from 'zod';

import { RoleSchema } from './roles';

export const RoomIdSchema = z.string().min(1).max(64);

export const RoomSchema = z.object({
  id: RoomIdSchema,
  name: z.string().min(1).max(120),
  isPublic: z.boolean(),
  dmRole: RoleSchema.default('DM')
});

export type Room = z.infer<typeof RoomSchema>;
