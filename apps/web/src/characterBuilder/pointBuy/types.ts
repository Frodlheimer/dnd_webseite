export const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;

export type Ability = (typeof ABILITIES)[number];

export type AbilityMap = Record<Ability, number>;

export type AsChoice =
  | { kind: 'ASI'; plus2?: Ability; plus1a?: Ability; plus1b?: Ability }
  | { kind: 'FEAT_NONE'; featId?: string }
  | { kind: 'FEAT_PLUS1'; ability: Ability; featId?: string };

export const ABILITY_LABELS: Record<Ability, string> = {
  STR: 'Strength',
  DEX: 'Dexterity',
  CON: 'Constitution',
  INT: 'Intelligence',
  WIS: 'Wisdom',
  CHA: 'Charisma'
};

export const createAbilityMap = (initialValue: number): AbilityMap => {
  return {
    STR: initialValue,
    DEX: initialValue,
    CON: initialValue,
    INT: initialValue,
    WIS: initialValue,
    CHA: initialValue
  };
};
