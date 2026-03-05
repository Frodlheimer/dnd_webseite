export type RulesEntryKind = 'CLASS' | 'SUBCLASS';

export type RulesDocumentBlock =
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

export type ProgressionTable = {
  title?: string;
  columns: string[];
  rows: string[][];
};

export type GrantedSpellRef = {
  name: string;
  slug?: string;
};

export type ExtractedRulesData = {
  hitDie?: string;
  primaryAbility?: string;
  savingThrows?: string[];
  armorWeaponProficiencies?: string;
  spellcasting?: {
    casterType?: 'FULL' | 'HALF' | 'THIRD' | 'PACT' | 'NONE';
    spellSlotsByLevel?: number[][];
    cantripsKnownByLevel?: number[];
    spellsKnownByLevel?: number[];
    preparedFormula?: string;
  };
  progressionTables: ProgressionTable[];
  progressionByLevel: Record<number, Record<string, string | number>>;
  featuresByLevel: Record<number, string[]>;
  subclassLevelStart?: number;
  grantedSpells: Record<number, string[]>;
  grantedSpellRefs: Record<number, GrantedSpellRef[]>;
};

export type RulesEntryDetail = {
  id: string;
  kind: RulesEntryKind;
  name: string;
  classId: string;
  parentClassId?: string;
  tags: string[];
  summary: string;
  documentBlocks: RulesDocumentBlock[];
  extracted: ExtractedRulesData;
};

export type RulesEntryMeta = {
  id: string;
  kind: RulesEntryKind;
  name: string;
  classId: string;
  parentClassId?: string;
  tags: string[];
  nameFolded: string;
  summary: string;
  detailUrl: string;
  quick: {
    casterType?: 'FULL' | 'HALF' | 'THIRD' | 'PACT' | 'NONE';
    spellSlotsByLevel?: number[][];
    featuresByLevel?: Record<number, string[]>;
    subclassLevelStart?: number;
    grantedSpellRefsByLevel?: Record<number, GrantedSpellRef[]>;
  };
};

export type ClassesPackIndex = {
  version: 1;
  generatedAt: string;
  count: number;
  entriesMeta: RulesEntryMeta[];
  allTags: string[];
  tagCounts: Record<string, number>;
  tagBitsets: Record<string, number[]>;
};
