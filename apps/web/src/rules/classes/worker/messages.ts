import type { RulesEntryMeta } from '../types';
import type { ClassesTagGroups } from './filterClasses';

export type ClassesWorkerRequestWithoutId =
  | {
      type: 'INDEX';
    }
  | {
      type: 'FILTER';
      payload: {
        query: string;
        selectedTags: string[];
        kindFilter?: 'ALL' | 'CLASS' | 'SUBCLASS';
        classFilter?: string;
        offset: number;
        limit: number;
      };
    };

export type ClassesWorkerRequest =
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
        kindFilter?: 'ALL' | 'CLASS' | 'SUBCLASS';
        classFilter?: string;
        offset: number;
        limit: number;
      };
    };

export type ClassesWorkerResponse =
  | {
      id: number;
      type: 'INDEX_RESULT';
      payload: {
        allTags: string[];
        tagCounts: Record<string, number>;
        groups: ClassesTagGroups;
        classOptions: Array<{
          id: string;
          name: string;
        }>;
      };
    }
  | {
      id: number;
      type: 'FILTER_RESULT';
      payload: {
        ids: string[];
        total: number;
        metas: RulesEntryMeta[];
      };
    }
  | {
      id: number;
      type: 'ERROR';
      payload: {
        message: string;
      };
    };
