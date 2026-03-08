import type { SrdCategory, SrdEntryMeta } from '../types';

export type SrdFilterPayload = {
  category: SrdCategory;
  query: string;
  selectedTags: string[];
  offset: number;
  limit: number;
  monsterTypeFilter?: string;
  monsterCrFilter?: string;
  monsterSizeFilter?: string;
};

export type SrdWorkerRequest =
  | {
      id: string;
      type: 'INDEX';
      payload: {
        category: SrdCategory;
      };
    }
  | {
      id: string;
      type: 'FILTER';
      payload: SrdFilterPayload;
    };

export type SrdWorkerResponse =
  | {
      id: string;
      type: 'INDEX_RESULT';
      payload: {
        category: SrdCategory;
        allTags: string[];
        tagCounts: Record<string, number>;
      };
    }
  | {
      id: string;
      type: 'FILTER_RESULT';
      payload: {
        ids: string[];
        total: number;
        metas: SrdEntryMeta[];
      };
    }
  | {
      id: string;
      type: 'ERROR';
      payload: {
        message: string;
      };
    };
