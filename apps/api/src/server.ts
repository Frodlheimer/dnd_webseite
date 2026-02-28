import Fastify from 'fastify';
import websocket from '@fastify/websocket';

import { healthRoutes } from './routes/health.js';
import { wsRoutes } from './ws/index.js';

export const buildServer = async () => {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info'
    }
  });

  await app.register(websocket);
  await app.register(healthRoutes);
  await app.register(wsRoutes);

  return app;
};
