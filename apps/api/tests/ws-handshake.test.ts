import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { buildServer } from '../src/server.js';

describe('ws handshake', () => {
  const sockets: WebSocket[] = [];

  afterEach(() => {
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    }
  });

  it('responds with WELCOME after HELLO', async () => {
    const app = await buildServer();

    try {
      await app.listen({
        host: '127.0.0.1',
        port: 0
      });

      const address = app.server.address();

      if (!address || typeof address === 'string') {
        throw new Error('Server address is not available');
      }

      const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
      sockets.push(ws);

      await new Promise<void>((resolve, reject) => {
        ws.once('open', () => resolve());
        ws.once('error', reject);
      });

      const welcomePromise = new Promise<string>((resolve, reject) => {
        ws.once('message', (data) => resolve(data.toString()));
        ws.once('error', reject);
      });

      ws.send(
        JSON.stringify({
          type: 'HELLO',
          payload: {
            clientId: 'integration-client',
            desiredRoomId: 'integration-room'
          }
        })
      );

      const rawWelcome = await welcomePromise;
      const parsedWelcome = JSON.parse(rawWelcome) as {
        type: string;
        payload: {
          serverTime: string;
        };
      };

      expect(parsedWelcome.type).toBe('WELCOME');
      expect(new Date(parsedWelcome.payload.serverTime).toString()).not.toBe('Invalid Date');
    } finally {
      await app.close();
    }
  });
});
