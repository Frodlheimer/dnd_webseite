export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

export type Ability = (typeof ABILITIES)[number];

export type CharacterId = string;

export type CharacterOriginMode = 'SRD_5_2_BACKGROUND' | 'LEGACY_RACE';

export type CharacterBuildStatus = 'draft' | 'in_progress' | 'ready' | 'invalid';

export type ValidationIssue = {
  id: string;
  severity: 'error' | 'warning';
  section: string;
  message: string;
  decisionId?: string;
};

export type PendingDecision = {
  id: string;
  section: string;
  title: string;
  description?: string;
  kind: string;
  required: boolean;
  source: string;
  optionsCount?: number;
};

export type CharacterRecord = {
  id: CharacterId;
  createdAt: number;
  updatedAt: number;
  status: CharacterBuildStatus;
  meta: {
    name: string;
    playerName?: string;
    notes?: string;
    sourceScope: 'srd51' | 'srd52' | 'mixed';
  };
  progression: {
    level: number;
    classId: string | null;
    subclassId: string | null;
    multiclass: null;
  };
  origin: {
    mode: CharacterOriginMode;
    raceId: string | null;
    speciesId: string | null;
    backgroundId: string | null;
    selectedLanguages: string[];
    selectedToolProficiencies: string[];
    selectedBackgroundAbilityTriplet?: Ability[];
    backgroundBonusPattern?: 'plus2_plus1' | 'plus1_plus1_plus1';
    backgroundBonusAssignments?: Partial<Record<Ability, number>>;
    legacyRaceBonusAssignments?: Partial<Record<Ability, number>>;
  };
  abilities: {
    method: 'point_buy';
    pointBuyBase: Record<Ability, number>;
    abilityChoiceHistory?: Array<Record<string, unknown>>;
  };
  proficiencies: {
    skills: string[];
    tools: string[];
    armor: string[];
    weapons: string[];
    savingThrows: Ability[];
    languages: string[];
    expertise?: string[];
  };
  equipment: {
    startingMode: 'package' | 'gold';
    selectedPackages: Array<{
      decisionId: string;
      optionId: string;
      label: string;
      items: CharacterEquipmentItem[];
    }>;
    items: CharacterEquipmentItem[];
    currency?: {
      cp: number;
      sp: number;
      ep: number;
      gp: number;
      pp: number;
    };
  };
  spells: {
    selectedCantrips: string[];
    selectedKnownSpells: string[];
    preparedSpells: string[];
    grantedSpells: string[];
    spellbookSpells?: string[];
    invocationChoices?: string[];
    metamagicChoices?: string[];
    pactChoices?: string[];
    customSelections?: Record<string, string[]>;
  };
  featsAndAsi: {
    opportunities: Array<{
      level: number;
      choice:
        | {
            kind: 'ASI';
            increases: Partial<Record<Ability, number>>;
          }
        | {
            kind: 'FEAT';
            featId: string | null;
            bonusAssignments?: Partial<Record<Ability, number>>;
          };
    }>;
  };
  features: {
    autoGranted: Array<{ id: string; source: string; level?: number }>;
    selectedChoices: Record<string, string | string[] | number | boolean>;
  };
  derived: {
    abilityFinal: Record<Ability, number>;
    abilityMods: Record<Ability, number>;
    proficiencyBonus: number;
    passivePerception: number;
    initiative: number;
    speed?: number | null;
    hitPointsMax?: number | null;
    armorClass?: number | null;
    spellSaveDc?: number | null;
    spellAttackBonus?: number | null;
    spellSlots?: number[] | null;
    cantripsKnown?: number | null;
    spellsPreparedMax?: number | null;
  };
  validation: {
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    pendingDecisions: PendingDecision[];
  };
  exportState?: {
    generalSheetLastGeneratedAt?: number;
  };
};

export type CharacterEquipmentItem = {
  id: string;
  name: string;
  quantity: number;
  source?: string;
  equipped?: boolean;
};

export type CharacterSummary = {
  id: CharacterId;
  name: string;
  className: string | null;
  subclassName: string | null;
  level: number;
  raceOrSpeciesName: string | null;
  backgroundName: string | null;
  abilityFinal: Record<Ability, number>;
  armorClass: number | null;
  hitPointsMax: number | null;
  initiative: number | null;
  proficiencyBonus: number | null;
  status: CharacterBuildStatus;
  completionLabel: string;
  updatedAt: number;
  createdAt: number;
};

const DEFAULT_ABILITY_MAP: Record<Ability, number> = {
  str: 8,
  dex: 8,
  con: 8,
  int: 8,
  wis: 8,
  cha: 8
};

const EMPTY_DERIVED_ABILITY_MAP: Record<Ability, number> = {
  str: 8,
  dex: 8,
  con: 8,
  int: 8,
  wis: 8,
  cha: 8
};

const EMPTY_MOD_MAP: Record<Ability, number> = {
  str: -1,
  dex: -1,
  con: -1,
  int: -1,
  wis: -1,
  cha: -1
};

export const createCharacterId = (): CharacterId => {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `character-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

export const createEmptyCharacter = (): CharacterRecord => {
  const now = Date.now();
  return {
    id: createCharacterId(),
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    meta: {
      name: 'New Character',
      sourceScope: 'mixed'
    },
    progression: {
      level: 1,
      classId: null,
      subclassId: null,
      multiclass: null
    },
    origin: {
      mode: 'SRD_5_2_BACKGROUND',
      raceId: null,
      speciesId: null,
      backgroundId: null,
      selectedLanguages: [],
      selectedToolProficiencies: [],
      selectedBackgroundAbilityTriplet: ['str', 'dex', 'con'],
      backgroundBonusPattern: 'plus2_plus1',
      backgroundBonusAssignments: {
        str: 2,
        dex: 1
      },
      legacyRaceBonusAssignments: {}
    },
    abilities: {
      method: 'point_buy',
      pointBuyBase: {
        ...DEFAULT_ABILITY_MAP
      },
      abilityChoiceHistory: []
    },
    proficiencies: {
      skills: [],
      tools: [],
      armor: [],
      weapons: [],
      savingThrows: [],
      languages: [],
      expertise: []
    },
    equipment: {
      startingMode: 'package',
      selectedPackages: [],
      items: [],
      currency: {
        cp: 0,
        sp: 0,
        ep: 0,
        gp: 0,
        pp: 0
      }
    },
    spells: {
      selectedCantrips: [],
      selectedKnownSpells: [],
      preparedSpells: [],
      grantedSpells: [],
      spellbookSpells: [],
      invocationChoices: [],
      metamagicChoices: [],
      pactChoices: [],
      customSelections: {}
    },
    featsAndAsi: {
      opportunities: []
    },
    features: {
      autoGranted: [],
      selectedChoices: {}
    },
    derived: {
      abilityFinal: {
        ...EMPTY_DERIVED_ABILITY_MAP
      },
      abilityMods: {
        ...EMPTY_MOD_MAP
      },
      proficiencyBonus: 2,
      passivePerception: 9,
      initiative: -1,
      speed: null,
      hitPointsMax: null,
      armorClass: null,
      spellSaveDc: null,
      spellAttackBonus: null,
      spellSlots: null,
      cantripsKnown: null,
      spellsPreparedMax: null
    },
    validation: {
      errors: [],
      warnings: [],
      pendingDecisions: []
    },
    exportState: {}
  };
};

