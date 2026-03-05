export const MAX_WS_JSON_BYTES = 256 * 1024;
export const RATE_LIMIT_MAX_MESSAGES = 150;
export const RATE_LIMIT_ASSET_CHUNK_MAX_MESSAGES = 1_200;
export const RATE_LIMIT_WINDOW_MS = 10_000;

export type WsRateLimitBucket = 'default' | 'asset_chunk';

export const isWsJsonMessageTooLarge = (rawMessage: string, maxBytes = MAX_WS_JSON_BYTES): boolean => {
  return Buffer.byteLength(rawMessage, 'utf8') > maxBytes;
};

export const createWsRateLimiter = (
  maxMessages = RATE_LIMIT_MAX_MESSAGES,
  maxAssetChunkMessages = RATE_LIMIT_ASSET_CHUNK_MAX_MESSAGES,
  windowMs = RATE_LIMIT_WINDOW_MS
): ((bucket?: WsRateLimitBucket) => boolean) => {
  let startedAt = Date.now();
  let defaultCount = 0;
  let assetChunkCount = 0;

  return (bucket = 'default') => {
    const now = Date.now();
    if (now - startedAt >= windowMs) {
      startedAt = now;
      defaultCount = 0;
      assetChunkCount = 0;
    }

    if (bucket === 'asset_chunk') {
      assetChunkCount += 1;
      return assetChunkCount <= maxAssetChunkMessages;
    }

    defaultCount += 1;
    return defaultCount <= maxMessages;
  };
};
