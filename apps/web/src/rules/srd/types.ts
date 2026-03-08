export type SrdCategory =
  | 'races'
  | 'equipment'
  | 'adventuring'
  | 'combat'
  | 'spellcasting'
  | 'conditions'
  | 'magic-items'
  | 'monsters';

export type SrdRulesChapterCategory = 'adventuring' | 'combat' | 'spellcasting';

export type SrdContentBlock =
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

export type SrdEntryExtra = {
  sourcePageStart?: number;
  sourcePageEnd?: number;
  rarity?: string;
  attunement?: string;
  size?: string;
  monsterType?: string;
  alignment?: string;
  armorClass?: string;
  hitPoints?: string;
  speed?: string;
  challengeRating?: string;
  challengeXp?: string;
  initiativeMod?: number;
  monsterAbilities?: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
    strMod: number;
    dexMod: number;
    conMod: number;
    intMod: number;
    wisMod: number;
    chaMod: number;
  };
  monsterTraits?: string[];
  monsterActions?: string[];
  abilityScoreIncrease?: string;
  raceSpeed?: string;
  raceSize?: string;
  raceDarkvision?: string;
  raceLanguages?: string;
  raceTraits?: string[];
  conditionRules?: string[];
  equipmentRows?: string[][];
  magicItemRarity?: string;
  magicItemRequiresAttunement?: boolean;
};

export type SrdEntryDetail = {
  id: string;
  title: string;
  category: SrdCategory;
  tags: string[];
  summary: string;
  sourcePageRange: string;
  contentBlocks: SrdContentBlock[];
  extra: SrdEntryExtra;
};

export type SrdEntryMeta = {
  id: string;
  title: string;
  category: SrdCategory;
  section: string;
  tags: string[];
  nameFolded: string;
  summary: string;
  detailUrl: string;
  sourcePageRange: string;
  extra: Pick<
    SrdEntryExtra,
    | 'sourcePageStart'
    | 'sourcePageEnd'
    | 'rarity'
    | 'size'
    | 'monsterType'
    | 'challengeRating'
    | 'initiativeMod'
    | 'armorClass'
    | 'hitPoints'
    | 'speed'
  >;
};

export type SrdCategoryBitsets = {
  allCount: number;
  tagToBitset: Record<string, number[]>;
};

export type SrdPackIndex = {
  version: 1;
  generatedAt: string;
  racesMeta: SrdEntryMeta[];
  equipmentMeta: SrdEntryMeta[];
  magicItemsMeta: SrdEntryMeta[];
  conditionsMeta: SrdEntryMeta[];
  rulesChaptersMeta: SrdEntryMeta[];
  monstersMeta: SrdEntryMeta[];
  byCategory: Record<SrdCategory, SrdEntryMeta[]>;
  tagsByCategory: Record<SrdCategory, string[]>;
  tagCountsByCategory: Record<SrdCategory, Record<string, number>>;
};

export type SrdBitsetsIndex = Record<SrdCategory, SrdCategoryBitsets>;
