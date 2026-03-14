import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterAll, beforeAll, vi } from 'vitest';

export const installPublicFetchMock = () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', async (input: string | URL | Request) => {
      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : 'url' in input
              ? String(input.url)
              : String(input);

      const relativeUrl = rawUrl.replace(/^https?:\/\/[^/]+/i, '').replace(/^\//, '');
      const filePath = resolve(process.cwd(), 'public', relativeUrl);
      if (!existsSync(filePath)) {
        return {
          ok: false,
          status: 404,
          json: async () => null
        } as Response;
      }

      const raw = readFileSync(filePath, 'utf8');
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(raw)
      } as Response;
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });
};
