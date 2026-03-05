import type { SpellDetail, SpellMeta } from '../types';
import type { SpellTagGroups } from './filterSpells';

export type SpellsWorkerRequestWithoutId =
  | {
      type: 'FILTER';
      payload: {
        query: string;
        tags: string[];
        offset: number;
        limit: number;
      };
    }
  | {
      type: 'DETAIL';
      payload: {
        slug: string;
      };
    }
  | {
      type: 'INDEX';
    };

export type SpellsWorkerRequest =
  | {
      id: number;
      type: 'FILTER';
      payload: {
        query: string;
        tags: string[];
        offset: number;
        limit: number;
      };
    }
  | {
      id: number;
      type: 'DETAIL';
      payload: {
        slug: string;
      };
    }
  | {
      id: number;
      type: 'INDEX';
    };

export type SpellsWorkerResponse =
  | {
      id: number;
      type: 'FILTER_RESULT';
      payload: {
        total: number;
        items: SpellMeta[];
      };
    }
  | {
      id: number;
      type: 'DETAIL_RESULT';
      payload: {
        detail: SpellDetail | null;
      };
    }
  | {
      id: number;
      type: 'INDEX_RESULT';
      payload: {
        allTags: string[];
        tagCounts: Record<string, number>;
        groups: SpellTagGroups;
      };
    }
  | {
      id: number;
      type: 'ERROR';
      payload: {
        message: string;
      };
    };
