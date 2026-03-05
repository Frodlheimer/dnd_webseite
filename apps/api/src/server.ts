import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';

import { MAX_IMAGE_UPLOAD_BYTES } from './assets/validation.js';
import { assetRoutes } from './routes/assets.js';
import { healthRoutes } from './routes/health.js';
import { roomRoutes } from './routes/rooms.js';
import { wsRoutes } from './ws/index.js';

export const buildServer = async () => {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info'
    }
  });

  await app.register(cors, {
    origin: true
  });
  await app.register(multipart, {
    limits: {
      fileSize: MAX_IMAGE_UPLOAD_BYTES,
      files: 1
    }
  });
  await app.register(websocket);
  await app.register(healthRoutes);
  await app.register(roomRoutes);
  await app.register(assetRoutes);
  await app.register(wsRoutes);

  return app;
};
