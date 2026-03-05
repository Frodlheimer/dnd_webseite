import { localSessionRepository } from './sessionRepository';

type HashUrlCache = {
  hash: string;
  url: string;
};

export class LocalAssetUrlResolver {
  private cache = new Map<string, HashUrlCache>();

  async resolve(hash: string): Promise<string | null> {
    const cached = this.cache.get(hash);
    if (cached) {
      return cached.url;
    }

    const blob = await localSessionRepository.getAsset(hash);
    if (!blob) {
      return null;
    }

    const url = URL.createObjectURL(blob);
    this.cache.set(hash, {
      hash,
      url
    });
    return url;
  }

  clear(): void {
    for (const value of this.cache.values()) {
      URL.revokeObjectURL(value.url);
    }

    this.cache.clear();
  }
}

export const localAssetUrlResolver = new LocalAssetUrlResolver();
