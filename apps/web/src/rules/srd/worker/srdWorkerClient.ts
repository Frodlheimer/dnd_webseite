import type { SrdCategory, SrdEntryMeta } from '../types';
import type { SrdFilterPayload, SrdWorkerRequest, SrdWorkerResponse } from './messages';

type PendingResolver = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

let workerInstance: Worker | null = null;
let requestCounter = 1;
const pendingById = new Map<string, PendingResolver>();

const nextRequestId = (): string => {
  const id = `srd-${requestCounter}`;
  requestCounter += 1;
  return id;
};

const ensureWorker = (): Worker => {
  if (workerInstance) {
    return workerInstance;
  }

  workerInstance = new Worker(new URL('./srdWorker.ts', import.meta.url), {
    type: 'module'
  });

  workerInstance.addEventListener('message', (event: MessageEvent<SrdWorkerResponse>) => {
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

const postRequest = async (request: Omit<SrdWorkerRequest, 'id'>): Promise<SrdWorkerResponse> => {
  const worker = ensureWorker();
  const id = nextRequestId();
  let payload: SrdWorkerRequest;
  if (request.type === 'INDEX') {
    payload = {
      id,
      type: 'INDEX',
      payload: request.payload
    };
  } else {
    payload = {
      id,
      type: 'FILTER',
      payload: request.payload as SrdFilterPayload
    };
  }

  return await new Promise<SrdWorkerResponse>((resolve, reject) => {
    pendingById.set(id, {
      resolve: (value) => resolve(value as SrdWorkerResponse),
      reject
    });
    worker.postMessage(payload);
  });
};

export const srdWorkerClient = {
  async getIndex(category: SrdCategory): Promise<{ allTags: string[]; tagCounts: Record<string, number> }> {
    const response = await postRequest({
      type: 'INDEX',
      payload: {
        category
      }
    });

    if (response.type !== 'INDEX_RESULT') {
      throw new Error(`Unexpected worker response: ${response.type}`);
    }
    return response.payload;
  },

  async filter(args: SrdFilterPayload): Promise<{ ids: string[]; total: number; metas: SrdEntryMeta[] }> {
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
