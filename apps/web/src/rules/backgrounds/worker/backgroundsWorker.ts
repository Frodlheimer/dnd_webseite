import { backgroundsPackIndex } from '../generated/backgroundsIndex';
import { filterBackgroundsWithIndex } from './filterBackgrounds';
import type { BackgroundsWorkerRequest, BackgroundsWorkerResponse } from './messages';

const metaById = new Map(backgroundsPackIndex.backgroundsMeta.map((meta) => [meta.id, meta]));

const postResponse = (response: BackgroundsWorkerResponse): void => {
  self.postMessage(response);
};

self.addEventListener('message', (event: MessageEvent<BackgroundsWorkerRequest>) => {
  const request = event.data;
  const requestId = request.id;

  try {
    if (request.type === 'INDEX') {
      postResponse({
        id: requestId,
        type: 'INDEX_RESULT',
        payload: {
          filterOptions: backgroundsPackIndex.filterOptions,
          tagCounts: backgroundsPackIndex.tagCounts,
          total: backgroundsPackIndex.backgroundsMeta.length
        }
      });
      return;
    }

    if (request.type === 'FILTER') {
      const result = filterBackgroundsWithIndex({
        index: backgroundsPackIndex,
        ...request.payload
      });
      postResponse({
        id: requestId,
        type: 'FILTER_RESULT',
        payload: {
          ids: result.ids,
          total: result.total,
          metas: result.ids.map((id) => metaById.get(id)).filter((meta): meta is NonNullable<typeof meta> => !!meta)
        }
      });
      return;
    }

    postResponse({
      id: requestId,
      type: 'ERROR',
      payload: {
        message: `Unsupported request type: ${(request as { type?: string }).type ?? 'unknown'}`
      }
    });
  } catch (error) {
    postResponse({
      id: requestId,
      type: 'ERROR',
      payload: {
        message: error instanceof Error ? error.message : 'Background worker failed'
      }
    });
  }
});
