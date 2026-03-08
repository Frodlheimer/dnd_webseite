import type { FeatEntryMeta } from '../types';
import type { FeatsTagGroups } from './filterFeats';
import type {
  FeatsWorkerRequest,
  FeatsWorkerRequestWithoutId,
  FeatsWorkerResponse
} from './messages';

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

  workerInstance = new Worker(new URL('./featsWorker.ts', import.meta.url), {
    type: 'module'
  });

  workerInstance.addEventListener('message', (event: MessageEvent<FeatsWorkerResponse>) => {
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

const postRequest = async (request: FeatsWorkerRequestWithoutId): Promise<FeatsWorkerResponse> => {
  const worker = ensureWorker();

  const id = requestId;
  requestId += 1;

  const payload = {
    ...request,
    id
  } satisfies FeatsWorkerRequest;

  return await new Promise<FeatsWorkerResponse>((resolve, reject) => {
    pendingById.set(id, {
      resolve: (value) => resolve(value as FeatsWorkerResponse),
      reject
    });
    worker.postMessage(payload);
  });
};

export const featsWorkerClient = {
  async getIndex(): Promise<{
    allTags: string[];
    tagCounts: Record<string, number>;
    groups: FeatsTagGroups;
    raceOptions: Array<{ id: string; label: string; count: number }>;
    abilityOptions: Array<{ id: string; label: string; count: number }>;
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
    selectedTags: string[];
    raceFilter?: string;
    abilityFilter?: string;
    offset: number;
    limit: number;
  }): Promise<{
    ids: string[];
    total: number;
    metas: FeatEntryMeta[];
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
