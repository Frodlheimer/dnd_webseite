export type LineageDocumentBlock =
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

export type LineageTrait = {
  label: string;
  labelKey: string;
  value: string;
};

export type LineageQuickFacts = {
  source?: string;
  abilityScoreIncrease?: string;
  creatureType?: string;
  size?: string;
  speed?: string;
  speedFeet?: number;
  languages?: string;
  darkvision?: string;
};

export type LineageEntryDetail = {
  id: string;
  slug: string;
  name: string;
  group: string;
  groupSlug: string;
  setting?: string;
  settingSlug?: string;
  tags: string[];
  summary: string;
  documentBlocks: LineageDocumentBlock[];
  traits: LineageTrait[];
  quickFacts: LineageQuickFacts;
};

export type LineageEntryMeta = {
  id: string;
  slug: string;
  name: string;
  group: string;
  groupSlug: string;
  setting?: string;
  settingSlug?: string;
  tags: string[];
  nameFolded: string;
  summary: string;
  detailUrl: string;
  quickFacts: LineageQuickFacts;
};

export type LineagesPackIndex = {
  version: 1;
  generatedAt: string;
  count: number;
  entriesMeta: LineageEntryMeta[];
  allTags: string[];
  tagCounts: Record<string, number>;
  tagBitsets: Record<string, number[]>;
};
