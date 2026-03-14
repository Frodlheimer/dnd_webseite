import type { RaceEntryMeta } from '../model';

export type RacesWorkerFilterPayload = {
  query: string;
  sizeFilter?: string;
  speedFilter?: string;
  darkvisionFilter?: string;
  languageFilter?: string;
  requireToolChoices?: boolean;
  requireWeaponProficiencies?: boolean;
  requireResistances?: boolean;
  offset: number;
  limit: number;
};

export type RacesWorkerRequestWithoutId =
  | {
      type: 'INDEX';
    }
  | {
      type: 'FILTER';
      payload: RacesWorkerFilterPayload;
    };

export type RacesWorkerRequest =
  | {
      id: number;
      type: 'INDEX';
    }
  | {
      id: number;
      type: 'FILTER';
      payload: RacesWorkerFilterPayload;
    };

export type RacesWorkerResponse =
  | {
      id: number;
      type: 'INDEX_RESULT';
      payload: {
        filterOptions: {
          sizes: string[];
          speeds: number[];
          darkvisionValues: number[];
          languages: string[];
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
        metas: RaceEntryMeta[];
      };
    }
  | {
      id: number;
      type: 'ERROR';
      payload: {
        message: string;
      };
    };
