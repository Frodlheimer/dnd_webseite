import { runWsSmokeTest } from './ws-smoke-test.ts';

const DEFAULT_API_URL = 'http://localhost:3000';

const readTextBody = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch {
    return '<unreadable-body>';
  }
};

const run = async (): Promise<void> => {
  const apiUrl = process.env.API_URL ?? DEFAULT_API_URL;
  const response = await fetch(`${apiUrl}/health`);

  if (!response.ok) {
    const responseBody = await readTextBody(response);
    throw new Error(`GET /health failed (${response.status}): ${responseBody}`);
  }

  const payload = (await response.json()) as { ok?: unknown };

  if (payload.ok !== true) {
    throw new Error('GET /health returned payload without ok=true');
  }

  await runWsSmokeTest({ apiUrl });
};

run()
  .then(() => {
    console.log('OK');
    process.exitCode = 0;
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Health check failed: ${message}`);
    process.exitCode = 1;
  });
