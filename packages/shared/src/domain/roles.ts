import { z } from 'zod';

export const RoleSchema = z.enum(['DM', 'PLAYER', 'SPECTATOR']);

export type Role = z.infer<typeof RoleSchema>;
