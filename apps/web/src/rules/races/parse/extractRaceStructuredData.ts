import type { ExtractedRaceEntrySource } from './extractRacesFromSrd';
import type { Ability, RaceStructuredData } from '../model';
import {
  ABILITIES,
  ABILITY_BY_WORD,
  SKILL_NAMES,
  STANDARD_LANGUAGE_POOL,
  dedupeStrings,
  normalizeListItems,
  normalizeRaceText,
  parseNumberToken,
  slugifyRaceId,
  summarizeRaceText,
  summarizeSentence
} from './normalizeRaceText';

type TraitSection = {
  name: string;
  body: string;
};

type TraitGrants = NonNullable<RaceStructuredData['traits'][number]['grants']>;
type CountChoice<T extends string> = { choose: number; from: T[] };
type AbilityBonusChoice = NonNullable<RaceStructuredData['abilities']['bonusChoice']>;

const WEAPON_NAMES = [
  'battleaxe',
  'handaxe',
  'light hammer',
  'warhammer',
  'longsword',
  'shortsword',
  'shortbow',
  'longbow'
];

const DEFENSE_CATEGORY_LABELS = new Set([
  'Darkvision',
  'Dwarven Resilience',
  'Fey Ancestry',
  'Brave',
  'Gnome Cunning',
  'Hellish Resistance'
]);

const PROFICIENCY_CATEGORY_LABELS = new Set([
  'Dwarven Combat Training',
  'Tool Proficiency',
  'Keen Senses',
  'Elf Weapon Training',
  'Menacing',
  'Skill Versatility',
  'Tinker',
  "Artificer's Lore"
]);

const KNOWN_TRAIT_LABELS = [
  'Ability Score Increase',
  'Age',
  'Alignment',
  'Size',
  'Speed',
  'Darkvision',
  'Languages',
  'Extra Language',
  'Dwarven Resilience',
  'Dwarven Combat Training',
  'Tool Proficiency',
  'Stonecunning',
  'Dwarven Toughness',
  'Keen Senses',
  'Fey Ancestry',
  'Trance',
  'Elf Weapon Training',
  'Cantrip',
  'Fleet of Foot',
  'Mask of the Wild',
  'Lucky',
  'Brave',
  'Halfling Nimbleness',
  'Naturally Stealthy',
  'Draconic Ancestry',
  'Breath Weapon',
  'Damage Resistance',
  'Natural Illusionist',
  'Speak with Small Beasts',
  'Gnome Cunning',
  "Artificer's Lore",
  'Tinker',
  'Skill Versatility',
  'Menacing',
  'Relentless Endurance',
  'Savage Attacks',
  'Hellish Resistance',
  'Infernal Legacy'
].sort((left, right) => right.length - left.length);

const traitLabelPattern = KNOWN_TRAIT_LABELS.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const traitLabelMatcher = new RegExp(`(^|\\s)(${traitLabelPattern})\\.\\s`, 'g');

const createEmptyRaceData = (entry: ExtractedRaceEntrySource): RaceStructuredData => ({
  id: entry.id,
  name: entry.name,
  parentRaceId: entry.parentRaceId,
  kind: entry.kind,
  source: 'srd51',
  tags: [],
  summary: entry.summary,
  basics: {
    size: null,
    speedWalk: null,
    speedBurrow: null,
    speedClimb: null,
    speedFly: null,
    speedSwim: null,
    creatureType: null,
    ageText: null,
    alignmentText: null
  },
  abilities: {
    bonuses: {},
    bonusChoice: null
  },
  languages: {
    granted: [],
    choices: null
  },
  senses: {
    darkvision: null,
    blindsight: null,
    tremorsense: null,
    truesight: null
  },
  proficiencies: {
    armor: [],
    weapons: [],
    tools: [],
    skills: [],
    skillChoices: null,
    toolChoices: null
  },
  defenses: {
    resistances: [],
    immunities: [],
    conditionImmunities: [],
    savingThrowAdvantages: []
  },
  traits: [],
  documentBlocks: entry.documentBlocks
});

const removeLeadingName = (entry: ExtractedRaceEntrySource): string => {
  const normalized = normalizeRaceText(entry.structuredText);
  if (entry.kind !== 'subrace') {
    return normalized;
  }
  if (normalized.startsWith(`${entry.name} `)) {
    return normalizeRaceText(normalized.slice(entry.name.length).trim());
  }
  if (normalized.startsWith(`${entry.name}.`)) {
    return normalizeRaceText(normalized.slice(entry.name.length + 1).trim());
  }
  return normalized;
};

const splitTraitSections = (entry: ExtractedRaceEntrySource): { intro: string; sections: TraitSection[] } => {
  const workingText = removeLeadingName(entry);
  const matches = [...workingText.matchAll(traitLabelMatcher)];
  if (matches.length === 0) {
    return {
      intro: workingText,
      sections: []
    };
  }

  const intro = normalizeRaceText(workingText.slice(0, matches[0]?.index ?? 0));
  const sections: TraitSection[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    if (match?.index === undefined || !match[2]) {
      continue;
    }
    const prefixLength = match[1]?.length ?? 0;
    const labelStart = match.index + prefixLength;
    const sectionStart = labelStart + match[2].length + 2;
    const nextStart =
      (matches[index + 1]?.index ?? workingText.length) + (matches[index + 1]?.[1]?.length ?? 0);
    sections.push({
      name: normalizeRaceText(match[2]),
      body: normalizeRaceText(workingText.slice(sectionStart, nextStart))
    });
  }

  return {
    intro,
    sections
  };
};

const parseFixedAbilityBonuses = (text: string): Partial<Record<Ability, number>> => {
  const bonuses: Partial<Record<Ability, number>> = {};
  const normalized = normalizeRaceText(text);

  for (const [word, ability] of Object.entries(ABILITY_BY_WORD)) {
    const matcher = new RegExp(`${word}\\s+score(?:s)?\\s+increase(?:s)?\\s+by\\s+(\\d+)`, 'i');
    const match = normalized.match(matcher);
    if (!match?.[1]) {
      continue;
    }
    const amount = Number.parseInt(match[1], 10);
    if (Number.isFinite(amount)) {
      bonuses[ability] = amount;
    }
  }

  const allMatch = normalized.match(/ability scores each increase by (\d+)/i);
  if (allMatch?.[1]) {
    const amount = Number.parseInt(allMatch[1], 10);
    if (Number.isFinite(amount)) {
      ABILITIES.forEach((ability) => {
        bonuses[ability] = amount;
      });
    }
  }

  return bonuses;
};

const parseAbilityBonusChoice = (
  text: string,
  fixedBonuses: Partial<Record<Ability, number>>
): RaceStructuredData['abilities']['bonusChoice'] => {
  const normalized = normalizeRaceText(text);
  const choiceMatch =
    normalized.match(/(one|two|three|four|five|six|\d+)\s+(?:other\s+)?ability scores? of your choice increase by (\d+)/i) ??
    normalized.match(/choose (one|two|three|four|five|six|\d+)\s+ability scores?.*increase by (\d+)/i);
  if (!choiceMatch?.[1] || !choiceMatch[2]) {
    return null;
  }

  const choose = parseNumberToken(choiceMatch[1]);
  const amount = parseNumberToken(choiceMatch[2]);
  if (!choose || !amount) {
    return null;
  }

  const fixed = new Set(Object.keys(fixedBonuses) as Ability[]);
  const from = ABILITIES.filter((ability) => !fixed.has(ability));
  return {
    choose,
    amount,
    from: from.length > 0 ? from : [...ABILITIES]
  };
};

const parseLanguageChoices = (text: string): RaceStructuredData['languages']['choices'] => {
  const normalized = normalizeRaceText(text);
  const choiceMatch = normalized.match(/(one|two|three|four|five|six|\d+)\s+extra languages? of your choice/i);
  if (choiceMatch?.[1]) {
    const choose = parseNumberToken(choiceMatch[1]);
    if (choose) {
      return {
        choose,
        from: [...STANDARD_LANGUAGE_POOL]
      };
    }
  }

  if (/one extra language of your choice/i.test(normalized)) {
    return {
      choose: 1,
      from: [...STANDARD_LANGUAGE_POOL]
    };
  }

  return null;
};

const parseGrantedLanguages = (text: string): string[] => {
  const normalized = normalizeRaceText(text);
  const clause = normalized.match(/speak, read, and write ([^.]+)/i)?.[1];
  if (!clause) {
    return [];
  }

  const withoutChoices = clause
    .replace(/(?:,?\s*and)?\s*(one|two|three|four|five|six|\d+)\s+extra languages? of your choice/gi, '')
    .replace(/(?:,?\s*and)?\s*one extra language of your choice/gi, '');
  return dedupeStrings(
    normalizeListItems(withoutChoices).filter((entry) =>
      STANDARD_LANGUAGE_POOL.some((language) => language.toLowerCase() === entry.toLowerCase())
    )
  );
};

const parseDistanceSense = (
  text: string,
  sense: 'darkvision' | 'blindsight' | 'tremorsense' | 'truesight'
): number | null => {
  const normalized = normalizeRaceText(text);
  let raw: string | undefined;

  if (sense === 'darkvision') {
    const match =
      normalized.match(/darkvision[^.]*?(\d+)\s*feet/i) ??
      normalized.match(/see in dim light within\s+(\d+)\s*feet/i);
    raw = match?.[1];
  } else {
    const match = normalized.match(new RegExp(`${sense}[^.]*?(\\d+)\\s*feet`, 'i'));
    raw = match?.[1];
  }

  if (!raw) {
    return null;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
};

const parseSpeedFromText = (text: string): Partial<RaceStructuredData['basics']> => {
  const normalized = normalizeRaceText(text);
  const speed: Partial<RaceStructuredData['basics']> = {};
  const walkMatch = normalized.match(/(?:base )?walking speed is (\d+)\s*feet/i) ?? normalized.match(/speed is (\d+)\s*feet/i);
  const climbMatch = normalized.match(/climbing speed of (\d+)\s*feet|climb speed of (\d+)\s*feet/i);
  const flyMatch = normalized.match(/flying speed of (\d+)\s*feet|fly speed of (\d+)\s*feet/i);
  const swimMatch = normalized.match(/swimming speed of (\d+)\s*feet|swim speed of (\d+)\s*feet/i);
  const burrowMatch = normalized.match(/burrowing speed of (\d+)\s*feet|burrow speed of (\d+)\s*feet/i);

  if (walkMatch?.[1]) {
    speed.speedWalk = Number.parseInt(walkMatch[1], 10);
  }
  if (climbMatch?.[1] || climbMatch?.[2]) {
    speed.speedClimb = Number.parseInt(climbMatch[1] ?? climbMatch[2] ?? '', 10);
  }
  if (flyMatch?.[1] || flyMatch?.[2]) {
    speed.speedFly = Number.parseInt(flyMatch[1] ?? flyMatch[2] ?? '', 10);
  }
  if (swimMatch?.[1] || swimMatch?.[2]) {
    speed.speedSwim = Number.parseInt(swimMatch[1] ?? swimMatch[2] ?? '', 10);
  }
  if (burrowMatch?.[1] || burrowMatch?.[2]) {
    speed.speedBurrow = Number.parseInt(burrowMatch[1] ?? burrowMatch[2] ?? '', 10);
  }

  return speed;
};

const parseSizeFromText = (text: string): string | null => {
  const match = normalizeRaceText(text).match(/your size is (Tiny|Small|Medium|Large|Huge|Gargantuan)/i);
  return match?.[1] ? match[1] : null;
};

const parseSkillGrants = (text: string): {
  skills: string[];
  skillChoices: RaceStructuredData['proficiencies']['skillChoices'];
} => {
  const normalized = normalizeRaceText(text);
  const skills: string[] = [];

  const directSkillMatch =
    normalized.match(/proficiency in the ([A-Za-z ]+) skill/i) ??
    normalized.match(/gain proficiency in the ([A-Za-z ]+) skill/i);
  if (directSkillMatch?.[1]) {
    skills.push(directSkillMatch[1].trim());
  }

  const chooseMatch = normalized.match(/proficiency in (one|two|three|four|five|six|\d+) skills? of your choice/i);
  const choose = parseNumberToken(chooseMatch?.[1]);

  return {
    skills: dedupeStrings(skills),
    skillChoices: choose
      ? {
          choose,
          from: [...SKILL_NAMES]
        }
      : null
  };
};

const parseToolGrants = (text: string): {
  tools: string[];
  toolChoices: RaceStructuredData['proficiencies']['toolChoices'];
} => {
  const normalized = normalizeRaceText(text);
  const choiceMatch = normalized.match(/artisan'?s tools of your choice:\s*([^.]+)\.?/i);
  if (choiceMatch?.[1]) {
    return {
      tools: [],
      toolChoices: {
        choose: 1,
        from: dedupeStrings(normalizeListItems(choiceMatch[1]))
      }
    };
  }

  const directMatch = normalized.match(/proficiency with (?:artisan'?s tools\s*\()?([^)]+tools|[^)]+supplies)\)?/i);
  return {
    tools: directMatch?.[1] ? dedupeStrings([directMatch[1]]) : [],
    toolChoices: null
  };
};

const parseWeaponGrants = (text: string): string[] => {
  const normalized = normalizeRaceText(text);
  const match = normalized.match(/proficiency with the ([^.]+)\./i);
  if (!match?.[1]) {
    return [];
  }

  const items = normalizeListItems(match[1]);
  return dedupeStrings(items.filter((item) => WEAPON_NAMES.includes(item.toLowerCase())));
};

const parseResistances = (text: string): string[] => {
  const normalized = normalizeRaceText(text);
  const candidates = [...normalized.matchAll(/resistance (?:against|to)?\s+([A-Za-z ]+?) damage/gi)].map(
    (match) => normalizeRaceText(match[1] ?? '')
  );

  return dedupeStrings(
    candidates.filter(
      (candidate) =>
        candidate.length > 0 &&
        !candidate.includes('associated with') &&
        !candidate.includes('your ancestry') &&
        !candidate.includes('damage type')
    )
  );
};

const parseImmunities = (text: string): string[] => {
  const matches = [...normalizeRaceText(text).matchAll(/immune to ([A-Za-z ]+?)(?: damage|\.|,)/gi)];
  return dedupeStrings(matches.map((match) => match[1] ?? ''));
};

const parseConditionImmunities = (text: string): string[] => {
  const normalized = normalizeRaceText(text);
  const output: string[] = [];
  if (/can't put you to sleep|cannot put you to sleep/i.test(normalized)) {
    output.push('magical sleep');
  }
  return dedupeStrings(output);
};

const parseSavingThrowAdvantages = (text: string): string[] => {
  const normalized = normalizeRaceText(text);
  const output: string[] = [];

  const generalMatches = [...normalized.matchAll(/advantage on saving throws against ([^.]+?)(?:,|\.| and )/gi)];
  generalMatches.forEach((match) => {
    if (match[1]) {
      output.push(match[1].replace(/^being\s+/i, '').trim());
    }
  });

  const abilitySpecific = normalized.match(/advantage on all ([A-Za-z, ]+) saving throws against ([^.]+?)\./i);
  const affectedAbilities = abilitySpecific?.[1];
  const against = abilitySpecific?.[2];
  if (affectedAbilities && against) {
    const abilities = normalizeListItems(affectedAbilities);
    abilities.forEach((ability) => {
      output.push(`${against.trim()} (${ability})`);
    });
  }

  return dedupeStrings(output);
};

const mergeListInto = (target: string[], values: string[] | undefined): void => {
  if (!values || values.length === 0) {
    return;
  }
  const merged = dedupeStrings([...target, ...values]);
  target.splice(0, target.length, ...merged);
};

const mergeAbilityBonuses = (
  target: Partial<Record<Ability, number>>,
  values: Partial<Record<Ability, number>> | undefined
): void => {
  if (!values) {
    return;
  }
  for (const ability of ABILITIES) {
    const amount = values[ability] ?? 0;
    if (amount > 0) {
      target[ability] = (target[ability] ?? 0) + amount;
    }
  }
};

const mergeChoice = <T extends string>(
  current: CountChoice<T> | null | undefined,
  next: CountChoice<T> | null | undefined
): CountChoice<T> | null => {
  if (!current && !next) {
    return null;
  }
  if (!current) {
    return next ? { choose: next.choose, from: [...next.from] } : null;
  }
  if (!next) {
    return { choose: current.choose, from: [...current.from] };
  }
  return {
    choose: current.choose + next.choose,
    from: dedupeStrings([...current.from, ...next.from]) as T[]
  };
};

const mergeAbilityBonusChoice = (
  current: AbilityBonusChoice | null | undefined,
  next: AbilityBonusChoice | null | undefined
): AbilityBonusChoice | null => {
  if (!current && !next) {
    return null;
  }
  if (!current) {
    return next ? { choose: next.choose, amount: next.amount, from: [...next.from] } : null;
  }
  if (!next) {
    return { choose: current.choose, amount: current.amount, from: [...current.from] };
  }
  if (current.amount !== next.amount) {
    return { choose: next.choose, amount: next.amount, from: dedupeStrings([...next.from]) as Ability[] };
  }
  return {
    choose: current.choose + next.choose,
    amount: current.amount,
    from: dedupeStrings([...current.from, ...next.from]) as Ability[]
  };
};

const categorizeTrait = (label: string): string => {
  if (label === 'Ability Score Increase') {
    return 'ability';
  }
  if (label === 'Age' || label === 'Alignment' || label === 'Size' || label === 'Speed') {
    return 'basics';
  }
  if (label === 'Languages' || label === 'Extra Language') {
    return 'language';
  }
  if (label === 'Darkvision') {
    return 'sense';
  }
  if (DEFENSE_CATEGORY_LABELS.has(label)) {
    return 'defense';
  }
  if (PROFICIENCY_CATEGORY_LABELS.has(label)) {
    return 'proficiency';
  }
  return 'utility';
};

const summarizeTrait = (
  label: string,
  body: string,
  grants: NonNullable<RaceStructuredData['traits'][number]['grants']>
): string => {
  if (grants.abilities?.bonuses) {
    const bonuses = Object.entries(grants.abilities.bonuses)
      .map(([ability, amount]) => `${ability.toUpperCase()} +${amount}`)
      .join(', ');
    if (bonuses) {
      return bonuses;
    }
  }

  const languageChoices = grants.languages?.choices;
  if (grants.languages?.granted && grants.languages.granted.length > 0) {
    return grants.languages.granted.join(', ');
  }
  if (languageChoices) {
    return `Choose ${languageChoices.choose} language${languageChoices.choose > 1 ? 's' : ''}`;
  }

  if (grants.senses?.darkvision) {
    return `Darkvision ${grants.senses.darkvision} ft`;
  }

  if (grants.speed?.speedWalk) {
    return `Walking speed ${grants.speed.speedWalk} ft`;
  }

  const proficiencies = grants.proficiencies;
  if (proficiencies?.weapons && proficiencies.weapons.length > 0) {
    return proficiencies.weapons.join(', ');
  }
  if (proficiencies?.skills && proficiencies.skills.length > 0) {
    return proficiencies.skills.join(', ');
  }
  if (proficiencies?.tools && proficiencies.tools.length > 0) {
    return proficiencies.tools.join(', ');
  }
  if (proficiencies?.toolChoices) {
    return `Choose ${proficiencies.toolChoices.choose} tool${proficiencies.toolChoices.choose > 1 ? 's' : ''}`;
  }

  const resistances = grants.defenses?.resistances;
  if (resistances && resistances.length > 0) {
    return `Resistance: ${resistances.join(', ')}`;
  }
  const advantages = grants.defenses?.savingThrowAdvantages;
  if (advantages && advantages.length > 0) {
    return `Saving throw advantage vs ${advantages.join(', ')}`;
  }

  if (label === 'Age' || label === 'Alignment') {
    return summarizeRaceText(body, 120);
  }

  return summarizeSentence(body);
};

const parseTraitGrant = (
  label: string,
  body: string
): TraitGrants => {
  const fullText = `${label}. ${body}`;
  const fixedBonuses = parseFixedAbilityBonuses(fullText);
  const abilityChoice = parseAbilityBonusChoice(fullText, fixedBonuses);
  const grantedLanguages = parseGrantedLanguages(fullText);
  const languageChoices = parseLanguageChoices(fullText);
  const skillGrants = parseSkillGrants(fullText);
  const toolGrants = parseToolGrants(fullText);
  const weaponGrants = parseWeaponGrants(fullText);
  const size = parseSizeFromText(fullText);
  const speed = parseSpeedFromText(fullText);
  const darkvision = parseDistanceSense(fullText, 'darkvision');
  const blindsight = parseDistanceSense(fullText, 'blindsight');
  const tremorsense = parseDistanceSense(fullText, 'tremorsense');
  const truesight = parseDistanceSense(fullText, 'truesight');
  const resistances = parseResistances(fullText);
  const immunities = parseImmunities(fullText);
  const conditionImmunities = parseConditionImmunities(fullText);
  const savingThrowAdvantages = parseSavingThrowAdvantages(fullText);

  const grants: TraitGrants = {};

  if (Object.keys(fixedBonuses).length > 0 || abilityChoice) {
    const abilitiesGrant: NonNullable<TraitGrants['abilities']> = {
      bonuses: fixedBonuses
    };
    if (abilityChoice) {
      abilitiesGrant.bonusChoice = abilityChoice;
    }
    grants.abilities = abilitiesGrant;
  }

  if (grantedLanguages.length > 0 || languageChoices) {
    const languagesGrant: NonNullable<TraitGrants['languages']> = {
      granted: grantedLanguages
    };
    if (languageChoices) {
      languagesGrant.choices = languageChoices;
    }
    grants.languages = languagesGrant;
  }

  if (darkvision || blindsight || tremorsense || truesight) {
    const sensesGrant: NonNullable<TraitGrants['senses']> = {};
    if (darkvision !== null) {
      sensesGrant.darkvision = darkvision;
    }
    if (blindsight !== null) {
      sensesGrant.blindsight = blindsight;
    }
    if (tremorsense !== null) {
      sensesGrant.tremorsense = tremorsense;
    }
    if (truesight !== null) {
      sensesGrant.truesight = truesight;
    }
    grants.senses = sensesGrant;
  }

  if (
    skillGrants.skills.length > 0 ||
    weaponGrants.length > 0 ||
    toolGrants.tools.length > 0 ||
    skillGrants.skillChoices ||
    toolGrants.toolChoices
  ) {
    const proficiencyGrant: NonNullable<TraitGrants['proficiencies']> = {
      armor: [],
      weapons: weaponGrants,
      tools: toolGrants.tools,
      skills: skillGrants.skills
    };
    if (skillGrants.skillChoices) {
      proficiencyGrant.skillChoices = skillGrants.skillChoices;
    }
    if (toolGrants.toolChoices) {
      proficiencyGrant.toolChoices = toolGrants.toolChoices;
    }
    grants.proficiencies = proficiencyGrant;
  }

  if (
    resistances.length > 0 ||
    immunities.length > 0 ||
    conditionImmunities.length > 0 ||
    savingThrowAdvantages.length > 0
  ) {
    grants.defenses = {
      resistances,
      immunities,
      conditionImmunities,
      savingThrowAdvantages
    };
  }

  if (size || Object.keys(speed).length > 0) {
    const speedGrant: NonNullable<TraitGrants['speed']> = {};
    if (size) {
      speedGrant.size = size;
    }
    if (typeof speed.speedWalk === 'number') {
      speedGrant.speedWalk = speed.speedWalk;
    }
    if (typeof speed.speedBurrow === 'number') {
      speedGrant.speedBurrow = speed.speedBurrow;
    }
    if (typeof speed.speedClimb === 'number') {
      speedGrant.speedClimb = speed.speedClimb;
    }
    if (typeof speed.speedFly === 'number') {
      speedGrant.speedFly = speed.speedFly;
    }
    if (typeof speed.speedSwim === 'number') {
      speedGrant.speedSwim = speed.speedSwim;
    }
    grants.speed = speedGrant;
  }

  return grants;
};

const applyTraitToRace = (
  race: RaceStructuredData,
  label: string,
  body: string,
  grants: NonNullable<RaceStructuredData['traits'][number]['grants']>
): void => {
  if (label === 'Age') {
    race.basics.ageText = body;
  }
  if (label === 'Alignment') {
    race.basics.alignmentText = body;
  }
  if (label === 'Size' && grants.speed?.size) {
    race.basics.size = grants.speed.size;
  }
  if (label === 'Speed' && grants.speed) {
    if (grants.speed.speedWalk !== undefined) {
      race.basics.speedWalk = grants.speed.speedWalk;
    }
    if (grants.speed.speedBurrow !== undefined) {
      race.basics.speedBurrow = grants.speed.speedBurrow;
    }
    if (grants.speed.speedClimb !== undefined) {
      race.basics.speedClimb = grants.speed.speedClimb;
    }
    if (grants.speed.speedFly !== undefined) {
      race.basics.speedFly = grants.speed.speedFly;
    }
    if (grants.speed.speedSwim !== undefined) {
      race.basics.speedSwim = grants.speed.speedSwim;
    }
  }
  if (label === 'Darkvision' && grants.senses?.darkvision) {
    race.senses.darkvision = grants.senses.darkvision;
  }
  if (label === 'Languages' || label === 'Extra Language') {
    mergeListInto(race.languages.granted, grants.languages?.granted);
    race.languages.choices = mergeChoice(race.languages.choices, grants.languages?.choices);
  }
  if (label === 'Ability Score Increase' && grants.abilities) {
    mergeAbilityBonuses(race.abilities.bonuses, grants.abilities.bonuses);
    race.abilities.bonusChoice = mergeAbilityBonusChoice(
      race.abilities.bonusChoice,
      grants.abilities.bonusChoice
    );
  }

  mergeListInto(race.proficiencies.armor, grants.proficiencies?.armor);
  mergeListInto(race.proficiencies.weapons, grants.proficiencies?.weapons);
  mergeListInto(race.proficiencies.tools, grants.proficiencies?.tools);
  mergeListInto(race.proficiencies.skills, grants.proficiencies?.skills);
  race.proficiencies.skillChoices = mergeChoice(race.proficiencies.skillChoices, grants.proficiencies?.skillChoices);
  race.proficiencies.toolChoices = mergeChoice(race.proficiencies.toolChoices, grants.proficiencies?.toolChoices);

  if (grants.senses?.darkvision) {
    race.senses.darkvision = grants.senses.darkvision;
  }
  if (grants.senses?.blindsight) {
    race.senses.blindsight = grants.senses.blindsight;
  }
  if (grants.senses?.tremorsense) {
    race.senses.tremorsense = grants.senses.tremorsense;
  }
  if (grants.senses?.truesight) {
    race.senses.truesight = grants.senses.truesight;
  }

  mergeListInto(race.defenses.resistances, grants.defenses?.resistances);
  mergeListInto(race.defenses.immunities, grants.defenses?.immunities);
  mergeListInto(race.defenses.conditionImmunities, grants.defenses?.conditionImmunities);
  mergeListInto(race.defenses.savingThrowAdvantages, grants.defenses?.savingThrowAdvantages);
};

const buildTags = (race: RaceStructuredData): string[] => {
  return dedupeStrings(
    [
      `kind:${race.kind}`,
      'source:srd51',
      race.basics.size ? `size:${slugifyRaceId(race.basics.size)}` : '',
      typeof race.basics.speedWalk === 'number' ? `speed:${race.basics.speedWalk}` : '',
      typeof race.senses.darkvision === 'number' ? `darkvision:${race.senses.darkvision}` : '',
      ...race.languages.granted.map((language) => `language:${slugifyRaceId(language)}`),
      Object.keys(race.abilities.bonuses).length > 0 || race.abilities.bonusChoice ? 'has:ability-bonus' : '',
      race.languages.choices ? 'has:language-choice' : '',
      race.proficiencies.toolChoices ? 'has:tool-choice' : '',
      race.proficiencies.weapons.length > 0 ? 'has:weapon-proficiency' : '',
      race.proficiencies.skillChoices ? 'has:skill-choice' : '',
      race.defenses.resistances.length > 0 ? 'has:resistance' : '',
      race.parentRaceId ? `parent:${race.parentRaceId}` : ''
    ].filter(Boolean)
  ).sort((left, right) => left.localeCompare(right));
};

export const extractRaceStructuredData = (entry: ExtractedRaceEntrySource): RaceStructuredData => {
  const race = createEmptyRaceData(entry);
  const split = splitTraitSections(entry);
  race.summary = split.intro ? summarizeRaceText(split.intro) : entry.summary;

  const sections =
    split.sections.length > 0
      ? split.sections
      : split.intro
        ? [
            {
              name: entry.kind === 'subrace' ? `${entry.name} Traits` : 'Traits',
              body: split.intro
            }
          ]
        : [];

  for (const section of sections) {
    const grants = parseTraitGrant(section.name, section.body);
    const trait: RaceStructuredData['traits'][number] = {
      id: slugifyRaceId(`${race.id}-${section.name}`),
      name: section.name,
      summary: summarizeTrait(section.name, section.body, grants),
      rulesText: section.body,
      grants
    };
    const category = categorizeTrait(section.name);
    if (category) {
      trait.category = category;
    }
    race.traits.push(trait);
    applyTraitToRace(race, section.name, section.body, grants);
  }

  race.tags = buildTags(race);
  return race;
};
