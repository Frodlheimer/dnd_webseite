/// <reference lib="webworker" />

import { classesPackIndex } from '../generated/classesIndex';
import { buildClassesTagGroups, filterClassesWithIndex } from './filterClasses';
import type { ClassesWorkerRequest, ClassesWorkerResponse } from './messages';

const metaById = new Map(classesPackIndex.entriesMeta.map((meta) => [meta.id, meta]));

const postResponse = (response: ClassesWorkerResponse): void => {
  self.postMessage(response);
};

const handleRequest = (request: ClassesWorkerRequest): void => {
  try {
    if (request.type === 'INDEX') {
      const classOptions = classesPackIndex.entriesMeta
        .filter((entry) => entry.kind === 'CLASS')
        .map((entry) => ({
          id: entry.id,
          name: entry.name
        }))
        .sort((left, right) => left.name.localeCompare(right.name));

      postResponse({
        id: request.id,
        type: 'INDEX_RESULT',
        payload: {
          allTags: classesPackIndex.allTags,
          tagCounts: classesPackIndex.tagCounts,
          groups: buildClassesTagGroups(classesPackIndex.allTags),
          classOptions
        }
      });
      return;
    }

    const filterArgs: Parameters<typeof filterClassesWithIndex>[0] = {
      index: classesPackIndex,
      query: request.payload.query,
      selectedTags: request.payload.selectedTags,
      offset: request.payload.offset,
      limit: request.payload.limit
    };
    if (request.payload.kindFilter !== undefined) {
      filterArgs.kindFilter = request.payload.kindFilter;
    }
    if (request.payload.classFilter !== undefined) {
      filterArgs.classFilter = request.payload.classFilter;
    }

    const result = filterClassesWithIndex(filterArgs);

    postResponse({
      id: request.id,
      type: 'FILTER_RESULT',
      payload: {
        ids: result.ids,
        total: result.total,
        metas: result.ids
          .map((id) => metaById.get(id))
          .filter((meta): meta is NonNullable<typeof meta> => !!meta)
      }
    });
  } catch (error) {
    postResponse({
      id: request.id,
      type: 'ERROR',
      payload: {
        message: error instanceof Error ? error.message : String(error)
      }
    });
  }
};

self.addEventListener('message', (event: MessageEvent<ClassesWorkerRequest>) => {
  handleRequest(event.data);
});

export {};
