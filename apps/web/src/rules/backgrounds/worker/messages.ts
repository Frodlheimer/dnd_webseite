import type { BackgroundMeta } from '../model';

export type BackgroundsWorkerFilterPayload = {
  query: string;
  categoryFilter?: string;
  requireSkillProficiency?: boolean;
  requireToolProficiency?: boolean;
  requireLanguage?: boolean;
  requireChoices?: boolean;
  requireFeature?: boolean;
  requireEquipment?: boolean;
  offset: number;
  limit: number;
};

export type BackgroundsWorkerRequest =
  | {
      id: number;
      type: 'INDEX';
    }
  | {
      id: number;
      type: 'FILTER';
      payload: BackgroundsWorkerFilterPayload;
    };

export type BackgroundsWorkerResponse =
  | {
      id: number;
      type: 'INDEX_RESULT';
      payload: {
        filterOptions: {
          categories: string[];
        };
        tagCounts: Record<string, number>;
        total: number;
      };
    }
  | {
      id: number;
      type: 'FILTER_RESULT';
      payload: {
        ids: string[];
        total: number;
        metas: BackgroundMeta[];
      };
    }
  | {
      id: number;
      type: 'ERROR';
      payload: {
        message: string;
      };
    };
