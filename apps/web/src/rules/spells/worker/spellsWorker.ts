/// <reference lib="webworker" />

import { spellsPack } from '../generated/spellsPack';
import { buildTagGroups, filterSpellsWithPack, findSpellDetailBySlug } from './filterSpells';
import type { SpellsWorkerRequest, SpellsWorkerResponse } from './messages';

const postResponse = (response: SpellsWorkerResponse): void => {
  self.postMessage(response);
};

const handleRequest = (request: SpellsWorkerRequest): void => {
  try {
    if (request.type === 'FILTER') {
      const result = filterSpellsWithPack({
        pack: spellsPack,
        query: request.payload.query,
        tags: request.payload.tags,
        ...(request.payload.tagGroups ? { tagGroups: request.payload.tagGroups } : {}),
        offset: request.payload.offset,
        limit: request.payload.limit
      });

      postResponse({
        id: request.id,
        type: 'FILTER_RESULT',
        payload: result
      });
      return;
    }

    if (request.type === 'DETAIL') {
      const detail = findSpellDetailBySlug(spellsPack, request.payload.slug);
      postResponse({
        id: request.id,
        type: 'DETAIL_RESULT',
        payload: {
          detail
        }
      });
      return;
    }

    const groups = buildTagGroups(spellsPack.allTags);
    postResponse({
      id: request.id,
      type: 'INDEX_RESULT',
      payload: {
        allTags: spellsPack.allTags,
        tagCounts: spellsPack.tagCounts,
        groups
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

self.addEventListener('message', (event: MessageEvent<SpellsWorkerRequest>) => {
  handleRequest(event.data);
});

export {};
