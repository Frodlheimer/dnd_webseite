import type { FeatEntryMeta } from '../types';
import type { FeatsTagGroups } from './filterFeats';

export type FeatsWorkerRequestWithoutId =
  | {
      type: 'INDEX';
    }
  | {
      type: 'FILTER';
      payload: {
        query: string;
        selectedTags: string[];
        raceFilter?: string;
        abilityFilter?: string;
        offset: number;
        limit: number;
      };
    };

export type FeatsWorkerRequest =
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
        raceFilter?: string;
        abilityFilter?: string;
        offset: number;
        limit: number;
      };
    };

export type FeatsWorkerResponse =
  | {
      id: number;
      type: 'INDEX_RESULT';
      payload: {
        allTags: string[];
        tagCounts: Record<string, number>;
        groups: FeatsTagGroups;
        raceOptions: Array<{
          id: string;
          label: string;
          count: number;
        }>;
        abilityOptions: Array<{
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
        metas: FeatEntryMeta[];
      };
    }
  | {
      id: number;
      type: 'ERROR';
      payload: {
        message: string;
      };
    };
