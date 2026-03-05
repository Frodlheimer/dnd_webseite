import type { SpellDetail, SpellMeta } from '../types';
import type { SpellTagGroups } from './filterSpells';
import type {
  SpellsWorkerRequest,
  SpellsWorkerRequestWithoutId,
  SpellsWorkerResponse
} from './messages';

type IndexResult = {
  allTags: string[];
  tagCounts: Record<string, number>;
  groups: SpellTagGroups;
};

type FilterResult = {
  total: number;
  items: SpellMeta[];
};

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

  workerInstance = new Worker(new URL('./spellsWorker.ts', import.meta.url), {
    type: 'module'
  });

  workerInstance.addEventListener('message', (event: MessageEvent<SpellsWorkerResponse>) => {
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
  request: SpellsWorkerRequestWithoutId
): Promise<SpellsWorkerResponse> => {
  const worker = ensureWorker();

  const id = requestId;
  requestId += 1;

  const payload = {
    ...request,
    id
  } satisfies SpellsWorkerRequest;

  return await new Promise<SpellsWorkerResponse>((resolve, reject) => {
    pendingById.set(id, {
      resolve: (value) => resolve(value as SpellsWorkerResponse),
      reject
    });
    worker.postMessage(payload);
  });
};

export const spellsWorkerClient = {
  async getIndex(): Promise<IndexResult> {
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
    tags: string[];
    offset: number;
    limit: number;
  }): Promise<FilterResult> {
    const response = await postRequest({
      type: 'FILTER',
      payload: args
    });

    if (response.type !== 'FILTER_RESULT') {
      throw new Error(`Unexpected worker response: ${response.type}`);
    }

    return response.payload;
  },

  async detail(slug: string): Promise<SpellDetail | null> {
    const response = await postRequest({
      type: 'DETAIL',
      payload: {
        slug
      }
    });

    if (response.type !== 'DETAIL_RESULT') {
      throw new Error(`Unexpected worker response: ${response.type}`);
    }

    return response.payload.detail;
  }
};
