export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

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

export type RaceStructuredData = {
  id: string;
  name: string;
  parentRaceId?: string | null;
  kind: 'race' | 'subrace';
  source: 'srd51';
  tags: string[];
  summary?: string;
  basics: {
    size?: string | null;
    speedWalk?: number | null;
    speedBurrow?: number | null;
    speedClimb?: number | null;
    speedFly?: number | null;
    speedSwim?: number | null;
    creatureType?: string | null;
    ageText?: string | null;
    alignmentText?: string | null;
  };
  abilities: {
    bonuses: Partial<Record<Ability, number>>;
    bonusChoice?: {
      choose: number;
      amount: number;
      from: Ability[];
    } | null;
  };
  languages: {
    granted: string[];
    choices?: {
      choose: number;
      from: string[];
    } | null;
  };
  senses: {
    darkvision?: number | null;
    blindsight?: number | null;
    tremorsense?: number | null;
    truesight?: number | null;
  };
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
    skills: string[];
    skillChoices?: {
      choose: number;
      from: string[];
    } | null;
    toolChoices?: {
      choose: number;
      from: string[];
    } | null;
  };
  defenses: {
    resistances: string[];
    immunities: string[];
    conditionImmunities: string[];
    savingThrowAdvantages: string[];
  };
  traits: Array<{
    id: string;
    name: string;
    summary?: string;
    rulesText: string;
    category?: string;
    grants?: {
      proficiencies?: Partial<RaceStructuredData['proficiencies']>;
      senses?: Partial<RaceStructuredData['senses']>;
      defenses?: Partial<RaceStructuredData['defenses']>;
      speed?: Partial<RaceStructuredData['basics']>;
      languages?: Partial<RaceStructuredData['languages']>;
      abilities?: Partial<RaceStructuredData['abilities']>;
    };
  }>;
  documentBlocks: RuleBlock[];
};

export type RaceStructuredFlags = {
  hasAbilityBonuses: boolean;
  hasToolChoices: boolean;
  hasWeaponProficiencies: boolean;
  hasSkillChoices: boolean;
  hasResistances: boolean;
};

export type RaceEntryMeta = {
  id: string;
  name: string;
  kind: 'race' | 'subrace';
  parentRaceId: string | null;
  source: 'srd51';
  tags: string[];
  summary: string;
  size: string | null;
  speedWalk: number | null;
  darkvision: number | null;
  languagesGranted: string[];
  structuredFlags: RaceStructuredFlags;
  detailUrl: string;
  nameFolded: string;
};

export type RacesPackIndex = {
  version: 1;
  generatedAt: string;
  racesMeta: RaceEntryMeta[];
  allTags: string[];
  tagCounts: Record<string, number>;
  tagBitsets: Record<string, number[]>;
  filterOptions: {
    sizes: string[];
    speeds: number[];
    darkvisionValues: number[];
    languages: string[];
  };
};

export type RaceLookup = {
  byId: Record<
    string,
    {
      id: string;
      kind: 'race' | 'subrace';
      parentRaceId: string | null;
      name: string;
    }
  >;
  parentToSubraces: Record<string, string[]>;
};
