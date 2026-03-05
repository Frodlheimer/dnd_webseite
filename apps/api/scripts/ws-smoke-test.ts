import { pathToFileURL } from 'node:url';

import { WebSocket } from 'ws';

type SmokeOptions = {
  apiUrl?: string;
  wsUrl?: string;
  timeoutMs?: number;
};

const DEFAULT_API_URL = 'http://localhost:3000';
const DEFAULT_WS_URL = 'ws://localhost:3000/ws';
const DEFAULT_TIMEOUT_MS = 10_000;

const readTextBody = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch {
    return '<unreadable-body>';
  }
};

const createRoomForSmoke = async (apiUrl: string): Promise<string> => {
  const clientId = `ws-smoke-create-${Date.now()}`;
  const response = await fetch(`${apiUrl}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'WS Smoke Test',
      displayName: 'Smoke Bot',
      clientId,
      storageMode: 'CLOUD'
    })
  });

  if (!response.ok) {
    const responseBody = await readTextBody(response);
    throw new Error(`POST /rooms failed (${response.status}): ${responseBody}`);
  }

  const payload = (await response.json()) as { roomId?: unknown };

  if (typeof payload.roomId !== 'string' || payload.roomId.length === 0) {
    throw new Error('POST /rooms response is missing roomId');
  }

  return payload.roomId;
};

const waitForWelcome = async (wsUrl: string, roomId: string, timeoutMs: number): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    let settled = false;

    const finish = (error?: Error): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutHandle);

      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }

      if (error) {
        reject(error);
        return;
      }

      resolve();
    };

    const timeoutHandle = setTimeout(() => {
      finish(new Error(`Timed out after ${timeoutMs}ms waiting for WELCOME`));
    }, timeoutMs);

    socket.on('open', () => {
      const helloMessage = {
        type: 'HELLO',
        payload: {
          clientId: `ws-smoke-hello-${Date.now()}`,
          displayName: 'Smoke Bot',
          roomId
        }
      };

      socket.send(JSON.stringify(helloMessage));
    });

    socket.on('message', (rawData) => {
      const messageText = typeof rawData === 'string' ? rawData : rawData.toString('utf8');

      let parsedMessage: { type?: unknown; payload?: unknown };
      try {
        parsedMessage = JSON.parse(messageText) as { type?: unknown; payload?: unknown };
      } catch {
        finish(new Error(`WS returned non-JSON message: ${messageText}`));
        return;
      }

      if (parsedMessage.type === 'WELCOME') {
        finish();
        return;
      }

      if (parsedMessage.type === 'ERROR') {
        const payload = parsedMessage.payload as { code?: unknown; message?: unknown } | undefined;
        const code = typeof payload?.code === 'string' ? payload.code : 'UNKNOWN';
        const message = typeof payload?.message === 'string' ? payload.message : 'No message';

        finish(new Error(`WS ERROR ${code}: ${message}`));
      }
    });

    socket.on('close', (code, reason) => {
      if (settled) {
        return;
      }

      const closeReason = reason.toString('utf8') || 'n/a';
      finish(new Error(`WS closed before WELCOME (code=${code}, reason=${closeReason})`));
    });

    socket.on('error', (error) => {
      finish(error);
    });
  });
};

export const runWsSmokeTest = async (options: SmokeOptions = {}): Promise<void> => {
  const apiUrl = options.apiUrl ?? process.env.API_URL ?? DEFAULT_API_URL;
  const wsUrl = options.wsUrl ?? process.env.WS_URL ?? DEFAULT_WS_URL;
  const timeoutMs = options.timeoutMs ?? Number(process.env.SMOKE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  const roomId = await createRoomForSmoke(apiUrl);
  await waitForWelcome(wsUrl, roomId, timeoutMs);
};

const isDirectExecution =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  runWsSmokeTest()
    .then(() => {
      console.log('OK');
      process.exitCode = 0;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`WS smoke test failed: ${message}`);
      process.exitCode = 1;
    });
}
