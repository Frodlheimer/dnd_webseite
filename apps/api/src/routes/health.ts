import type { FastifyPluginAsync } from 'fastify';

import { HealthResponseSchema } from '@dnd-vtt/shared';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => {
    return HealthResponseSchema.parse({
      ok: true,
      version: process.env.npm_package_version ?? '0.1.0',
      time: new Date().toISOString()
    });
  });
};
