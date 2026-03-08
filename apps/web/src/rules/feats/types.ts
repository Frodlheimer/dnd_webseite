export type FeatDocumentBlock =
  | {
      type: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      text: string;
    }
  | {
      type: 'p';
      text: string;
    }
  | {
      type: 'ul' | 'ol';
      items: string[];
    }
  | {
      type: 'table';
      rows: string[][];
    }
  | {
      type: 'pre';
      lines: string[];
    }
  | {
      type: 'hr';
    };

export type FeatAbility = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA' | 'ALL';

export type FeatAbilityIncrease = {
  amount: number;
  mode: 'NONE' | 'FIXED' | 'CHOICE';
  abilities: FeatAbility[];
  description: string;
};

export type FeatQuickFacts = {
  source?: string;
  prerequisite?: string;
  racePrerequisites: string[];
  abilityIncrease: FeatAbilityIncrease;
};

export type FeatEntryDetail = {
  id: string;
  slug: string;
  name: string;
  group: string;
  collection?: string;
  tags: string[];
  summary: string;
  documentBlocks: FeatDocumentBlock[];
  quickFacts: FeatQuickFacts;
  highlights: string[];
};

export type FeatEntryMeta = {
  id: string;
  slug: string;
  name: string;
  group: string;
  collection?: string;
  tags: string[];
  nameFolded: string;
  summary: string;
  detailUrl: string;
  quickFacts: FeatQuickFacts;
};

export type FeatsPackIndex = {
  version: 1;
  generatedAt: string;
  count: number;
  entriesMeta: FeatEntryMeta[];
  allTags: string[];
  tagCounts: Record<string, number>;
  tagBitsets: Record<string, number[]>;
};
