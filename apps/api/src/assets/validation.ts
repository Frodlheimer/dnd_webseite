import type { AssetType } from '@dnd-vtt/shared';

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export class AssetValidationError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AssetValidationError';
  }
}

export const validateImageUpload = (args: {
  type: AssetType;
  mime: string;
  size: number;
}): void => {
  if (args.type !== 'MAP' && args.type !== 'TOKEN_IMAGE') {
    throw new AssetValidationError('UNSUPPORTED_ASSET_TYPE', 400, 'Only MAP and TOKEN_IMAGE uploads are supported');
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(args.mime)) {
    throw new AssetValidationError('UNSUPPORTED_MIME', 415, `Unsupported file type: ${args.mime}`);
  }

  if (!Number.isFinite(args.size) || args.size <= 0) {
    throw new AssetValidationError('INVALID_FILE_SIZE', 400, 'Uploaded file is empty');
  }

  if (args.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new AssetValidationError(
      'FILE_TOO_LARGE',
      413,
      `Image file exceeds ${MAX_IMAGE_UPLOAD_BYTES} bytes limit`
    );
  }
};
