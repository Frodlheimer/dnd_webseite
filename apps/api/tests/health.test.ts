import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildServer } from '../src/server.js';

describe('health route', () => {
  const appPromise = buildServer();

  beforeAll(async () => {
    const app = await appPromise;
    await app.ready();
  });

  afterAll(async () => {
    const app = await appPromise;
    await app.close();
  });

  it('returns service metadata', async () => {
    const app = await appPromise;
    const response = await app.inject({
      method: 'GET',
      path: '/health'
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json();
    expect(payload.ok).toBe(true);
    expect(typeof payload.version).toBe('string');
    expect(typeof payload.time).toBe('string');
  });
});
