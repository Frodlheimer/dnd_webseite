import type { BackgroundMeta } from '../model';
import type {
  BackgroundsWorkerFilterPayload,
  BackgroundsWorkerRequest,
  BackgroundsWorkerResponse
} from './messages';

type IndexResult = Extract<BackgroundsWorkerResponse, { type: 'INDEX_RESULT' }>['payload'];
type FilterResult = Extract<BackgroundsWorkerResponse, { type: 'FILTER_RESULT' }>['payload'];
type WorkerPayload = BackgroundsWorkerResponse['payload'];
type WorkerRequestWithoutId = Omit<Extract<BackgroundsWorkerRequest, { type: 'INDEX' }>, 'id'> | Omit<
  Extract<BackgroundsWorkerRequest, { type: 'FILTER' }>,
  'id'
>;

class BackgroundsWorkerClient {
  private worker: Worker | null = null;
  private requestId = 0;
  private resolvers = new Map<
    number,
    {
      resolve: (value: WorkerPayload) => void;
      reject: (reason?: unknown) => void;
    }
  >();

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./backgroundsWorker.ts', import.meta.url), {
        type: 'module'
      });
      this.worker.addEventListener('message', (event: MessageEvent<BackgroundsWorkerResponse>) => {
        const response = event.data;
        const resolver = this.resolvers.get(response.id);
        if (!resolver) {
          return;
        }
        this.resolvers.delete(response.id);
        if (response.type === 'ERROR') {
          resolver.reject(new Error(response.payload.message));
          return;
        }
        resolver.resolve(response.payload);
      });
    }
    return this.worker;
  }

  private postRequest<TPayload>(request: WorkerRequestWithoutId): Promise<TPayload> {
    const worker = this.getWorker();
    const id = ++this.requestId;
    return new Promise<TPayload>((resolve, reject) => {
      this.resolvers.set(id, {
        resolve: (value) => resolve(value as TPayload),
        reject
      });
      worker.postMessage({
        id,
        ...request
      });
    });
  }

  async getIndex(): Promise<IndexResult> {
    return await this.postRequest<IndexResult>({
      type: 'INDEX'
    });
  }

  async filter(payload: BackgroundsWorkerFilterPayload): Promise<FilterResult & { metas: BackgroundMeta[] }> {
    return await this.postRequest<FilterResult & { metas: BackgroundMeta[] }>({
      type: 'FILTER',
      payload
    });
  }
}

export const backgroundsWorkerClient = new BackgroundsWorkerClient();
