import { prisma } from '../db/prisma.js';

const LOCAL_STRICT_DISABLED_VALUES = new Set(['0', 'false', 'off', 'no']);

const parseEnvBoolean = (rawValue: string | undefined): boolean => {
  if (rawValue === undefined) {
    return true;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (normalized.length === 0) {
    return true;
  }

  return !LOCAL_STRICT_DISABLED_VALUES.has(normalized);
};

export const isLocalStrictEnabled = (): boolean => {
  return parseEnvBoolean(process.env.LOCAL_STRICT);
};

export class LocalStrictAccessError extends Error {
  readonly code = 'LOCAL_MODE_DB_ACCESS_FORBIDDEN';
  readonly statusCode = 500;

  constructor(operation: string) {
    super(`LOCAL_MODE_DB_ACCESS_FORBIDDEN: ${operation}`);
    this.name = 'LocalStrictAccessError';
  }
}

export const assertCloudStateAccessForRoom = async (args: {
  roomId: string;
  operation: string;
}): Promise<void> => {
  if (!isLocalStrictEnabled()) {
    return;
  }

  const room = await prisma.room.findUnique({
    where: {
      id: args.roomId
    },
    select: {
      storageMode: true
    }
  });

  if (room?.storageMode === 'LOCAL') {
    throw new LocalStrictAccessError(args.operation);
  }
};
