import type { Ability } from '../model';

export const ABILITY_BY_WORD: Record<string, Ability> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha'
};

export const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const SKILL_NAMES = [
  'Acrobatics',
  'Animal Handling',
  'Arcana',
  'Athletics',
  'Deception',
  'History',
  'Insight',
  'Intimidation',
  'Investigation',
  'Medicine',
  'Nature',
  'Perception',
  'Performance',
  'Persuasion',
  'Religion',
  'Sleight of Hand',
  'Stealth',
  'Survival'
] as const;

export const STANDARD_LANGUAGE_POOL = [
  'Abyssal',
  'Celestial',
  'Common',
  'Draconic',
  'Dwarvish',
  'Elvish',
  'Giant',
  'Gnomish',
  'Goblin',
  'Halfling',
  'Infernal',
  'Orc',
  'Primordial',
  'Sylvan',
  'Undercommon'
];

export const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6
};

export const normalizeRaceText = (value: string): string => {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u2212/g, '-')
    .replace(/---/g, '-')
    .replace(/--/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
};

export const foldRaceText = (value: string): string => {
  return normalizeRaceText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const slugifyRaceId = (value: string): string => {
  const folded = foldRaceText(value).replace(/\s+/g, '-');
  return folded || 'race-entry';
};

export const summarizeRaceText = (value: string, maxLength = 220): string => {
  const normalized = normalizeRaceText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

export const summarizeSentence = (value: string, maxLength = 140): string => {
  const normalized = normalizeRaceText(value);
  const firstSentence = normalized.match(/^[^.?!]+[.?!]?/)?.[0]?.trim() ?? normalized;
  return summarizeRaceText(firstSentence, maxLength);
};

export const dedupeStrings = (values: string[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = normalizeRaceText(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
  }
  return output;
};

export const parseNumberToken = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }

  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  return NUMBER_WORDS[value.toLowerCase()] ?? null;
};

export const normalizeListItems = (value: string): string[] => {
  return dedupeStrings(
    normalizeRaceText(value)
      .replace(/\s+or\s+/gi, ', ')
      .replace(/\s+and\s+/gi, ', ')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
};
