/// <reference lib="webworker" />

import { srdBitsetsIndex } from '../generated/srdBitsets';
import { srdPackIndex } from '../generated/srdIndex';
import { filterSrdWithIndex } from './filterSrd';
import type { SrdWorkerRequest, SrdWorkerResponse } from './messages';

const respond = (response: SrdWorkerResponse): void => {
  self.postMessage(response);
};

const handleRequest = (request: SrdWorkerRequest): void => {
  if (request.type === 'INDEX') {
    respond({
      id: request.id,
      type: 'INDEX_RESULT',
      payload: {
        category: request.payload.category,
        allTags: srdPackIndex.tagsByCategory[request.payload.category] ?? [],
        tagCounts: srdPackIndex.tagCountsByCategory[request.payload.category] ?? {}
      }
    });
    return;
  }

  if (request.type === 'FILTER') {
    const result = filterSrdWithIndex({
      category: request.payload.category,
      index: srdPackIndex,
      bitsets: srdBitsetsIndex,
      query: request.payload.query,
      selectedTags: request.payload.selectedTags,
      offset: request.payload.offset,
      limit: request.payload.limit,
      ...(request.payload.monsterTypeFilter ? { monsterTypeFilter: request.payload.monsterTypeFilter } : {}),
      ...(request.payload.monsterCrFilter ? { monsterCrFilter: request.payload.monsterCrFilter } : {}),
      ...(request.payload.monsterSizeFilter ? { monsterSizeFilter: request.payload.monsterSizeFilter } : {})
    });

    respond({
      id: request.id,
      type: 'FILTER_RESULT',
      payload: {
        ids: result.ids,
        total: result.total,
        metas: result.metas
      }
    });
    return;
  }
};

self.addEventListener('message', (event: MessageEvent<SrdWorkerRequest>) => {
  try {
    handleRequest(event.data);
  } catch (error) {
    respond({
      id: event.data.id,
      type: 'ERROR',
      payload: {
        message: error instanceof Error ? error.message : String(error)
      }
    });
  }
});
