import type { RaceEntryMeta } from '../model';
import type { RacesWorkerRequest, RacesWorkerRequestWithoutId, RacesWorkerResponse } from './messages';

type PendingResolver = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

let workerInstance: Worker | null = null;
let requestId = 1;
const pendingById = new Map<number, PendingResolver>();

const ensureWorker = (): Worker => {
  if (workerInstance) {
    return workerInstance;
  }

  workerInstance = new Worker(new URL('./racesWorker.ts', import.meta.url), {
    type: 'module'
  });

  workerInstance.addEventListener('message', (event: MessageEvent<RacesWorkerResponse>) => {
    const response = event.data;
    const pending = pendingById.get(response.id);
    if (!pending) {
      return;
    }

    pendingById.delete(response.id);
    if (response.type === 'ERROR') {
      pending.reject(new Error(response.payload.message));
      return;
    }

    pending.resolve(response);
  });

  workerInstance.addEventListener('error', (event) => {
    for (const [id, pending] of pendingById) {
      pendingById.delete(id);
      pending.reject(event.error ?? new Error(event.message));
    }
  });

  return workerInstance;
};

const postRequest = async (request: RacesWorkerRequestWithoutId): Promise<RacesWorkerResponse> => {
  const worker = ensureWorker();
  const id = requestId;
  requestId += 1;

  const payload = {
    ...request,
    id
  } satisfies RacesWorkerRequest;

  return await new Promise<RacesWorkerResponse>((resolve, reject) => {
    pendingById.set(id, {
      resolve: (value) => resolve(value as RacesWorkerResponse),
      reject
    });
    worker.postMessage(payload);
  });
};

export const racesWorkerClient = {
  async getIndex(): Promise<{
    filterOptions: {
      sizes: string[];
      speeds: number[];
      darkvisionValues: number[];
      languages: string[];
    };
    tagCounts: Record<string, number>;
    total: number;
  }> {
    const response = await postRequest({
      type: 'INDEX'
    });

    if (response.type !== 'INDEX_RESULT') {
      throw new Error(`Unexpected worker response: ${response.type}`);
    }

    return response.payload;
  },

  async filter(args: {
    query: string;
    sizeFilter?: string;
    speedFilter?: string;
    darkvisionFilter?: string;
    languageFilter?: string;
    requireToolChoices?: boolean;
    requireWeaponProficiencies?: boolean;
    requireResistances?: boolean;
    offset: number;
    limit: number;
  }): Promise<{
    ids: string[];
    total: number;
    metas: RaceEntryMeta[];
  }> {
    const response = await postRequest({
      type: 'FILTER',
      payload: args
    });

    if (response.type !== 'FILTER_RESULT') {
      throw new Error(`Unexpected worker response: ${response.type}`);
    }

    return response.payload;
  }
};
