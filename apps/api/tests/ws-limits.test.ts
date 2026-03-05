import { afterEach, describe, expect, it, vi } from 'vitest';

import { createWsRateLimiter, isWsJsonMessageTooLarge } from '../src/ws/limits.js';

describe('ws limits', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('checks JSON payload size against configured limit', () => {
    expect(isWsJsonMessageTooLarge('abc', 10)).toBe(false);
    expect(isWsJsonMessageTooLarge('a'.repeat(11), 10)).toBe(true);
  });

  it('resets rate limit after the time window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const limiter = createWsRateLimiter(3, 1_000, 1_000);

    expect(limiter()).toBe(true);
    expect(limiter()).toBe(true);
    expect(limiter()).toBe(true);
    expect(limiter()).toBe(false);

    vi.advanceTimersByTime(1_000);

    expect(limiter()).toBe(true);
  });

  it('uses a higher bucket limit for asset chunks', () => {
    const limiter = createWsRateLimiter(2, 4, 1_000);

    expect(limiter()).toBe(true);
    expect(limiter()).toBe(true);
    expect(limiter()).toBe(false);

    expect(limiter('asset_chunk')).toBe(true);
    expect(limiter('asset_chunk')).toBe(true);
    expect(limiter('asset_chunk')).toBe(true);
    expect(limiter('asset_chunk')).toBe(true);
    expect(limiter('asset_chunk')).toBe(false);
  });
});
