import type { RulesEntryMeta } from '../types';
import type { ClassesTagGroups } from './filterClasses';
import type { ClassesWorkerRequest, ClassesWorkerRequestWithoutId, ClassesWorkerResponse } from './messages';

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

  workerInstance = new Worker(new URL('./classesWorker.ts', import.meta.url), {
    type: 'module'
  });

  workerInstance.addEventListener('message', (event: MessageEvent<ClassesWorkerResponse>) => {
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
  request: ClassesWorkerRequestWithoutId
): Promise<ClassesWorkerResponse> => {
  const worker = ensureWorker();

  const id = requestId;
  requestId += 1;

  const payload = {
    ...request,
    id
  } satisfies ClassesWorkerRequest;

  return await new Promise<ClassesWorkerResponse>((resolve, reject) => {
    pendingById.set(id, {
      resolve: (value) => resolve(value as ClassesWorkerResponse),
      reject
    });
    worker.postMessage(payload);
  });
};

export const classesWorkerClient = {
  async getIndex(): Promise<{
    allTags: string[];
    tagCounts: Record<string, number>;
    groups: ClassesTagGroups;
    classOptions: Array<{
      id: string;
      name: string;
    }>;
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
    kindFilter?: 'ALL' | 'CLASS' | 'SUBCLASS';
    classFilter?: string;
    offset: number;
    limit: number;
  }): Promise<{
    ids: string[];
    total: number;
    metas: RulesEntryMeta[];
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
