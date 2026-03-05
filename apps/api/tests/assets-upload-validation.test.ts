import { describe, expect, it } from 'vitest';

import { AssetValidationError, validateImageUpload } from '../src/assets/validation.js';

describe('asset image upload validation', () => {
  it('accepts PNG map uploads within size limit', () => {
    expect(() =>
      validateImageUpload({
        type: 'MAP',
        mime: 'image/png',
        size: 1024
      })
    ).not.toThrow();
  });

  it('accepts TOKEN_IMAGE uploads within size limit', () => {
    expect(() =>
      validateImageUpload({
        type: 'TOKEN_IMAGE',
        mime: 'image/jpeg',
        size: 2048
      })
    ).not.toThrow();
  });

  it('rejects unsupported mime types', () => {
    expect(() =>
      validateImageUpload({
        type: 'MAP',
        mime: 'application/pdf',
        size: 4096
      })
    ).toThrowError(AssetValidationError);
  });

  it('rejects unsupported asset type for this endpoint', () => {
    expect(() =>
      validateImageUpload({
        type: 'SOUND',
        mime: 'image/webp',
        size: 1024
      })
    ).toThrowError(AssetValidationError);
  });

  it('rejects files larger than 10MB', () => {
    expect(() =>
      validateImageUpload({
        type: 'MAP',
        mime: 'image/webp',
        size: 10 * 1024 * 1024 + 1
      })
    ).toThrowError(AssetValidationError);
  });
});
