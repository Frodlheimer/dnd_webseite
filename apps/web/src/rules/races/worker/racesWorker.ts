import { racesPackIndex } from '../generated/racesIndex';
import { filterRacesWithIndex } from './filterRaces';
import type { RacesWorkerRequest, RacesWorkerResponse } from './messages';

const metaById = new Map(racesPackIndex.racesMeta.map((meta) => [meta.id, meta]));

const postResponse = (response: RacesWorkerResponse): void => {
  self.postMessage(response);
};

self.addEventListener('message', (event: MessageEvent<RacesWorkerRequest>) => {
  const request = event.data;
  const requestId = request.id;

  try {
    if (request.type === 'INDEX') {
      postResponse({
        id: requestId,
        type: 'INDEX_RESULT',
        payload: {
          filterOptions: racesPackIndex.filterOptions,
          tagCounts: racesPackIndex.tagCounts,
          total: racesPackIndex.racesMeta.length
        }
      });
      return;
    }

    if (request.type === 'FILTER') {
      const result = filterRacesWithIndex({
        index: racesPackIndex,
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
        message: error instanceof Error ? error.message : 'Race worker failed'
      }
    });
  }
});
