import type { LineageEntryMeta } from '../types';
import type { LineagesTagGroups } from './filterLineages';

export type LineagesWorkerRequestWithoutId =
  | {
      type: 'INDEX';
    }
  | {
      type: 'FILTER';
      payload: {
        query: string;
        selectedTags: string[];
        groupFilter?: string;
        settingFilter?: string;
        offset: number;
        limit: number;
      };
    };

export type LineagesWorkerRequest =
  | {
      id: number;
      type: 'INDEX';
    }
  | {
      id: number;
      type: 'FILTER';
      payload: {
        query: string;
        selectedTags: string[];
        groupFilter?: string;
        settingFilter?: string;
        offset: number;
        limit: number;
      };
    };

export type LineagesWorkerResponse =
  | {
      id: number;
      type: 'INDEX_RESULT';
      payload: {
        allTags: string[];
        tagCounts: Record<string, number>;
        groups: LineagesTagGroups;
        groupOptions: Array<{
          id: string;
          label: string;
          count: number;
        }>;
        settingOptions: Array<{
          id: string;
          label: string;
          count: number;
        }>;
      };
    }
  | {
      id: number;
      type: 'FILTER_RESULT';
      payload: {
        ids: string[];
        total: number;
        metas: LineageEntryMeta[];
      };
    }
  | {
      id: number;
      type: 'ERROR';
      payload: {
        message: string;
      };
    };
