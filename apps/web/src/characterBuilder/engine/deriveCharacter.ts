import {
  BASE_SCORE_MAX,
  BASE_SCORE_MIN,
  calculatePointBuy,
  getModifierForScore
} from '../pointBuy/rules';
import type { AbilityMap as PointBuyAbilityMap } from '../pointBuy/types';
import type { SpellMeta } from '../../rules/spells/types';
import type { CharacterRecord } from '../model/character';
import {
  ABILITIES,
  createEmptyCharacter,
  getOriginModeForRuleset,
  getSourceScopeForRuleset,
  type Ability
} from '../model/character';
import { backgroundRulesFacade } from '../rules/backgroundRulesFacade';
import { raceRulesFacade } from '../rules/raceRulesFacade';
import { resolveCharacterBuildStatus } from './completion';
import { buildPendingDecisions } from './pendingDecisions';
import { buildValidationIssues } from './validation';
import { rulesFacade, type BuilderClassFeatureChoice } from '../rules/rulesFacade';

type DerivedAbilityState = {
  pointBuyErrors: string[];
  base: Record<Ability, number>;
  bonus: Partial<Record<Ability, number>>;
  featAndAsiBonus: Partial<Record<Ability, number>>;
  finalScores: Record<Ability, number>;
  mods: Record<Ability, number>;
};

type CombatDerivation = {
  armorClass: number | null;
  hitPointsMax: number | null;
  initiative: number;
  passivePerception: number;
  speed: number | null;
};

type SpellDerivation = {
  spellSlots: number[] | null;
  maxSpellLevel: number;
  availableSpellSlugs: Set<string>;
  selectedCantrips: string[];
  selectedKnownSpells: string[];
  preparedSpells: string[];
  grantedSpells: string[];
};

export type DerivedCharacterRuntime = {
  classSkillChoice: {
    choose: number;
    options: string[];
  };
  origin: {
    availableSubraces: Array<{
      id: string;
      name: string;
      summary: string;
    }>;
    raceLanguageChoices: number;
    raceLanguageOptions: string[];
    raceToolChoices: number;
    raceToolOptions: string[];
    raceSkillChoices: number;
    raceSkillOptions: string[];
    raceAbilityBonusChoice: {
      choose: number;
      amount: number;
      from: Ability[];
    } | null;
    backgroundLanguageChoices: number;
    backgroundLanguageOptions: string[];
    backgroundToolChoices: number;
    backgroundToolOptions: string[];
    backgroundSkillChoices: number;
    backgroundSkillOptions: string[];
  };
  featureChoices: BuilderClassFeatureChoice[];
  equipmentChoices: Awaited<ReturnType<typeof rulesFacade.getEquipmentOptionsForClass>>['packageChoices'];
  spellLimits: Awaited<ReturnType<typeof rulesFacade.getKnownSpellLimitsForClassLevel>>;
  availableSpells: Array<{
    slug: string;
    name: string;
    level: number;
    source: string;
  }>;
  maxSpellLevel: number;
  subclassRequired: boolean;
  asiLevels: number[];
};

export type DeriveCharacterResult = {
  character: CharacterRecord;
  runtime: DerivedCharacterRuntime;
};

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const normalizeComparisonKey = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[â€™’]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

const collectOverlapLabels = (values: string[], against: string[]): string[] => {
  const againstKeys = new Set(against.map((entry) => normalizeComparisonKey(entry)).filter(Boolean));
  return unique(
    values.filter((entry) => {
      const key = normalizeComparisonKey(entry);
      return key.length > 0 && againstKeys.has(key);
    })
  );
};

const sumAbilityMap = (values: Partial<Record<Ability, number>>): number => {
  return ABILITIES.reduce((acc, ability) => acc + (values[ability] ?? 0), 0);
};

const defaultAbilityMap = (value: number): Record<Ability, number> => {
  return {
    str: value,
    dex: value,
    con: value,
    int: value,
    wis: value,
    cha: value
  };
};

const clampBaseScores = (input: Record<Ability, number>): Record<Ability, number> => {
  const output = defaultAbilityMap(BASE_SCORE_MIN);
  ABILITIES.forEach((ability) => {
    const value = input[ability] ?? BASE_SCORE_MIN;
    const normalized = Number.isFinite(value) ? Math.trunc(value) : BASE_SCORE_MIN;
    output[ability] = Math.max(BASE_SCORE_MIN, Math.min(BASE_SCORE_MAX, normalized));
  });
  return output;
};

const toPointBuyMap = (input: Record<Ability, number>): PointBuyAbilityMap => {
  return {
    STR: input.str,
    DEX: input.dex,
    CON: input.con,
    INT: input.int,
    WIS: input.wis,
    CHA: input.cha
  };
};

const deriveBackgroundBonuses = (character: CharacterRecord): Partial<Record<Ability, number>> => {
  if (character.origin.mode !== 'SRD_5_2_BACKGROUND') {
    return {};
  }

  const fromAssignments = character.origin.backgroundBonusAssignments ?? {};
  if (sumAbilityMap(fromAssignments) > 0) {
    return fromAssignments;
  }

  const triplet = character.origin.selectedBackgroundAbilityTriplet ?? ['str', 'dex', 'con'];
  const pattern = character.origin.backgroundBonusPattern ?? 'plus2_plus1';
  if (pattern === 'plus1_plus1_plus1') {
    const output: Partial<Record<Ability, number>> = {};
    triplet.forEach((ability) => {
      output[ability] = 1;
    });
    return output;
  }

  const output: Partial<Record<Ability, number>> = {};
  if (triplet[0]) {
    output[triplet[0]] = 2;
  }
  if (triplet[1]) {
    output[triplet[1]] = 1;
  }
  return output;
};

const deriveAsiAndFeatBonuses = async (character: CharacterRecord): Promise<Partial<Record<Ability, number>>> => {
  const output: Partial<Record<Ability, number>> = {};

  for (const opportunity of character.featsAndAsi.opportunities) {
    if (opportunity.level > character.progression.level) {
      continue;
    }

    if (opportunity.choice.kind === 'ASI') {
      const asiChoice = opportunity.choice;
      ABILITIES.forEach((ability) => {
        const amount = asiChoice.increases[ability] ?? 0;
        if (amount > 0) {
          output[ability] = (output[ability] ?? 0) + amount;
        }
      });
      continue;
    }

    if (opportunity.choice.kind !== 'FEAT' || !opportunity.choice.featId) {
      continue;
    }

    const feat = rulesFacade.getFeatById(opportunity.choice.featId);
    if (!feat || feat.quickFacts.abilityIncrease.amount <= 0) {
      continue;
    }

    const amount = feat.quickFacts.abilityIncrease.amount;
    if (feat.quickFacts.abilityIncrease.mode === 'FIXED') {
      const fixedAbility = feat.quickFacts.abilityIncrease.abilities[0];
      if (fixedAbility && fixedAbility !== 'ALL') {
        const key = fixedAbility.toLowerCase() as Ability;
        output[key] = (output[key] ?? 0) + amount;
      }
      continue;
    }

    const featChoice = opportunity.choice;
    const assignments = featChoice.bonusAssignments ?? {};
    ABILITIES.forEach((ability) => {
      const assignment = assignments[ability] ?? 0;
      if (assignment > 0) {
        output[ability] = (output[ability] ?? 0) + assignment;
      }
    });
  }

  return output;
};

const buildArmorClass = (args: {
  dexMod: number;
  inventory: CharacterRecord['equipment']['items'];
}): { armorClass: number | null; ambiguous: boolean } => {
  const armorMap: Record<string, { base: number; dexCap: number | null }> = {
    padded: { base: 11, dexCap: null },
    leather: { base: 11, dexCap: null },
    'studded leather': { base: 12, dexCap: null },
    hide: { base: 12, dexCap: 2 },
    'chain shirt': { base: 13, dexCap: 2 },
    'scale mail': { base: 14, dexCap: 2 },
    breastplate: { base: 14, dexCap: 2 },
    'half plate': { base: 15, dexCap: 2 },
    'ring mail': { base: 14, dexCap: 0 },
    'chain mail': { base: 16, dexCap: 0 },
    splint: { base: 17, dexCap: 0 },
    plate: { base: 18, dexCap: 0 }
  };

  const equipped = args.inventory.filter((item) => item.equipped);
  const candidates = equipped.length > 0 ? equipped : args.inventory;
  const armorCandidates = candidates.filter((item) => {
    const folded = item.name.toLowerCase();
    return Object.keys(armorMap).some((key) => folded.includes(key));
  });

  const shieldBonus = candidates.some((item) => item.name.toLowerCase().includes('shield')) ? 2 : 0;
  if (armorCandidates.length === 0) {
    return {
      armorClass: 10 + args.dexMod + shieldBonus,
      ambiguous: false
    };
  }

  if (armorCandidates.length > 1 && equipped.length === 0) {
    return {
      armorClass: null,
      ambiguous: true
    };
  }

  const armor = armorCandidates[0];
  if (!armor) {
    return {
      armorClass: null,
      ambiguous: true
    };
  }
  const rule = Object.entries(armorMap).find(([key]) => armor.name.toLowerCase().includes(key))?.[1];
  if (!rule) {
    return {
      armorClass: null,
      ambiguous: true
    };
  }
  const dexContribution = rule.dexCap === null ? args.dexMod : Math.min(rule.dexCap, Math.max(0, args.dexMod));
  return {
    armorClass: rule.base + dexContribution + shieldBonus,
    ambiguous: false
  };
};

const deriveAbilities = async (character: CharacterRecord): Promise<DerivedAbilityState> => {
  const base = clampBaseScores(character.abilities.pointBuyBase);
  const backgroundBonus = deriveBackgroundBonuses(character);
  const featAndAsiBonus = await deriveAsiAndFeatBonuses(character);

  const raceBonuses: Partial<Record<Ability, number>> = {};
  if (character.origin.mode === 'LEGACY_RACE' && character.origin.raceId) {
    const race = await raceRulesFacade.getCombinedRaceData(
      character.origin.raceId,
      character.origin.subraceId
    );
    if (race) {
      ABILITIES.forEach((ability) => {
        const value = race.abilityBonuses[ability] ?? 0;
        if (value > 0) {
          raceBonuses[ability] = value;
        }
      });
    }
    character.origin.legacyRaceBonusAssignments = normalizeRaceAbilityChoiceAssignments(
      character.origin.legacyRaceBonusAssignments,
      race?.abilityBonusChoice ?? null
    );
    const legacyAssignments = character.origin.legacyRaceBonusAssignments;
    ABILITIES.forEach((ability) => {
      const value = legacyAssignments[ability] ?? 0;
      if (value > 0) {
        raceBonuses[ability] = (raceBonuses[ability] ?? 0) + value;
      }
    });
  } else if (character.origin.mode === 'LEGACY_RACE') {
    character.origin.legacyRaceBonusAssignments = {};
  }

  const bonus: Partial<Record<Ability, number>> = {};
  ABILITIES.forEach((ability) => {
    bonus[ability] = (backgroundBonus[ability] ?? 0) + (raceBonuses[ability] ?? 0);
  });

  const finalScores = defaultAbilityMap(BASE_SCORE_MIN);
  const mods = defaultAbilityMap(0);
  ABILITIES.forEach((ability) => {
    const raw = base[ability] + (bonus[ability] ?? 0) + (featAndAsiBonus[ability] ?? 0);
    const final = Math.min(20, Math.max(1, raw));
    finalScores[ability] = final;
    mods[ability] = getModifierForScore(final);
  });

  const pointBuy = calculatePointBuy(toPointBuyMap(base));
  return {
    pointBuyErrors: pointBuy.errors,
    base,
    bonus,
    featAndAsiBonus,
    finalScores,
    mods
  };
};

const deriveCombat = (args: {
  character: CharacterRecord;
  level: number;
  classHitDie: string | undefined;
  conMod: number;
  dexMod: number;
  wisMod: number;
  proficiencyBonus: number;
  proficientSkills: string[];
  raceSpeed: number | null;
}): CombatDerivation & { armorAmbiguous: boolean } => {
  const hitDieMatch = args.classHitDie?.match(/d(\d+)/i);
  let hitPointsMax: number | null = null;
  if (hitDieMatch?.[1]) {
    const dieSize = Number.parseInt(hitDieMatch[1], 10);
    if (Number.isFinite(dieSize)) {
      const firstLevel = dieSize + args.conMod;
      const perLevel = Math.floor(dieSize / 2) + 1 + args.conMod;
      hitPointsMax = Math.max(1, firstLevel + Math.max(0, args.level - 1) * Math.max(1, perLevel));
    }
  }

  const acResult = buildArmorClass({
    dexMod: args.dexMod,
    inventory: args.character.equipment.items
  });
  const initiative = args.dexMod;
  const perceptionProficient = args.proficientSkills.some((entry) => entry.toLowerCase() === 'perception');
  const perceptionScore = args.wisMod + (perceptionProficient ? args.proficiencyBonus : 0);
  const passivePerception = 10 + perceptionScore;

  return {
    armorClass: acResult.armorClass,
    armorAmbiguous: acResult.ambiguous,
    hitPointsMax,
    initiative,
    passivePerception,
    speed: args.raceSpeed ?? 30
  };
};

const deriveSpellState = async (args: {
  character: CharacterRecord;
  classId: string | null;
  level: number;
  spellcastingAbilityMod: number;
}): Promise<{ spellState: SpellDerivation; limits: Awaited<ReturnType<typeof rulesFacade.getKnownSpellLimitsForClassLevel>>; availableSpells: SpellMeta[] }> => {
  if (!args.classId) {
    return {
      spellState: {
        spellSlots: null,
        maxSpellLevel: 0,
        availableSpellSlugs: new Set<string>(),
        selectedCantrips: [],
        selectedKnownSpells: [],
        preparedSpells: [],
        grantedSpells: []
      },
      limits: {
        casterType: 'NONE',
        isPreparedCaster: false,
        isKnownSpellsCaster: false,
        isSpellbookCaster: false,
        cantripsKnown: null,
        spellsKnown: null,
        preparedFormula: null,
        preparedMax: null
      },
      availableSpells: []
    };
  }

  const slots = rulesFacade.getSpellSlotsForClassLevel(args.classId, args.level);
  const maxSpellLevel = slots
    ? slots.reduce((current, amount, index) => (amount > 0 ? index + 1 : current), 0)
    : 0;
  const classSpells = rulesFacade.listSpellsByClass(args.classId);
  const availableSpells = classSpells.filter((spell) => spell.level === 0 || spell.level <= maxSpellLevel);
  const availableSpellSlugs = new Set(availableSpells.map((spell) => spell.slug));
  const limits = await rulesFacade.getKnownSpellLimitsForClassLevel({
    classId: args.classId,
    level: args.level,
    abilityMod: args.spellcastingAbilityMod
  });

  const selectedCantrips = unique(args.character.spells.selectedCantrips).filter((slug) => {
    const spell = availableSpells.find((entry) => entry.slug === slug);
    return !!spell && spell.level === 0;
  });
  const selectedKnownSpells = unique(args.character.spells.selectedKnownSpells).filter((slug) => {
    const spell = availableSpells.find((entry) => entry.slug === slug);
    return !!spell && spell.level > 0;
  });
  const preparedSpells = unique(args.character.spells.preparedSpells).filter((slug) => {
    const spell = availableSpells.find((entry) => entry.slug === slug);
    return !!spell && spell.level > 0;
  });

  if (limits.cantripsKnown && selectedCantrips.length > limits.cantripsKnown) {
    selectedCantrips.splice(limits.cantripsKnown);
  }
  if (limits.spellsKnown && selectedKnownSpells.length > limits.spellsKnown) {
    selectedKnownSpells.splice(limits.spellsKnown);
  }
  if (limits.preparedMax && preparedSpells.length > limits.preparedMax) {
    preparedSpells.splice(limits.preparedMax);
  }

  const grantedSpells = unique(
    [
      ...rulesFacade.getGrantedSpellsForSubclass(args.character.progression.subclassId ?? '', args.level),
      ...(await rulesFacade.getGrantedSpellsForBackgroundOrRace({
        backgroundId: args.character.origin.backgroundId,
        raceId: args.character.origin.raceId
      }))
    ].filter(Boolean)
  );

  return {
    spellState: {
      spellSlots: slots,
      maxSpellLevel,
      availableSpellSlugs,
      selectedCantrips,
      selectedKnownSpells,
      preparedSpells,
      grantedSpells
    },
    limits,
    availableSpells
  };
};

const parseSpellcastingAbility = (primaryAbility: string | undefined, mods: Record<Ability, number>): Ability | null => {
  if (!primaryAbility) {
    return null;
  }
  const lowered = primaryAbility.toLowerCase();
  const matches = ABILITIES.filter((ability) => lowered.includes(ability));
  if (matches.length === 1) {
    return matches[0]!;
  }
  if (matches.length > 1) {
    return matches.sort((a, b) => mods[b] - mods[a])[0]!;
  }
  if (lowered.includes('strength')) {
    return 'str';
  }
  if (lowered.includes('dexterity')) {
    return 'dex';
  }
  if (lowered.includes('constitution')) {
    return 'con';
  }
  if (lowered.includes('intelligence')) {
    return 'int';
  }
  if (lowered.includes('wisdom')) {
    return 'wis';
  }
  if (lowered.includes('charisma')) {
    return 'cha';
  }
  return null;
};

const mergeEquipmentItems = (
  selectedPackages: CharacterRecord['equipment']['selectedPackages'],
  existingItems: CharacterRecord['equipment']['items'],
  autoGrantedItems: CharacterRecord['equipment']['items'] = []
): CharacterRecord['equipment']['items'] => {
  const map = new Map<string, CharacterRecord['equipment']['items'][number]>();

  const addItem = (item: CharacterRecord['equipment']['items'][number]) => {
    const key = item.id || item.name.toLowerCase();
    const current = map.get(key);
    if (current) {
      map.set(key, {
        ...current,
        quantity: current.quantity + item.quantity
      });
      return;
    }
    map.set(key, {
      ...item
    });
  };

  selectedPackages.forEach((entry) => entry.items.forEach(addItem));
  autoGrantedItems.forEach(addItem);
  existingItems
    .filter(
      (item) =>
        item.source !== 'class_starting_equipment' &&
        item.source !== 'background_starting_equipment' &&
        item.source !== 'background_starting_equipment_choice'
    )
    .forEach(addItem);

  return [...map.values()];
};

const buildBackgroundFixedItems = (
  backgroundId: string,
  fixedItems: NonNullable<
    Awaited<ReturnType<typeof backgroundRulesFacade.getBackgroundGrantedData>>
  >['equipment']['fixedItems']
): CharacterRecord['equipment']['items'] => {
  return fixedItems.map((item, index) => ({
    id: `${backgroundId}-fixed-item-${index}-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name: item.name,
    quantity: item.quantity ?? 1,
    source: 'background_starting_equipment'
  }));
};

const createBackgroundDuplicateWarnings = (args: {
  backgroundData: NonNullable<Awaited<ReturnType<typeof backgroundRulesFacade.getBackgroundGrantedData>>>;
  selectedBackgroundPackageItems: string[];
  selectedBackgroundSkills: string[];
  selectedBackgroundTools: string[];
  selectedBackgroundLanguages: string[];
  otherEquipmentItems: string[];
  otherSkills: string[];
  otherTools: string[];
  otherLanguages: string[];
}): Array<{
  section: 'Background' | 'Equipment';
  message: string;
}> => {
  const warnings: Array<{
    section: 'Background' | 'Equipment';
    message: string;
  }> = [];

  const duplicateSkills = collectOverlapLabels(
    [...args.backgroundData.skills, ...args.selectedBackgroundSkills],
    args.otherSkills
  );
  if (duplicateSkills.length > 0) {
    warnings.push({
      section: 'Background',
      message: `Background skill options overlap with existing proficiencies: ${duplicateSkills.join(', ')}. Duplicates do not stack.`
    });
  }

  const duplicateTools = collectOverlapLabels(
    [...args.backgroundData.tools, ...args.selectedBackgroundTools],
    args.otherTools
  );
  if (duplicateTools.length > 0) {
    warnings.push({
      section: 'Background',
      message: `Background tool options overlap with existing proficiencies: ${duplicateTools.join(', ')}. Duplicates do not stack.`
    });
  }

  const duplicateLanguages = collectOverlapLabels(
    [...args.backgroundData.languages, ...args.selectedBackgroundLanguages],
    args.otherLanguages
  );
  if (duplicateLanguages.length > 0) {
    warnings.push({
      section: 'Background',
      message: `Background language options overlap with languages already known: ${duplicateLanguages.join(', ')}. Duplicates do not stack.`
    });
  }

  const duplicateEquipment = collectOverlapLabels(
    [
      ...args.backgroundData.equipment.fixedItems.map((item) => item.name),
      ...args.selectedBackgroundPackageItems
    ],
    args.otherEquipmentItems
  );
  if (duplicateEquipment.length > 0) {
    warnings.push({
      section: 'Equipment',
      message: `Background starting equipment overlaps with other inventory items: ${duplicateEquipment.join(', ')}. Review duplicates before exporting.`
    });
  }

  return warnings;
};

const dedupeAbilityList = (values: Ability[]): Ability[] => {
  return values.filter((value, index) => values.indexOf(value) === index);
};

const normalizeRaceAbilityChoiceAssignments = (
  assignments: Partial<Record<Ability, number>> | undefined,
  choice: {
    choose: number;
    amount: number;
    from: Ability[];
  } | null
): Partial<Record<Ability, number>> => {
  if (!choice) {
    return {};
  }

  const output: Partial<Record<Ability, number>> = {};
  choice.from
    .filter((ability) => (assignments?.[ability] ?? 0) > 0)
    .slice(0, choice.choose)
    .forEach((ability) => {
      output[ability] = choice.amount;
    });

  return output;
};

export const deriveCharacter = async (input: CharacterRecord): Promise<DeriveCharacterResult> => {
  const character = structuredClone(input);
  const level = Math.max(1, Math.min(20, Math.trunc(character.progression.level)));
  character.progression.level = level;
  character.origin.mode = getOriginModeForRuleset(character.ruleset);
  character.meta.sourceScope = getSourceScopeForRuleset(character.ruleset);
  if (character.abilities.method !== 'point_buy') {
    character.abilities.method = 'point_buy';
  }

  const classId = character.progression.classId;
  const classSummary = classId ? await rulesFacade.getClassById(classId) : null;
  const subclassRequired = Boolean(classSummary && level >= classSummary.subclassLevelStart);
  if (!subclassRequired) {
    character.progression.subclassId = null;
  }

  const abilityState = await deriveAbilities(character);

  const proficiencyBonus = 2 + Math.floor((level - 1) / 4);
  const classSkillChoice = classId
    ? await rulesFacade.getClassSkillChoice(classId)
    : {
        choose: 0,
        options: []
      };
  const classProficiencies = classId
    ? await rulesFacade.getAutomaticClassProficiencies(classId)
    : {
        armor: [],
        weapons: [],
        tools: []
      };

  const backgroundData = character.origin.backgroundId
    ? await backgroundRulesFacade.getBackgroundGrantedData(character.origin.backgroundId)
    : null;
  const lineage = character.origin.raceId ? await rulesFacade.getRaceById(character.origin.raceId) : null;
  const legacyRace =
    character.origin.mode === 'LEGACY_RACE' && character.origin.raceId
      ? await raceRulesFacade.getCombinedRaceData(character.origin.raceId, character.origin.subraceId)
      : null;
  const availableSubraces =
    character.origin.mode === 'LEGACY_RACE' && character.origin.raceId
      ? raceRulesFacade.getSubracesForRace(character.origin.raceId).map((meta) => ({
          id: meta.id,
          name: meta.name,
          summary: meta.summary
        }))
      : [];

  const selectedClassSkills = character.proficiencies.skills.filter((skill) => {
    return classSkillChoice.options.includes(skill as (typeof classSkillChoice.options)[number]);
  });
  if (selectedClassSkills.length > classSkillChoice.choose) {
    selectedClassSkills.splice(classSkillChoice.choose);
  }

  const mergedSkills = unique([
    ...(backgroundData?.skills ?? []),
    ...character.origin.selectedBackgroundSkills,
    ...(legacyRace?.proficiencies.skills ?? []),
    ...character.origin.selectedRaceSkills,
    ...selectedClassSkills
  ]);
  const mergedTools = unique([
    ...(backgroundData?.tools ?? []),
    ...(legacyRace?.proficiencies.tools ?? []),
    ...character.origin.selectedBackgroundToolProficiencies,
    ...character.origin.selectedRaceToolProficiencies,
    ...classProficiencies.tools,
    ...character.proficiencies.tools
  ]);
  const mergedLanguages = unique([
    ...(backgroundData?.languages ?? []),
    ...(lineage?.languages ?? []),
    ...(legacyRace?.languagesGranted ?? []),
    ...character.origin.selectedBackgroundLanguages,
    ...character.origin.selectedRaceLanguages
  ]);
  const mergedArmor = unique([...classProficiencies.armor, ...character.proficiencies.armor]);
  const mergedWeapons = unique([
    ...classProficiencies.weapons,
    ...(legacyRace?.proficiencies.weapons ?? []),
    ...character.proficiencies.weapons
  ]);
  const savingThrows = dedupeAbilityList([...(classSummary?.savingThrows ?? []), ...character.proficiencies.savingThrows]);

  const spellAbility = parseSpellcastingAbility(classSummary?.primaryAbility, abilityState.mods);
  const spellAbilityMod = spellAbility ? abilityState.mods[spellAbility] : 0;
  const { spellState, limits: spellLimits, availableSpells } = await deriveSpellState({
    character,
    classId,
    level,
    spellcastingAbilityMod: spellAbilityMod
  });

  const equipmentOptions = classId
    ? await rulesFacade.getEquipmentOptionsForClass(classId)
    : {
        packageChoices: [],
        goldAlternativeGp: null
      };
  const backgroundEquipmentChoices = backgroundData?.equipmentChoices ?? [];
  const allEquipmentChoices = [...equipmentOptions.packageChoices, ...backgroundEquipmentChoices];
  const validPackageSelections = character.equipment.selectedPackages.filter((entry) => {
    const choice = allEquipmentChoices.find((option) => option.id === entry.decisionId);
    if (!choice) {
      return false;
    }
    return choice.options.some((option) => option.id === entry.optionId);
  });
  const inventoryItems = mergeEquipmentItems(
    validPackageSelections,
    character.equipment.items,
    backgroundData ? buildBackgroundFixedItems(backgroundData.id, backgroundData.equipment.fixedItems) : []
  );
  const selectedBackgroundPackageItems = validPackageSelections
    .filter((entry) => allEquipmentChoices.find((choice) => choice.id === entry.decisionId)?.source === 'background')
    .flatMap((entry) => entry.items.map((item) => item.name));
  const otherEquipmentItems = [
    ...validPackageSelections
      .filter((entry) => allEquipmentChoices.find((choice) => choice.id === entry.decisionId)?.source !== 'background')
      .flatMap((entry) => entry.items.map((item) => item.name)),
    ...character.equipment.items
      .filter(
        (item) =>
          item.source !== 'background_starting_equipment' &&
          item.source !== 'background_starting_equipment_choice'
      )
      .map((item) => item.name)
  ];

  const combat = deriveCombat({
    character: {
      ...character,
      equipment: {
        ...character.equipment,
        items: inventoryItems
      }
    },
    level,
    classHitDie: classSummary?.hitDie,
    conMod: abilityState.mods.con,
    dexMod: abilityState.mods.dex,
    wisMod: abilityState.mods.wis,
    proficiencyBonus,
    proficientSkills: mergedSkills,
    raceSpeed: legacyRace?.speed.walk ?? lineage?.speedFeet ?? null
  });

  const spellSaveDc = spellAbility ? 8 + proficiencyBonus + spellAbilityMod : null;
  const spellAttackBonus = spellAbility ? proficiencyBonus + spellAbilityMod : null;

  const featureChoices = classId
    ? await rulesFacade.getClassFeatureChoicesAtLevel(classId, character.progression.subclassId, level)
    : [];
  const asiLevels = classId ? rulesFacade.getAsiLevelsForClass(classId) : [];

  const pendingDecisions = buildPendingDecisions({
    character: {
      ...character,
      proficiencies: {
        ...character.proficiencies,
        skills: mergedSkills
      },
      spells: {
        ...character.spells,
        selectedCantrips: spellState.selectedCantrips,
        selectedKnownSpells: spellState.selectedKnownSpells,
        preparedSpells: spellState.preparedSpells
      }
    },
    classSkillChoice,
    selectedClassSkillsCount: selectedClassSkills.length,
    availableSubraces,
    selectedRaceSkillChoicesCount: character.origin.selectedRaceSkills.length,
    selectedRaceLanguageChoicesCount: character.origin.selectedRaceLanguages.length,
    selectedRaceToolChoicesCount: character.origin.selectedRaceToolProficiencies.length,
    selectedRaceAbilityChoicesCount: Object.values(character.origin.legacyRaceBonusAssignments ?? {}).filter(
      (value) => (value ?? 0) > 0
    ).length,
    selectedBackgroundLanguageChoicesCount: character.origin.selectedBackgroundLanguages.length,
    selectedBackgroundToolChoicesCount: character.origin.selectedBackgroundToolProficiencies.length,
    raceSkillChoice: legacyRace?.proficiencies.skillChoices ?? null,
    raceLanguageChoice: legacyRace?.languageChoices ?? null,
    raceToolChoice: legacyRace?.proficiencies.toolChoices ?? null,
    raceAbilityBonusChoice: legacyRace?.abilityBonusChoice ?? null,
    selectedBackgroundSkillChoicesCount: character.origin.selectedBackgroundSkills.length,
    backgroundSkillChoice: backgroundData?.skillChoices ?? null,
    backgroundLanguageChoice: backgroundData?.languageChoices ?? null,
    backgroundToolChoice: backgroundData?.toolChoices ?? null,
    subclassRequired,
    featureChoices,
    equipmentChoices: allEquipmentChoices,
    spellLimits,
    availableCantripCount: availableSpells.filter((spell) => spell.level === 0).length,
    availableKnownSpellCount: availableSpells.filter((spell) => spell.level > 0).length,
    availablePreparedSpellCount: availableSpells.filter((spell) => spell.level > 0).length,
    asiLevels
  });

  const validation = buildValidationIssues({
    character: {
      ...character,
      derived: {
        ...character.derived,
        armorClass: combat.armorClass,
        hitPointsMax: combat.hitPointsMax
      }
    },
    pointBuyErrors: abilityState.pointBuyErrors,
    classSkillChoiceCount: classSkillChoice.choose,
    selectedClassSkillsCount: selectedClassSkills.length,
    featureChoices,
    equipmentChoices: allEquipmentChoices,
    spellLimits,
    maxSpellLevel: spellState.maxSpellLevel,
    availableSpellSlugs: spellState.availableSpellSlugs,
    pendingDecisions
  });

  if (combat.armorAmbiguous) {
    validation.warnings.push({
      id: `combat-armor-${validation.warnings.length + 1}`,
      severity: 'warning',
      section: 'Combat',
      message: 'Multiple armor options are available. Mark one as equipped to derive exact AC.'
    });
  }

  if (backgroundData) {
    createBackgroundDuplicateWarnings({
      backgroundData,
      selectedBackgroundPackageItems,
      selectedBackgroundSkills: character.origin.selectedBackgroundSkills,
      selectedBackgroundTools: character.origin.selectedBackgroundToolProficiencies,
      selectedBackgroundLanguages: character.origin.selectedBackgroundLanguages,
      otherEquipmentItems,
      otherSkills: [
        ...(legacyRace?.proficiencies.skills ?? []),
        ...character.origin.selectedRaceSkills,
        ...selectedClassSkills,
        ...character.proficiencies.skills
      ],
      otherTools: [
        ...(legacyRace?.proficiencies.tools ?? []),
        ...character.origin.selectedRaceToolProficiencies,
        ...classProficiencies.tools,
        ...character.proficiencies.tools
      ],
      otherLanguages: [
        ...(lineage?.languages ?? []),
        ...(legacyRace?.languagesGranted ?? []),
        ...character.origin.selectedRaceLanguages,
        ...character.proficiencies.languages
      ]
    }).forEach((warning, index) => {
      validation.warnings.push({
        id: `background-duplicate-${validation.warnings.length + index + 1}`,
        severity: 'warning',
        section: warning.section,
        message: warning.message
      });
    });
  }

  const status = resolveCharacterBuildStatus({
    blockingErrors: validation.errors,
    pendingRequiredDecisions: pendingDecisions.filter((entry) => entry.required).length,
    warnings: validation.warnings
  });

  const raceAutoGranted = (legacyRace?.traits ?? []).map((trait) => ({
    id: trait.name,
    source: legacyRace?.subraceId ? 'origin:race-subrace' : 'origin:race'
  }));
  const backgroundAutoGranted =
    backgroundData?.feature.name
      ? [
          {
            id: backgroundData.feature.name,
            source: 'origin:background'
          }
        ]
      : [];

  const nextCharacter: CharacterRecord = {
    ...character,
    status,
    progression: {
      ...character.progression,
      level
    },
    proficiencies: {
      ...character.proficiencies,
      skills: mergedSkills,
      tools: mergedTools,
      armor: mergedArmor,
      weapons: mergedWeapons,
      languages: mergedLanguages,
      savingThrows
    },
    equipment: {
      ...character.equipment,
      selectedPackages: validPackageSelections,
      items: inventoryItems
    },
    spells: {
      ...character.spells,
      selectedCantrips: spellState.selectedCantrips,
      selectedKnownSpells: spellState.selectedKnownSpells,
      preparedSpells: spellState.preparedSpells,
      grantedSpells: spellState.grantedSpells
    },
    features: {
      ...character.features,
      autoGranted: [
        ...character.features.autoGranted.filter(
          (entry) =>
            !entry.source.startsWith('origin:race') && !entry.source.startsWith('origin:background')
        ),
        ...raceAutoGranted,
        ...backgroundAutoGranted
      ]
    },
    derived: {
      ...character.derived,
      abilityFinal: abilityState.finalScores,
      abilityMods: abilityState.mods,
      proficiencyBonus,
      passivePerception: combat.passivePerception,
      initiative: combat.initiative,
      speed: combat.speed,
      senses: {
        darkvision: legacyRace?.senses.darkvision ?? null,
        blindsight: legacyRace?.senses.blindsight ?? null,
        tremorsense: legacyRace?.senses.tremorsense ?? null,
        truesight: legacyRace?.senses.truesight ?? null
      },
      defenses: {
        resistances: [...(legacyRace?.defenses.resistances ?? [])],
        immunities: [...(legacyRace?.defenses.immunities ?? [])],
        conditionImmunities: [...(legacyRace?.defenses.conditionImmunities ?? [])],
        savingThrowAdvantages: [...(legacyRace?.defenses.savingThrowAdvantages ?? [])]
      },
      raceTraitNames: (legacyRace?.traits ?? []).map((trait) => trait.name),
      backgroundFeatureName: backgroundData?.feature.name ?? null,
      backgroundFeatureText: backgroundData?.feature.rulesText ?? null,
      hitPointsMax: combat.hitPointsMax,
      armorClass: combat.armorClass,
      spellSaveDc,
      spellAttackBonus,
      spellSlots: spellState.spellSlots,
      cantripsKnown: spellLimits.cantripsKnown,
      spellsPreparedMax: spellLimits.preparedMax
    },
    validation: {
      errors: validation.errors,
      warnings: validation.warnings,
      pendingDecisions
    }
  };

  return {
    character: nextCharacter,
    runtime: {
      classSkillChoice,
      origin: {
        availableSubraces,
        raceLanguageChoices: legacyRace?.languageChoices?.choose ?? 0,
        raceLanguageOptions: legacyRace?.languageChoices?.from ?? [],
        raceToolChoices: legacyRace?.proficiencies.toolChoices?.choose ?? 0,
        raceToolOptions: legacyRace?.proficiencies.toolChoices?.from ?? [],
        raceSkillChoices: legacyRace?.proficiencies.skillChoices?.choose ?? 0,
        raceSkillOptions: legacyRace?.proficiencies.skillChoices?.from ?? [],
        raceAbilityBonusChoice: legacyRace?.abilityBonusChoice ?? null,
        backgroundLanguageChoices: backgroundData?.languageChoices?.choose ?? 0,
        backgroundLanguageOptions: backgroundData?.languageChoices?.from ?? [],
        backgroundToolChoices: backgroundData?.toolChoices?.choose ?? 0,
        backgroundToolOptions: backgroundData?.toolChoices?.from ?? [],
        backgroundSkillChoices: backgroundData?.skillChoices?.choose ?? 0,
        backgroundSkillOptions: backgroundData?.skillChoices?.from ?? []
      },
      featureChoices,
      equipmentChoices: allEquipmentChoices,
      spellLimits: spellLimits,
      availableSpells: availableSpells.map((spell) => ({
        slug: spell.slug,
        name: spell.name,
        level: spell.level,
        source: spell.source
      })),
      maxSpellLevel: spellState.maxSpellLevel,
      subclassRequired,
      asiLevels
    }
  };
};

export const deriveCharacterOrDefault = async (character: CharacterRecord | null | undefined) => {
  const base = character ?? createEmptyCharacter();
  return await deriveCharacter(base);
};
