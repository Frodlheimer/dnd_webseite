/// <reference lib="webworker" />

import { lineagesPackIndex } from '../generated/lineagesIndex';
import { buildLineagesTagGroups, filterLineagesWithIndex } from './filterLineages';
import type { LineagesWorkerRequest, LineagesWorkerResponse } from './messages';

const metaById = new Map(lineagesPackIndex.entriesMeta.map((meta) => [meta.id, meta]));
const tagGroups = buildLineagesTagGroups(lineagesPackIndex.allTags);

const buildGroupOptions = (): Array<{ id: string; label: string; count: number }> => {
  const counts = new Map<string, { label: string; count: number }>();
  for (const meta of lineagesPackIndex.entriesMeta) {
    const existing = counts.get(meta.groupSlug);
    if (existing) {
      existing.count += 1;
      continue;
    }
    counts.set(meta.groupSlug, {
      label: meta.group,
      count: 1
    });
  }
  return [...counts.entries()]
    .map(([id, value]) => ({
      id,
      label: value.label,
      count: value.count
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
};

const buildSettingOptions = (): Array<{ id: string; label: string; count: number }> => {
  const counts = new Map<string, { label: string; count: number }>();
  for (const meta of lineagesPackIndex.entriesMeta) {
    const settingSlug = meta.settingSlug ?? 'none';
    const settingLabel = meta.setting ?? 'None';
    const existing = counts.get(settingSlug);
    if (existing) {
      existing.count += 1;
      continue;
    }
    counts.set(settingSlug, {
      label: settingLabel,
      count: 1
    });
  }
  return [...counts.entries()]
    .map(([id, value]) => ({
      id,
      label: value.label,
      count: value.count
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
};

const groupOptions = buildGroupOptions();
const settingOptions = buildSettingOptions();

const respond = (response: LineagesWorkerResponse): void => {
  self.postMessage(response);
};

const handleRequest = (request: LineagesWorkerRequest): void => {
  if (request.type === 'INDEX') {
    respond({
      id: request.id,
      type: 'INDEX_RESULT',
      payload: {
        allTags: lineagesPackIndex.allTags,
        tagCounts: lineagesPackIndex.tagCounts,
        groups: tagGroups,
        groupOptions,
        settingOptions
      }
    });
    return;
  }

  if (request.type === 'FILTER') {
    const filterArgs = {
      index: lineagesPackIndex,
      query: request.payload.query,
      selectedTags: request.payload.selectedTags,
      offset: request.payload.offset,
      limit: request.payload.limit,
      ...(request.payload.groupFilter ? { groupFilter: request.payload.groupFilter } : {}),
      ...(request.payload.settingFilter ? { settingFilter: request.payload.settingFilter } : {})
    };
    const result = filterLineagesWithIndex({
      ...filterArgs
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

self.addEventListener('message', (event: MessageEvent<LineagesWorkerRequest>) => {
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
