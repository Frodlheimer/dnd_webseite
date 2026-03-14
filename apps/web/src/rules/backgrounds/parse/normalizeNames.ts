const MOJIBAKE_REPLACEMENTS: Array<[string, string]> = [
  ['â€™', "'"],
  ['â€˜', "'"],
  ['â€œ', '"'],
  ['â€�', '"'],
  ['â€“', '-'],
  ['â€”', '-'],
  ['â€¦', '...'],
  ['Â', ''],
  ['\u00a0', ' ']
];

const repairLatin1Utf8 = (value: string): string => {
  if (!/[ÂÃâ]/.test(value)) {
    return value;
  }

  try {
    const bytes = Uint8Array.from(Array.from(value, (character) => character.charCodeAt(0) & 0xff));
    const repaired = new TextDecoder('utf-8', {
      fatal: false
    }).decode(bytes);
    return repaired || value;
  } catch {
    return value;
  }
};

const SKILL_CANONICAL: Record<string, string> = {
  acrobatics: 'Acrobatics',
  'animal handling': 'Animal Handling',
  arcana: 'Arcana',
  athletics: 'Athletics',
  deception: 'Deception',
  history: 'History',
  insight: 'Insight',
  intimidation: 'Intimidation',
  investigation: 'Investigation',
  medicine: 'Medicine',
  nature: 'Nature',
  perception: 'Perception',
  performance: 'Performance',
  persuasion: 'Persuasion',
  religion: 'Religion',
  'sleight of hand': 'Sleight of Hand',
  stealth: 'Stealth',
  survival: 'Survival'
};

const TOOL_CANONICAL: Record<string, string> = {
  "alchemist's supplies": "Alchemist's supplies",
  "brewer's supplies": "Brewer's supplies",
  "calligrapher's supplies": "Calligrapher's supplies",
  "carpenter's tools": "Carpenter's tools",
  "cartographer's tools": "Cartographer's tools",
  "cobbler's tools": "Cobbler's tools",
  "cook's utensils": "Cook's utensils",
  "glassblower's tools": "Glassblower's tools",
  "jeweler's tools": "Jeweler's tools",
  "leatherworker's tools": "Leatherworker's tools",
  "mason's tools": "Mason's tools",
  "painter's supplies": "Painter's supplies",
  "potter's tools": "Potter's tools",
  "smith's tools": "Smith's tools",
  "tinker's tools": "Tinker's tools",
  "weaver's tools": "Weaver's tools",
  "woodcarver's tools": "Woodcarver's tools",
  "thieves' tools": "Thieves' tools",
  'thieves tools': "Thieves' tools",
  'forgery kit': 'Forgery kit',
  'herbalism kit': 'Herbalism kit',
  "poisoner's kit": "Poisoner's kit",
  'poisoner kit': "Poisoner's kit",
  'disguise kit': 'Disguise kit',
  "navigator's tools": "Navigator's tools",
  'navigator tools': "Navigator's tools",
  'vehicles (land)': 'Vehicles (land)',
  'vehicles (water)': 'Vehicles (water)',
  'vehicles (space)': 'Vehicles (space)',
  bagpipes: 'Bagpipes',
  drum: 'Drum',
  dulcimer: 'Dulcimer',
  flute: 'Flute',
  horn: 'Horn',
  lute: 'Lute',
  lyre: 'Lyre',
  'pan flute': 'Pan flute',
  shawm: 'Shawm',
  viol: 'Viol',
  'dice set': 'Dice set',
  'dragonchess set': 'Dragonchess set',
  'playing card set': 'Playing card set',
  'three-dragon ante set': 'Three-Dragon Ante set'
};

const LANGUAGE_CANONICAL: Record<string, string> = {
  common: 'Common',
  dwarvish: 'Dwarvish',
  elvish: 'Elvish',
  giant: 'Giant',
  gnomish: 'Gnomish',
  goblin: 'Goblin',
  halfling: 'Halfling',
  orc: 'Orc',
  abyssal: 'Abyssal',
  celestial: 'Celestial',
  draconic: 'Draconic',
  'deep speech': 'Deep Speech',
  infernal: 'Infernal',
  primordial: 'Primordial',
  sylvan: 'Sylvan',
  undercommon: 'Undercommon'
};

export const ALL_SKILL_OPTIONS = Object.values(SKILL_CANONICAL);

export const ARTISAN_TOOL_OPTIONS = [
  "Alchemist's supplies",
  "Brewer's supplies",
  "Calligrapher's supplies",
  "Carpenter's tools",
  "Cartographer's tools",
  "Cobbler's tools",
  "Cook's utensils",
  "Glassblower's tools",
  "Jeweler's tools",
  "Leatherworker's tools",
  "Mason's tools",
  "Painter's supplies",
  "Potter's tools",
  "Smith's tools",
  "Tinker's tools",
  "Weaver's tools",
  "Woodcarver's tools"
] as const;

export const GAMING_SET_OPTIONS = [
  'Dice set',
  'Dragonchess set',
  'Playing card set',
  'Three-Dragon Ante set'
] as const;

export const MUSICAL_INSTRUMENT_OPTIONS = [
  'Bagpipes',
  'Drum',
  'Dulcimer',
  'Flute',
  'Horn',
  'Lute',
  'Lyre',
  'Pan flute',
  'Shawm',
  'Viol'
] as const;

export const STANDARD_LANGUAGE_OPTIONS = [
  'Common',
  'Dwarvish',
  'Elvish',
  'Giant',
  'Gnomish',
  'Goblin',
  'Halfling',
  'Orc'
] as const;

export const EXOTIC_LANGUAGE_OPTIONS = [
  'Abyssal',
  'Celestial',
  'Draconic',
  'Deep Speech',
  'Infernal',
  'Primordial',
  'Sylvan',
  'Undercommon'
] as const;

export const ALL_LANGUAGE_OPTIONS = [...STANDARD_LANGUAGE_OPTIONS, ...EXOTIC_LANGUAGE_OPTIONS] as const;

export const normalizeText = (value: string): string => {
  let output = repairLatin1Utf8(`${value ?? ''}`);
  MOJIBAKE_REPLACEMENTS.forEach(([from, to]) => {
    output = output.replaceAll(from, to);
  });
  return output;
};

export const collapseWhitespace = (value: string): string => {
  return normalizeText(value).replace(/\s+/g, ' ').trim();
};

export const collapseMultilineWhitespace = (value: string): string => {
  return normalizeText(value)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
};

export const foldBackgroundText = (value: string): string => {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const slugifyBackgroundValue = (value: string): string => {
  return foldBackgroundText(value).replace(/\s+/g, '-');
};

export const normalizeSkillName = (value: string): string => {
  const normalized = foldBackgroundText(value);
  return SKILL_CANONICAL[normalized] ?? collapseWhitespace(value);
};

export const normalizeToolName = (value: string): string => {
  const normalized = foldBackgroundText(value);
  return TOOL_CANONICAL[normalized] ?? collapseWhitespace(value);
};

export const normalizeLanguageName = (value: string): string => {
  const normalized = foldBackgroundText(value);
  return LANGUAGE_CANONICAL[normalized] ?? collapseWhitespace(value);
};

export const removeLeadingArticle = (value: string): string => {
  return collapseWhitespace(value).replace(/^(?:a|an|the)\s+/i, '').trim();
};

export const extractFirstSentence = (value: string): string | null => {
  const normalized = collapseWhitespace(value);
  if (!normalized) {
    return null;
  }
  const match = normalized.match(/(.+?[.!?])(?:\s|$)/);
  return match?.[1] ?? normalized;
};

export const parseChoiceCount = (value: string): number | null => {
  const normalized = foldBackgroundText(value);
  if (!normalized) {
    return null;
  }
  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }
  const map: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5
  };
  return map[normalized] ?? null;
};

export const cleanEquipmentNoise = (value: string): string => {
  return collapseWhitespace(
    normalizeText(value)
      .replace(/Value:\s*[\d.a-z]+/gi, '')
      .replace(/Weight:\s*[\d.a-z]+/gi, '')
      .replace(/\s+,/g, ',')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
  );
};

export const dedupeStrings = <T extends string>(values: T[]): T[] => {
  return [...new Set(values)];
};
