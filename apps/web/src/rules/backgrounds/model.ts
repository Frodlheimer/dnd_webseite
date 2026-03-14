export type RuleBlock =
  | {
      type: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      text: string;
    }
  | {
      type: 'p';
      text: string;
    }
  | {
      type: 'list';
      ordered: boolean;
      items: string[];
    }
  | {
      type: 'table';
      caption?: string;
      headers?: string[];
      rows: string[][];
    };

export type BackgroundItemGrant = {
  name: string;
  quantity?: number | null;
  notes?: string | null;
};

export type BackgroundItemChoiceGroup = {
  choose: number;
  options: BackgroundItemGrant[];
  label?: string | null;
};

export type BackgroundSection = {
  id: string;
  title: string;
  kind:
    | 'skills'
    | 'tools'
    | 'languages'
    | 'equipment'
    | 'feature'
    | 'personality'
    | 'variant'
    | 'other';
  text?: string;
};

export type BackgroundStructuredData = {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  categories: string[];
  source: 'wikidot-local-export';
  tags: string[];
  summary?: string;
  grants: {
    skills: string[];
    tools: string[];
    languages: string[];
    skillChoices?: {
      choose: number;
      from: string[];
    } | null;
    toolChoices?: {
      choose: number;
      from: string[];
    } | null;
    languageChoices?: {
      choose: number;
      from: string[];
    } | null;
  };
  equipment: {
    fixedItems: BackgroundItemGrant[];
    choiceGroups: BackgroundItemChoiceGroup[];
    coins?: {
      cp?: number;
      sp?: number;
      ep?: number;
      gp?: number;
      pp?: number;
    } | null;
    rawText?: string | null;
  };
  feature: {
    name?: string | null;
    summary?: string | null;
    rulesText?: string | null;
  };
  personality?: {
    traits?: string[];
    ideals?: string[];
    bonds?: string[];
    flaws?: string[];
  };
  structuredSections: BackgroundSection[];
  documentBlocks: RuleBlock[];
};

export type BackgroundMeta = {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  categories: string[];
  source: 'wikidot-local-export';
  tags: string[];
  summary?: string;
  grants: {
    skills: string[];
    tools: string[];
    languages: string[];
    hasChoices: boolean;
    hasEquipment: boolean;
    hasFeature: boolean;
  };
  detailUrl: string;
  nameFolded: string;
  aliasFolded: string[];
  searchTextFolded: string;
};

export type BackgroundsPackIndex = {
  version: 1;
  generatedAt: string;
  backgroundsMeta: BackgroundMeta[];
  allTags: string[];
  tagCounts: Record<string, number>;
  tagBitsets: Record<string, number[]>;
  filterOptions: {
    categories: string[];
  };
};

export type BuilderBackgroundLookupEntry = {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  categories: string[];
  summary: string;
  grants: BackgroundStructuredData['grants'];
  featureName: string | null;
  equipmentSummary: string[];
  detailUrl: string;
};

export type BackgroundsLookup = {
  byId: Record<string, BuilderBackgroundLookupEntry>;
  aliasToId: Record<string, string>;
  categoryGroups: Record<string, string[]>;
};
