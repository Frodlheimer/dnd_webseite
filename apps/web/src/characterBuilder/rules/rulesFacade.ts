import { getAllFeats, getFeatMeta } from '../../rules/feats/api/featsData';
import { getLineageMeta } from '../../rules/lineages/api/lineagesData';
import { lineagesPackIndex } from '../../rules/lineages/generated/lineagesIndex';
import { spellsPack } from '../../rules/spells/generated/spellsPack';
import type { SpellMeta } from '../../rules/spells/types';
import { getSrdCategoryMetas, getSrdEntryDetail } from '../../rules/srd/api/srdData';
import {
  getAllClasses,
  getClassMeta,
  getGrantedSpellsForSubclass as getGrantedSpellsForSubclassFromClasses,
  getRulesEntryDetail,
  getRulesEntryMeta,
  getSpellSlotsForClassLevel as getSpellSlotsForClassLevelFromClasses,
  getSubclassesForClass
} from '../../rules/classes/api/classesData';
import type { RulesDocumentBlock } from '../../rules/classes/types';
import type { CharacterOriginMode } from '../model/character';
import { ABILITIES, type Ability } from '../model/character';
import type { DecisionOption } from '../model/decisions';

export type BuilderSkillName =
  | 'Acrobatics'
  | 'Animal Handling'
  | 'Arcana'
  | 'Athletics'
  | 'Deception'
  | 'History'
  | 'Insight'
  | 'Intimidation'
  | 'Investigation'
  | 'Medicine'
  | 'Nature'
  | 'Perception'
  | 'Performance'
  | 'Persuasion'
  | 'Religion'
  | 'Sleight of Hand'
  | 'Stealth'
  | 'Survival';

export type BuilderClassFeatureChoice = {
  id: string;
  source: 'class' | 'subclass';
  level: number;
  title: string;
  choiceCount: number;
  options: DecisionOption[];
  required: boolean;
};

export type BuilderEquipmentPackageOption = {
  id: string;
  label: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    source?: string;
    equipped?: boolean;
  }>;
};

export type BuilderEquipmentChoice = {
  id: string;
  title: string;
  choose: number;
  options: BuilderEquipmentPackageOption[];
};

export type BuilderClassSummary = {
  id: string;
  name: string;
  summary: string;
  hitDie?: string;
  primaryAbility?: string;
  savingThrows: Ability[];
  subclassLevelStart: number;
  spellcasting:
    | {
        casterType: 'FULL' | 'HALF' | 'THIRD' | 'PACT' | 'NONE';
        cantripsKnownByLevel?: number[];
        spellsKnownByLevel?: number[];
        preparedFormula?: string;
      }
    | undefined;
};

export type BuilderSubclassSummary = {
  id: string;
  classId: string;
  name: string;
  summary: string;
  subclassLevelStart: number;
};

export type BuilderRaceSummary = {
  id: string;
  name: string;
  sourceType: 'lineage' | 'srd_race';
  speedFeet: number | null;
  abilityBonuses: Partial<Record<Ability, number>>;
  choiceBonuses: {
    pick: number;
    amount: number;
    disallow?: Ability[];
  }[];
  languages: string[];
  toolChoices: string[];
  summary: string;
  grantedSpells: string[];
};

export type BuilderBackground = {
  id: string;
  name: string;
  summary: string;
  skillProficiencies: string[];
  toolProficiencies: string[];
  languageChoices: number;
  toolChoices: number;
  defaultEquipment: string[];
};

export type BuilderBackgroundAbilityOptions = {
  mode: CharacterOriginMode;
  chooseAbilities: number;
  allowedAbilities: Ability[];
  allowedPatterns: Array<'plus2_plus1' | 'plus1_plus1_plus1'>;
};

export type BuilderSpellSelectionLimits = {
  casterType: 'FULL' | 'HALF' | 'THIRD' | 'PACT' | 'NONE';
  isPreparedCaster: boolean;
  isKnownSpellsCaster: boolean;
  isSpellbookCaster: boolean;
  cantripsKnown: number | null;
  spellsKnown: number | null;
  preparedFormula: string | null;
  preparedMax: number | null;
};

type ClassAnalysis = {
  classSummary: BuilderClassSummary;
  skillChoiceCount: number;
  skillChoiceOptions: BuilderSkillName[];
  automaticArmorProficiencies: string[];
  automaticWeaponProficiencies: string[];
  automaticToolProficiencies: string[];
  equipmentChoices: BuilderEquipmentChoice[];
  goldAlternativeGp: number | null;
  featureChoicesByLevel: Record<number, BuilderClassFeatureChoice[]>;
};

const SKILL_NAMES: BuilderSkillName[] = [
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
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8
};

const ABILITY_BY_WORD: Record<string, Ability> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
  str: 'str',
  dex: 'dex',
  con: 'con',
  int: 'int',
  wis: 'wis',
  cha: 'cha'
};

const COMMON_LANGUAGE_POOL = [
  'Common',
  'Dwarvish',
  'Elvish',
  'Gnomish',
  'Goblin',
  'Halfling',
  'Orc',
  'Draconic',
  'Sylvan',
  'Infernal',
  'Celestial',
  'Primordial',
  'Abyssal',
  'Undercommon',
  'Giant'
];

const STATIC_BACKGROUNDS: BuilderBackground[] = [
  {
    id: 'acolyte',
    name: 'Acolyte',
    summary: 'Raised in service to a temple or spiritual tradition.',
    skillProficiencies: ['Insight', 'Religion'],
    toolProficiencies: [],
    languageChoices: 2,
    toolChoices: 0,
    defaultEquipment: [
      'Holy symbol',
      'Prayer book or wheel',
      '5 sticks of incense',
      'Vestments',
      'Common clothes',
      '15 gp'
    ]
  },
  {
    id: 'criminal',
    name: 'Criminal',
    summary: 'Experienced with illicit work and underworld contacts.',
    skillProficiencies: ['Deception', 'Stealth'],
    toolProficiencies: ['Thieves tools', 'Gaming set'],
    languageChoices: 0,
    toolChoices: 0,
    defaultEquipment: ['Crowbar', 'Dark common clothes with hood', '15 gp']
  },
  {
    id: 'sage',
    name: 'Sage',
    summary: 'Academic background focused on lore and research.',
    skillProficiencies: ['Arcana', 'History'],
    toolProficiencies: [],
    languageChoices: 2,
    toolChoices: 0,
    defaultEquipment: [
      'Bottle of ink',
      'Quill',
      'Small knife',
      'Letter from dead colleague',
      'Common clothes',
      '10 gp'
    ]
  },
  {
    id: 'soldier',
    name: 'Soldier',
    summary: 'Military training and battlefield experience.',
    skillProficiencies: ['Athletics', 'Intimidation'],
    toolProficiencies: ['Gaming set', 'Vehicles (land)'],
    languageChoices: 0,
    toolChoices: 0,
    defaultEquipment: ['Insignia of rank', 'Trophy from fallen enemy', 'Dice set or cards', 'Common clothes', '10 gp']
  }
];

const classAnalysisCache = new Map<string, Promise<ClassAnalysis | null>>();
const classDetailCache = new Map<string, Promise<Awaited<ReturnType<typeof getRulesEntryDetail>>>>();
const srdRaceDetailCache = new Map<string, Promise<Awaited<ReturnType<typeof getSrdEntryDetail>>>>();

const normalize = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const slugify = (value: string): string => {
  return normalize(value).replace(/\s+/g, '-');
};

const titleCase = (value: string): string => {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
};

const parseNumberToken = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }
  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  const lowered = value.toLowerCase();
  return NUMBER_WORDS[lowered] ?? null;
};

const parseAbilityFromText = (value: string): Ability | null => {
  const folded = normalize(value);
  for (const [token, ability] of Object.entries(ABILITY_BY_WORD)) {
    if (folded.includes(token)) {
      return ability;
    }
  }
  return null;
};

const parseSavingThrows = (value: string[] | undefined): Ability[] => {
  if (!value || value.length === 0) {
    return [];
  }
  const out = new Set<Ability>();
  value.forEach((entry) => {
    const ability = parseAbilityFromText(entry);
    if (ability) {
      out.add(ability);
    }
  });
  return [...out];
};

const parseListAfterKeyword = (text: string, keyword: string): string[] => {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escapedKeyword}:\\s*([^\\n]+)`, 'i');
  const match = text.match(regex);
  if (!match?.[1]) {
    return [];
  }
  return match[1]
    .replace(/\band\b/gi, ',')
    .split(',')
    .map((entry) => titleCase(entry.trim()))
    .filter((entry) => entry.length > 0 && entry !== 'None');
};

const parseClassProficiencyDetails = (text: string): { armor: string[]; weapons: string[]; tools: string[] } => {
  if (!text) {
    return {
      armor: [],
      weapons: [],
      tools: []
    };
  }
  return {
    armor: parseListAfterKeyword(text, 'Armor'),
    weapons: parseListAfterKeyword(text, 'Weapons'),
    tools: parseListAfterKeyword(text, 'Tools')
  };
};

const toPlainText = (blocks: RulesDocumentBlock[]): string => {
  return blocks
    .map((block) => {
      if ('text' in block) {
        return block.text;
      }
      if (block.type === 'ul' || block.type === 'ol') {
        return block.items.join(' ');
      }
      if (block.type === 'table') {
        return block.rows.flat().join(' ');
      }
      if (block.type === 'pre') {
        return block.lines.join(' ');
      }
      return '';
    })
    .join('\n');
};

const parseSkillChoiceFromBlocks = (blocks: RulesDocumentBlock[]): { count: number; skills: BuilderSkillName[] } => {
  const plainText = toPlainText(blocks);
  const match = plainText.match(/skills?:\s*choose\s+(\w+)\s+skills?\s+from\s+([^.\n]+)/i);
  if (!match?.[1] || !match[2]) {
    return {
      count: 0,
      skills: []
    };
  }

  const count = parseNumberToken(match[1]) ?? 0;
  const candidates = match[2]
    .replace(/\band\b/gi, ',')
    .split(',')
    .map((entry) => titleCase(entry.trim()))
    .filter(Boolean);
  return {
    count,
    skills: SKILL_NAMES.filter((entry) => candidates.includes(entry))
  };
};

const parseEquipmentItemsFromOption = (text: string): BuilderEquipmentPackageOption['items'] => {
  const chunks = text
    .replace(/\(([^)]*)\)/g, '')
    .replace(/\band\b/gi, ',')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return chunks.map((chunk, index) => {
    const quantityMatch = chunk.match(/^(\d+)\s+(.+)/);
    if (quantityMatch?.[1] && quantityMatch[2]) {
      return {
        id: `item-${slugify(quantityMatch[2])}-${index}`,
        name: titleCase(quantityMatch[2]),
        quantity: Number.parseInt(quantityMatch[1], 10),
        source: 'class_starting_equipment',
        equipped: false
      };
    }
    return {
      id: `item-${slugify(chunk)}-${index}`,
      name: titleCase(chunk),
      quantity: 1,
      source: 'class_starting_equipment',
      equipped: false
    };
  });
};

const parseEquipmentChoicesFromBlocks = (
  blocks: RulesDocumentBlock[]
): { choices: BuilderEquipmentChoice[]; goldAlternativeGp: number | null } => {
  const choices: BuilderEquipmentChoice[] = [];
  const plainText = toPlainText(blocks);

  let goldAlternativeGp: number | null = null;
  const goldMatch =
    plainText.match(/(\d+)d(\d+)\s*[x*]\s*(\d+)\s*gp/i) ??
    plainText.match(/(?:alternatively|instead)[^.]{0,120}(\d+)\s*gp/i);
  if (goldMatch?.[1]) {
    if (goldMatch.length >= 4 && goldMatch[2] && goldMatch[3]) {
      const diceCount = Number.parseInt(goldMatch[1], 10);
      const diceSize = Number.parseInt(goldMatch[2], 10);
      const multiplier = Number.parseInt(goldMatch[3], 10);
      goldAlternativeGp = Math.floor(((diceCount * (diceSize + 1)) / 2) * multiplier);
    } else {
      goldAlternativeGp = Number.parseInt(goldMatch[1], 10);
    }
  }

  const listItems = blocks
    .filter(
      (
        block
      ): block is Extract<RulesDocumentBlock, { type: 'ul' | 'ol'; items: string[] }> =>
        block.type === 'ul' || block.type === 'ol'
    )
    .flatMap((block) => block.items);

  listItems.forEach((item, index) => {
    const optionMatches = [...item.matchAll(/\(([a-z])\)\s*([^()]+?)(?=(?:\s*or\s*\([a-z]\)\s*)|$)/gi)];
    if (optionMatches.length <= 1) {
      return;
    }

    const options: BuilderEquipmentPackageOption[] = optionMatches
      .map((match, optionIndex) => {
        const optionText = (match[2] ?? '').trim();
        if (!optionText) {
          return null;
        }
        return {
          id: `equipment-choice-${index}-option-${optionIndex}`,
          label: optionText,
          items: parseEquipmentItemsFromOption(optionText)
        } satisfies BuilderEquipmentPackageOption;
      })
      .filter((entry): entry is BuilderEquipmentPackageOption => !!entry);

    if (options.length < 2) {
      return;
    }

    choices.push({
      id: `equipment-choice-${index}`,
      title: `Starting equipment ${index + 1}`,
      choose: 1,
      options
    });
  });

  return {
    choices,
    goldAlternativeGp: Number.isFinite(goldAlternativeGp) ? goldAlternativeGp : null
  };
};

const guessFeatureLevelFromContext = (heading: string, previousText: string): number | null => {
  const headingMatch = heading.match(/(\d+)(?:st|nd|rd|th)\s*level/i);
  if (headingMatch?.[1]) {
    const parsed = Number.parseInt(headingMatch[1], 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const contextMatch = previousText.match(/(?:at|starting at|when you reach)\s+(\d+)(?:st|nd|rd|th)\s+level/i);
  if (contextMatch?.[1]) {
    const parsed = Number.parseInt(contextMatch[1], 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseFeatureChoicesFromBlocks = (
  blocks: RulesDocumentBlock[],
  source: 'class' | 'subclass'
): Record<number, BuilderClassFeatureChoice[]> => {
  const byLevel: Record<number, BuilderClassFeatureChoice[]> = {};
  let currentHeading = '';
  let previousParagraph = '';

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (!block) {
      continue;
    }

    if (
      block.type === 'h1' ||
      block.type === 'h2' ||
      block.type === 'h3' ||
      block.type === 'h4' ||
      block.type === 'h5' ||
      block.type === 'h6'
    ) {
      currentHeading = block.text.trim();
      previousParagraph = '';
      continue;
    }

    if (block.type !== 'p') {
      continue;
    }

    previousParagraph = block.text;
    const choiceMatch =
      block.text.match(/choose\s+(\w+)\s+of\s+the\s+following/i) ??
      block.text.match(/choose\s+one\s+of\s+the\s+following/i);
    if (!choiceMatch) {
      continue;
    }

    const count = choiceMatch[1] ? parseNumberToken(choiceMatch[1]) ?? 1 : 1;
    const options: DecisionOption[] = [];

    for (let lookahead = index + 1; lookahead < blocks.length; lookahead += 1) {
      const candidate = blocks[lookahead];
      if (!candidate) {
        break;
      }
      if (
        candidate.type === 'h1' ||
        candidate.type === 'h2' ||
        candidate.type === 'h3' ||
        candidate.type === 'h4' ||
        candidate.type === 'h5' ||
        candidate.type === 'h6'
      ) {
        break;
      }
      if (candidate.type === 'ul' || candidate.type === 'ol') {
        candidate.items.forEach((item, itemIndex) => {
          const label = item
            .replace(/\([^)]+\)/g, '')
            .replace(/\.\s.+$/, '')
            .trim();
          if (!label) {
            return;
          }
          options.push({
            id: `${slugify(currentHeading || 'feature-choice')}-${itemIndex}-${slugify(label)}`,
            label
          });
        });
        if (options.length > 0) {
          break;
        }
      }
    }

    if (options.length === 0) {
      continue;
    }

    const level = guessFeatureLevelFromContext(currentHeading, previousParagraph) ?? 1;
    const row: BuilderClassFeatureChoice = {
      id: `${source}-${slugify(currentHeading || `feature-${index}`)}-${level}`,
      source,
      level,
      title: currentHeading || 'Feature choice',
      choiceCount: Math.max(1, count),
      options,
      required: true
    };
    if (!byLevel[level]) {
      byLevel[level] = [];
    }
    byLevel[level].push(row);
  }

  return byLevel;
};

const parseSubclassLevelFromClassMeta = (classId: string): number => {
  const classMeta = getClassMeta(classId);
  if (!classMeta) {
    return 3;
  }

  if (typeof classMeta.quick.subclassLevelStart === 'number' && classMeta.quick.subclassLevelStart > 0) {
    return classMeta.quick.subclassLevelStart;
  }

  const featureEntries = Object.entries(classMeta.quick.featuresByLevel ?? {})
    .map(([level, features]) => ({
      level: Number.parseInt(level, 10),
      features
    }))
    .filter((entry) => Number.isFinite(entry.level));
  const pattern = /archetype|subclass|domain|college|circle|oath|conclave|patron|bloodline|tradition|origin|school/i;
  const fromFeature = featureEntries
    .filter((entry) => entry.features.some((feature) => pattern.test(feature)))
    .sort((a, b) => a.level - b.level)[0];
  if (fromFeature) {
    return fromFeature.level;
  }

  const fromSubclasses = getSubclassesForClass(classId)
    .map((meta) => meta.quick.subclassLevelStart)
    .filter((value): value is number => typeof value === 'number' && value > 0)
    .sort((a, b) => a - b)[0];
  return fromSubclasses ?? 3;
};

const getClassDetailCached = (classOrSubclassId: string) => {
  if (classDetailCache.has(classOrSubclassId)) {
    return classDetailCache.get(classOrSubclassId)!;
  }
  const promise = getRulesEntryDetail(classOrSubclassId);
  classDetailCache.set(classOrSubclassId, promise);
  return promise;
};

const getSrdRaceDetailCached = (raceId: string) => {
  if (srdRaceDetailCache.has(raceId)) {
    return srdRaceDetailCache.get(raceId)!;
  }
  const promise = getSrdEntryDetail('races', raceId);
  srdRaceDetailCache.set(raceId, promise);
  return promise;
};

const buildClassSummary = async (classId: string): Promise<BuilderClassSummary | null> => {
  const meta = getClassMeta(classId);
  if (!meta) {
    return null;
  }

  const detail = await getClassDetailCached(classId);
  const summary: BuilderClassSummary = {
    id: meta.id,
    name: meta.name,
    summary: meta.summary,
    savingThrows: parseSavingThrows(detail?.extracted.savingThrows),
    subclassLevelStart: parseSubclassLevelFromClassMeta(classId),
    spellcasting: undefined
  };
  if (detail?.extracted.hitDie) {
    summary.hitDie = detail.extracted.hitDie;
  }
  if (detail?.extracted.primaryAbility) {
    summary.primaryAbility = detail.extracted.primaryAbility;
  }
  if (detail?.extracted.spellcasting) {
    const casting = detail.extracted.spellcasting;
    summary.spellcasting = {
      casterType: casting.casterType ?? 'NONE'
    };
    if (casting.cantripsKnownByLevel) {
      summary.spellcasting.cantripsKnownByLevel = casting.cantripsKnownByLevel;
    }
    if (casting.spellsKnownByLevel) {
      summary.spellcasting.spellsKnownByLevel = casting.spellsKnownByLevel;
    }
    if (casting.preparedFormula) {
      summary.spellcasting.preparedFormula = casting.preparedFormula;
    }
  }
  return summary;
};

const analyzeClass = async (classId: string): Promise<ClassAnalysis | null> => {
  if (classAnalysisCache.has(classId)) {
    return classAnalysisCache.get(classId)!;
  }

  const promise = (async () => {
    const classSummary = await buildClassSummary(classId);
    if (!classSummary) {
      return null;
    }

    const detail = await getClassDetailCached(classId);
    const blocks = detail?.documentBlocks ?? [];
    const skillChoice = parseSkillChoiceFromBlocks(blocks);
    const parsedProficiencies = parseClassProficiencyDetails(detail?.extracted.armorWeaponProficiencies ?? '');
    const equipment = parseEquipmentChoicesFromBlocks(blocks);
    const featureChoices = parseFeatureChoicesFromBlocks(blocks, 'class');

    return {
      classSummary,
      skillChoiceCount: skillChoice.count,
      skillChoiceOptions: skillChoice.skills,
      automaticArmorProficiencies: parsedProficiencies.armor,
      automaticWeaponProficiencies: parsedProficiencies.weapons,
      automaticToolProficiencies: parsedProficiencies.tools,
      equipmentChoices: equipment.choices,
      goldAlternativeGp: equipment.goldAlternativeGp,
      featureChoicesByLevel: featureChoices
    } satisfies ClassAnalysis;
  })();

  classAnalysisCache.set(classId, promise);
  return promise;
};

const parseAbilityIncreaseText = (text: string): {
  fixed: Partial<Record<Ability, number>>;
  choice: Array<{ pick: number; amount: number; disallow?: Ability[] }>;
} => {
  const normalizedText = normalize(text);
  const fixed: Partial<Record<Ability, number>> = {};
  const choice: Array<{ pick: number; amount: number; disallow?: Ability[] }> = [];

  for (const [token, ability] of Object.entries(ABILITY_BY_WORD)) {
    const match = normalizedText.match(new RegExp(`${token}\\s+score(?:s)?\\s+increase(?:s)?\\s+by\\s+(\\d+)`, 'i'));
    if (!match?.[1]) {
      continue;
    }
    const amount = Number.parseInt(match[1], 10);
    if (Number.isFinite(amount)) {
      fixed[ability] = amount;
    }
  }

  if (/ability scores each increase by 1/i.test(normalizedText)) {
    ABILITIES.forEach((ability) => {
      fixed[ability] = 1;
    });
  }

  if (/two other ability scores of your choice increase by 1/i.test(normalizedText)) {
    choice.push({
      pick: 2,
      amount: 1,
      disallow: ['cha']
    });
  }

  return {
    fixed,
    choice
  };
};

const parseLanguages = (text: string): string[] => {
  const normalizedText = text.replace(/[.,]/g, ' ');
  const found = COMMON_LANGUAGE_POOL.filter((language) => {
    const escaped = language.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(normalizedText);
  });
  return [...new Set(found)];
};

const buildSrdRaceSummary = async (raceMetaId: string): Promise<BuilderRaceSummary | null> => {
  const meta = getSrdCategoryMetas('races').find((entry) => entry.id === raceMetaId);
  if (!meta) {
    return null;
  }

  const detail = await getSrdRaceDetailCached(raceMetaId);
  const asiText = detail?.extra.abilityScoreIncrease ?? '';
  const parsedAsi = parseAbilityIncreaseText(asiText);
  const speedMatch = (detail?.extra.raceSpeed ?? detail?.summary ?? '').match(/(\d+)\s*feet/i);
  const speedFeet = speedMatch?.[1] ? Number.parseInt(speedMatch[1], 10) : null;
  const languages = parseLanguages(detail?.extra.raceLanguages ?? detail?.summary ?? '');
  return {
    id: `srd:${meta.id}`,
    name: meta.title,
    sourceType: 'srd_race',
    speedFeet: Number.isFinite(speedFeet) ? speedFeet : null,
    abilityBonuses: parsedAsi.fixed,
    choiceBonuses: parsedAsi.choice,
    languages,
    toolChoices: [],
    summary: meta.summary,
    grantedSpells: []
  };
};

const buildLineageSummary = (lineageId: string): BuilderRaceSummary | null => {
  const meta = getLineageMeta(lineageId);
  if (!meta) {
    return null;
  }
  const languages = parseLanguages(meta.quickFacts.languages ?? '');
  return {
    id: `lineage:${meta.id}`,
    name: meta.name,
    sourceType: 'lineage',
    speedFeet: meta.quickFacts.speedFeet ?? null,
    abilityBonuses: {},
    choiceBonuses: [],
    languages,
    toolChoices: [],
    summary: meta.summary,
    grantedSpells: []
  };
};

const findSpellSlugByName = (name: string): string | null => {
  const folded = normalize(name);
  const match = spellsPack.metas.find((meta) => normalize(meta.name) === folded);
  return match?.slug ?? null;
};

const getClassSpells = (classId: string): SpellMeta[] => {
  const classMeta = getClassMeta(classId);
  if (!classMeta) {
    return [];
  }
  const foldedName = normalize(classMeta.name);
  return spellsPack.metas.filter((meta) => meta.classes.some((entry) => normalize(entry) === foldedName));
};

const computePreparedMax = (level: number, abilityMod: number, formula: string | null): number | null => {
  if (!formula) {
    return null;
  }
  const normalizedFormula = normalize(formula);
  if (/level/.test(normalizedFormula) || /mod/.test(normalizedFormula) || /modifier/.test(normalizedFormula)) {
    return Math.max(1, level + abilityMod);
  }
  return null;
};

const PREPARED_CASTER_CLASS_IDS = new Set(['artificer', 'cleric', 'druid', 'paladin', 'wizard']);

const getFallbackPreparedFormula = (classId: string): string | null => {
  return PREPARED_CASTER_CLASS_IDS.has(classId) ? 'level + spellcasting ability modifier' : null;
};

export const rulesFacade = {
  listPlayableClasses(): BuilderClassSummary[] {
    return getAllClasses()
      .map((meta) => {
        const entry: BuilderClassSummary = {
          id: meta.id,
          name: meta.name,
          summary: meta.summary,
          savingThrows: [],
          subclassLevelStart: parseSubclassLevelFromClassMeta(meta.id),
          spellcasting: undefined
        };
        if (meta.quick.casterType) {
          entry.spellcasting = {
            casterType: meta.quick.casterType
          };
        }
        return entry;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async getClassById(id: string): Promise<BuilderClassSummary | null> {
    const analysis = await analyzeClass(id);
    return analysis?.classSummary ?? null;
  },

  listSubclassesForClass(classId: string, level?: number): BuilderSubclassSummary[] {
    return getSubclassesForClass(classId)
      .map((meta) => ({
        id: meta.id,
        classId: meta.classId,
        name: meta.name,
        summary: meta.summary,
        subclassLevelStart: meta.quick.subclassLevelStart ?? parseSubclassLevelFromClassMeta(classId)
      }))
      .filter((entry) => (typeof level === 'number' ? level >= entry.subclassLevelStart : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async listRacesOrSpecies(sourceMode: CharacterOriginMode): Promise<BuilderRaceSummary[]> {
    if (sourceMode === 'LEGACY_RACE') {
      const metas = getSrdCategoryMetas('races');
      const results = await Promise.all(metas.map((meta) => buildSrdRaceSummary(meta.id)));
      return results.filter((entry): entry is BuilderRaceSummary => !!entry).sort((a, b) => a.name.localeCompare(b.name));
    }

    return lineagesPackIndex.entriesMeta
      .map((entry) => buildLineageSummary(entry.id))
      .filter((entry): entry is BuilderRaceSummary => !!entry)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async getRaceById(id: string): Promise<BuilderRaceSummary | null> {
    if (id.startsWith('lineage:')) {
      return buildLineageSummary(id.slice('lineage:'.length));
    }
    if (id.startsWith('srd:')) {
      return await buildSrdRaceSummary(id.slice('srd:'.length));
    }
    if (getLineageMeta(id)) {
      return buildLineageSummary(id);
    }
    return await buildSrdRaceSummary(id);
  },

  listBackgrounds(): BuilderBackground[] {
    return [...STATIC_BACKGROUNDS];
  },

  getBackgroundById(id: string): BuilderBackground | null {
    return STATIC_BACKGROUNDS.find((entry) => entry.id === id) ?? null;
  },

  listFeats() {
    return getAllFeats().sort((a, b) => a.name.localeCompare(b.name));
  },

  getFeatById(id: string) {
    return getFeatMeta(id);
  },

  listSpellsByClass(classId: string): SpellMeta[] {
    return getClassSpells(classId);
  },

  getSpellById(slug: string) {
    return spellsPack.detailsBySlug[slug] ?? null;
  },

  async getEquipmentOptionsForClass(classId: string): Promise<{
    packageChoices: BuilderEquipmentChoice[];
    goldAlternativeGp: number | null;
  }> {
    const analysis = await analyzeClass(classId);
    return {
      packageChoices: analysis?.equipmentChoices ?? [],
      goldAlternativeGp: analysis?.goldAlternativeGp ?? null
    };
  },

  getAsiLevelsForClass(classId: string): number[] {
    const classMeta = getClassMeta(classId);
    if (!classMeta?.quick.featuresByLevel) {
      if (classId === 'fighter') {
        return [4, 6, 8, 12, 14, 16, 19];
      }
      if (classId === 'rogue') {
        return [4, 8, 10, 12, 16, 19];
      }
      return [4, 8, 12, 16, 19];
    }

    const levels = Object.entries(classMeta.quick.featuresByLevel)
      .map(([level, features]) => ({
        level: Number.parseInt(level, 10),
        hasAsi: features.some((feature) => /ability score improvement/i.test(feature))
      }))
      .filter((entry) => Number.isFinite(entry.level) && entry.hasAsi)
      .map((entry) => entry.level)
      .sort((a, b) => a - b);
    if (levels.length > 0) {
      return levels;
    }

    if (classId === 'fighter') {
      return [4, 6, 8, 12, 14, 16, 19];
    }
    if (classId === 'rogue') {
      return [4, 8, 10, 12, 16, 19];
    }
    return [4, 8, 12, 16, 19];
  },

  getSpellSlotsForClassLevel(classId: string, level: number): number[] | null {
    return getSpellSlotsForClassLevelFromClasses(classId, level);
  },

  async getKnownSpellLimitsForClassLevel(args: {
    classId: string;
    level: number;
    abilityMod: number;
  }): Promise<BuilderSpellSelectionLimits> {
    const classSummary = await this.getClassById(args.classId);
    const casterType = classSummary?.spellcasting?.casterType ?? 'NONE';
    const cantripsKnown = classSummary?.spellcasting?.cantripsKnownByLevel?.[Math.max(0, args.level - 1)] ?? null;
    const spellsKnown = classSummary?.spellcasting?.spellsKnownByLevel?.[Math.max(0, args.level - 1)] ?? null;
    const preparedFormula =
      classSummary?.spellcasting?.preparedFormula ?? getFallbackPreparedFormula(args.classId);
    const preparedMax = computePreparedMax(args.level, args.abilityMod, preparedFormula);
    const isKnownSpellsCaster = Boolean(spellsKnown && spellsKnown > 0);
    const isPreparedCaster = preparedFormula !== null && !isKnownSpellsCaster;
    const isSpellbookCaster = args.classId === 'wizard';
    return {
      casterType,
      isPreparedCaster,
      isKnownSpellsCaster,
      isSpellbookCaster,
      cantripsKnown,
      spellsKnown,
      preparedFormula,
      preparedMax
    };
  },

  async getPreparedSpellFormulaForClass(classId: string): Promise<{ formula: string | null; ability: Ability | null }> {
    const summary = await this.getClassById(classId);
    const formula = summary?.spellcasting?.preparedFormula ?? getFallbackPreparedFormula(classId);
    const ability = parseAbilityFromText(formula ?? '') ?? parseAbilityFromText(summary?.primaryAbility ?? '');
    return {
      formula,
      ability
    };
  },

  async getClassSkillChoice(classId: string): Promise<{ choose: number; options: BuilderSkillName[] }> {
    const analysis = await analyzeClass(classId);
    return {
      choose: analysis?.skillChoiceCount ?? 0,
      options: analysis?.skillChoiceOptions ?? []
    };
  },

  async getAutomaticClassProficiencies(classId: string): Promise<{ armor: string[]; weapons: string[]; tools: string[] }> {
    const analysis = await analyzeClass(classId);
    return {
      armor: analysis?.automaticArmorProficiencies ?? [],
      weapons: analysis?.automaticWeaponProficiencies ?? [],
      tools: analysis?.automaticToolProficiencies ?? []
    };
  },

  async getClassFeatureChoicesAtLevel(
    classId: string,
    subclassId: string | null,
    level: number
  ): Promise<BuilderClassFeatureChoice[]> {
    const analysis = await analyzeClass(classId);
    const classChoices = Object.entries(analysis?.featureChoicesByLevel ?? {})
      .filter(([choiceLevel]) => Number.parseInt(choiceLevel, 10) <= level)
      .flatMap(([, rows]) => rows);

    let subclassChoices: BuilderClassFeatureChoice[] = [];
    if (subclassId) {
      const detail = await getClassDetailCached(subclassId);
      if (detail) {
        const parsed = parseFeatureChoicesFromBlocks(detail.documentBlocks, 'subclass');
        subclassChoices = Object.entries(parsed)
          .filter(([choiceLevel]) => Number.parseInt(choiceLevel, 10) <= level)
          .flatMap(([, rows]) => rows);
      }
    }

    return [...classChoices, ...subclassChoices];
  },

  getGrantedSpellsForSubclass(subclassId: string, level: number): string[] {
    const granted = new Set<string>();
    for (let currentLevel = 1; currentLevel <= level; currentLevel += 1) {
      const refs = getGrantedSpellsForSubclassFromClasses(subclassId, currentLevel);
      refs.forEach((ref) => {
        if (ref.slug) {
          granted.add(ref.slug);
          return;
        }
        const guessed = findSpellSlugByName(ref.name);
        if (guessed) {
          granted.add(guessed);
        }
      });
    }
    return [...granted];
  },

  async getGrantedSpellsForBackgroundOrRace(args: {
    backgroundId: string | null;
    raceId: string | null;
  }): Promise<string[]> {
    const granted = new Set<string>();
    if (args.raceId) {
      const race = await this.getRaceById(args.raceId);
      race?.grantedSpells.forEach((spellSlug) => granted.add(spellSlug));
    }
    if (args.backgroundId) {
      const background = this.getBackgroundById(args.backgroundId);
      void background;
    }
    return [...granted];
  },

  getBackgroundAbilityOptions(
    backgroundId: string | null,
    sourceMode: CharacterOriginMode
  ): BuilderBackgroundAbilityOptions {
    const background = backgroundId ? this.getBackgroundById(backgroundId) : null;
    void background;
    if (sourceMode === 'LEGACY_RACE') {
      return {
        mode: sourceMode,
        chooseAbilities: 0,
        allowedAbilities: [...ABILITIES],
        allowedPatterns: []
      };
    }
    return {
      mode: sourceMode,
      chooseAbilities: 3,
      allowedAbilities: [...ABILITIES],
      allowedPatterns: ['plus2_plus1', 'plus1_plus1_plus1']
    };
  },

  findClassName(classId: string): string | null {
    return getClassMeta(classId)?.name ?? null;
  },

  findSubclassName(subclassId: string): string | null {
    return getRulesEntryMeta(subclassId)?.name ?? null;
  },

  async findRaceName(raceId: string | null): Promise<string | null> {
    if (!raceId) {
      return null;
    }
    const race = await this.getRaceById(raceId);
    return race?.name ?? null;
  }
};

export const classSkillToAbility: Record<BuilderSkillName, Ability> = {
  Acrobatics: 'dex',
  'Animal Handling': 'wis',
  Arcana: 'int',
  Athletics: 'str',
  Deception: 'cha',
  History: 'int',
  Insight: 'wis',
  Intimidation: 'cha',
  Investigation: 'int',
  Medicine: 'wis',
  Nature: 'int',
  Perception: 'wis',
  Performance: 'cha',
  Persuasion: 'cha',
  Religion: 'int',
  'Sleight of Hand': 'dex',
  Stealth: 'dex',
  Survival: 'wis'
};
