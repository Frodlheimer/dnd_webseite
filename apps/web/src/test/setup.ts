import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const TEST_ORIGIN = 'http://localhost';
const PUBLIC_ROOT = join(process.cwd(), 'public');
const nativeFetch = globalThis.fetch.bind(globalThis);

const mimeTypeByExtension: Record<string, string> = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const normalizeRequestUrl = (input: RequestInfo | URL): URL => {
  if (input instanceof URL) {
    return input;
  }
  if (typeof input === 'string') {
    return new URL(input, TEST_ORIGIN);
  }
  return new URL(input.url, TEST_ORIGIN);
};

const shouldServeFromPublic = (url: URL): boolean => {
  if (url.origin !== TEST_ORIGIN) {
    return false;
  }
  return (
    url.pathname.startsWith('/rules/') ||
    url.pathname.startsWith('/character_sheets/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/standard_fonts/')
  );
};

const resolvePublicFile = (pathname: string): string | null => {
  const segments = pathname
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== '.' && part !== '..');

  if (segments.length === 0) {
    return null;
  }

  return join(PUBLIC_ROOT, ...segments);
};

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const requestUrl = normalizeRequestUrl(input);

  if (shouldServeFromPublic(requestUrl)) {
    const filePath = resolvePublicFile(requestUrl.pathname);
    if (!filePath) {
      return new Response(null, { status: 404, statusText: 'Not Found' });
    }

    try {
      const payload = await readFile(filePath);
      const extension = extname(filePath).toLowerCase();
      return new Response(payload, {
        status: 200,
        headers: {
          'Content-Type': mimeTypeByExtension[extension] ?? 'application/octet-stream'
        }
      });
    } catch {
      return new Response(null, { status: 404, statusText: 'Not Found' });
    }
  }

  const forwarded = typeof input === 'string' && input.startsWith('/')
    ? requestUrl.toString()
    : input;
  return nativeFetch(forwarded, init);
};
