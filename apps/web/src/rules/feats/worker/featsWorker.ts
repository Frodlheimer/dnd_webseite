/// <reference lib="webworker" />

import { featsPackIndex } from '../generated/featsIndex';
import { buildFeatsTagGroups, filterFeatsWithIndex } from './filterFeats';
import type { FeatsWorkerRequest, FeatsWorkerResponse } from './messages';

const metaById = new Map(featsPackIndex.entriesMeta.map((meta) => [meta.id, meta]));
const tagGroups = buildFeatsTagGroups(featsPackIndex.allTags);

const toTagLabel = (value: string): string => {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
};

const abilityLabelMap: Record<string, string> = {
  str: 'Strength (+)',
  dex: 'Dexterity (+)',
  con: 'Constitution (+)',
  int: 'Intelligence (+)',
  wis: 'Wisdom (+)',
  cha: 'Charisma (+)',
  all: 'Any ability (+)'
};

const buildRaceOptions = (): Array<{ id: string; label: string; count: number }> => {
  return tagGroups.race
    .map((tag) => {
      const id = tag.replace('race:', '').trim();
      return {
        id,
        label: toTagLabel(id),
        count: featsPackIndex.tagCounts[tag] ?? 0
      };
    })
    .filter((entry) => entry.id.length > 0)
    .sort((left, right) => left.label.localeCompare(right.label));
};

const buildAbilityOptions = (): Array<{ id: string; label: string; count: number }> => {
  return tagGroups.ability
    .map((tag) => {
      const id = tag.replace('ability:', '').trim();
      return {
        id,
        label: abilityLabelMap[id] ?? toTagLabel(id),
        count: featsPackIndex.tagCounts[tag] ?? 0
      };
    })
    .filter((entry) => entry.id.length > 0)
    .sort((left, right) => left.label.localeCompare(right.label));
};

const raceOptions = buildRaceOptions();
const abilityOptions = buildAbilityOptions();

const respond = (response: FeatsWorkerResponse): void => {
  self.postMessage(response);
};

const handleRequest = (request: FeatsWorkerRequest): void => {
  if (request.type === 'INDEX') {
    respond({
      id: request.id,
      type: 'INDEX_RESULT',
      payload: {
        allTags: featsPackIndex.allTags,
        tagCounts: featsPackIndex.tagCounts,
        groups: tagGroups,
        raceOptions,
        abilityOptions
      }
    });
    return;
  }

  if (request.type === 'FILTER') {
    const result = filterFeatsWithIndex({
      index: featsPackIndex,
      query: request.payload.query,
      selectedTags: request.payload.selectedTags,
      offset: request.payload.offset,
      limit: request.payload.limit,
      ...(request.payload.raceFilter ? { raceFilter: request.payload.raceFilter } : {}),
      ...(request.payload.abilityFilter ? { abilityFilter: request.payload.abilityFilter } : {})
    });

    respond({
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
    return;
  }
};

self.addEventListener('message', (event: MessageEvent<FeatsWorkerRequest>) => {
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
