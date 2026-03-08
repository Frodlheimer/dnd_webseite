import type { LineageEntryMeta } from '../types';
import type { LineagesWorkerRequest, LineagesWorkerRequestWithoutId, LineagesWorkerResponse } from './messages';
import type { LineagesTagGroups } from './filterLineages';

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

  workerInstance = new Worker(new URL('./lineagesWorker.ts', import.meta.url), {
    type: 'module'
  });

  workerInstance.addEventListener('message', (event: MessageEvent<LineagesWorkerResponse>) => {
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

const postRequest = async (
  request: LineagesWorkerRequestWithoutId
): Promise<LineagesWorkerResponse> => {
  const worker = ensureWorker();

  const id = requestId;
  requestId += 1;

  const payload = {
    ...request,
    id
  } satisfies LineagesWorkerRequest;

  return await new Promise<LineagesWorkerResponse>((resolve, reject) => {
    pendingById.set(id, {
      resolve: (value) => resolve(value as LineagesWorkerResponse),
      reject
    });
    worker.postMessage(payload);
  });
};

export const lineagesWorkerClient = {
  async getIndex(): Promise<{
    allTags: string[];
    tagCounts: Record<string, number>;
    groups: LineagesTagGroups;
    groupOptions: Array<{ id: string; label: string; count: number }>;
    settingOptions: Array<{ id: string; label: string; count: number }>;
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
    groupFilter?: string;
    settingFilter?: string;
    offset: number;
    limit: number;
  }): Promise<{
    ids: string[];
    total: number;
    metas: LineageEntryMeta[];
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
