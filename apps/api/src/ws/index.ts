import type { FastifyPluginAsync } from 'fastify';

import { createWelcomeMessage, parseClientMessage } from './protocol.js';

const rawDataToString = (rawData: unknown): string => {
  if (typeof rawData === 'string') {
    return rawData;
  }

  if (rawData instanceof Buffer) {
    return rawData.toString('utf8');
  }

  if (Array.isArray(rawData) && rawData.every((item) => item instanceof Buffer)) {
    return Buffer.concat(rawData).toString('utf8');
  }

  if (rawData instanceof ArrayBuffer) {
    return Buffer.from(rawData).toString('utf8');
  }

  if (ArrayBuffer.isView(rawData)) {
    return Buffer.from(rawData.buffer).toString('utf8');
  }

  return '';
};

export const wsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/ws', { websocket: true }, (socket) => {
    // First client payload must match HELLO from shared contracts.
    socket.once('message', (rawData: unknown) => {
      const parsedMessage = parseClientMessage(rawDataToString(rawData));

      if (!parsedMessage || parsedMessage.type !== 'HELLO') {
        socket.close(1008, 'Expected HELLO as first message');
        return;
      }

      const welcomeMessage = createWelcomeMessage();
      socket.send(JSON.stringify(welcomeMessage));
    });
  });
};
