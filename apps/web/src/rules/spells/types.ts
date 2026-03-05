export type SpellFlagCode = 'R' | 'D' | 'DG' | 'DC' | 'T';

export type SpellDescriptionParagraphBlock = {
  type: 'paragraph';
  text: string;
};

export type SpellDescriptionTableBlock = {
  type: 'table';
  title: string;
  columns: string[];
  rows: string[][];
};

export type SpellDescriptionListBlock = {
  type: 'list';
  title: string;
  items: string[];
};

export type SpellDescriptionBlock =
  | SpellDescriptionParagraphBlock
  | SpellDescriptionTableBlock
  | SpellDescriptionListBlock;

export type SpellNameIndexEntry = {
  slug: string;
  name: string;
  nameNormalized: string;
};

export type SpellFlags = {
  ritual: boolean;
  dunamancy: boolean;
  dunamancyGraviturgy: boolean;
  dunamancyChronurgy: boolean;
  technomagic: boolean;
};

export type SpellMeta = {
  slug: string;
  name: string;
  source: string;
  level: number;
  levelLabel: string;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  components: string;
  classes: string[];
  flags: SpellFlags;
  flagCodes: SpellFlagCode[];
  tags: string[];
  nameNormalized: string;
};

export type SpellDetail = {
  slug: string;
  name: string;
  source: string;
  level: number;
  levelLabel: string;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  components: string;
  classes: string[];
  flags: SpellFlags;
  flagCodes: SpellFlagCode[];
  description: string;
  descriptionBlocks: SpellDescriptionBlock[];
  atHigherLevels: string | null;
};

export type SpellsPack = {
  generatedAt: string;
  count: number;
  metas: SpellMeta[];
  detailsBySlug: Record<string, SpellDetail>;
  allTags: string[];
  tagBitsets: Record<string, number[]>;
  tagCounts: Record<string, number>;
  tableRestoration?: {
    restored: string[];
    unresolvedCandidates: string[];
  };
};

export type SpellsListResult = {
  total: number;
  items: SpellMeta[];
};

