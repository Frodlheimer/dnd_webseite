import type { SrdCategory, SrdEntryDetail, SrdEntryExtra } from '../../types';
import { filterBlocksByPageRange, firstParagraphText, splitByHeadingLevel, toContentBlocks } from '../segmentByHeadings';
import type { NormalizedSrdBlock } from '../srdJsonLoader';

type SrdRanges = {
  races: [number, number];
  equipment: [number, number];
  adventuring: [number, number];
  combat: [number, number];
  spellcasting: [number, number];
  conditions: [number, number];
  magicItems: [number, number];
  monsters: [number, number];
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const slugify = (value: string): string => {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const summarize = (value: string, maxLength = 220): string => {
  const text = normalizeWhitespace(value);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
};

const normalizeChallengeRatingTag = (value: string): string => {
  const normalized = normalizeWhitespace(value).toLowerCase();
  const fractionMatch = normalized.match(/^(\d+)\s*[/-]\s*(\d+)$/);
  if (fractionMatch) {
    return `${fractionMatch[1]}/${fractionMatch[2]}`;
  }
  return normalized.replace(/\s+/g, '');
};

const unique = <T>(items: T[]): T[] => [...new Set(items)];

const pickDefined = <T extends Record<string, unknown>>(value: T): Partial<T> => {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
};

const findHeadingPage = (blocks: NormalizedSrdBlock[], matcher: RegExp, minPage = 1): number | null => {
  const found = blocks.find(
    (block) => block.kind === 'heading' && block.page >= minPage && matcher.test(block.text)
  );
  return found?.page ?? null;
};

const resolveRanges = (blocks: NormalizedSrdBlock[]): SrdRanges => {
  const racesStart = findHeadingPage(blocks, /^Dwarf\b/i) ?? 3;
  const classesStart = findHeadingPage(blocks, /^Barbarian$/i) ?? 8;
  const equipmentStart = findHeadingPage(blocks, /^Equipment$/i) ?? 62;
  const featsStart = findHeadingPage(blocks, /^Feats$/i) ?? 75;
  const usingScoresStart = findHeadingPage(blocks, /^Using Ability Scores$/i) ?? 76;
  const combatStart = findHeadingPage(blocks, /^Surprise$/i, usingScoresStart) ?? 90;
  const spellcastingStart = findHeadingPage(blocks, /^Spellcasting$/i, combatStart) ?? 100;
  const spellListsStart = findHeadingPage(blocks, /^Spell Lists\b/i, spellcastingStart) ?? 105;
  const conditionsStart = findHeadingPage(blocks, /^Appendix PH-A: Conditions$/i) ?? 358;
  const conditionsEnd = (findHeadingPage(blocks, /^Appendix PH-B:/i, conditionsStart) ?? 360) - 1;
  const magicItemsAZStart = findHeadingPage(blocks, /^Magic Items A-Z$/i) ?? 207;
  const artifactsStart = findHeadingPage(blocks, /^Artifacts$/i, magicItemsAZStart) ?? 252;
  const monstersStart = findHeadingPage(blocks, /^Monsters \(A\)$/i) ?? 261;

  return {
    races: [racesStart, Math.max(racesStart, classesStart - 1)],
    equipment: [equipmentStart, Math.max(equipmentStart, featsStart - 1)],
    adventuring: [usingScoresStart, Math.max(usingScoresStart, combatStart - 1)],
    combat: [combatStart, Math.max(combatStart, spellcastingStart - 1)],
    spellcasting: [spellcastingStart, Math.max(spellcastingStart, spellListsStart - 1)],
    conditions: [conditionsStart, Math.max(conditionsStart, conditionsEnd)],
    magicItems: [magicItemsAZStart, Math.max(magicItemsAZStart, artifactsStart - 1)],
    monsters: [monstersStart, Math.max(monstersStart, conditionsStart - 1)]
  };
};

const compactRaceTitle = (value: string): string => {
  const normalized = normalizeWhitespace(value).replace(/\s+Traits$/i, '');
  const duplicate = normalized.match(/^(.+?)\s+\1$/i);
  return duplicate?.[1] ? duplicate[1].trim() : normalized;
};

const labelValueFromText = (text: string, label: string): string | undefined => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escaped}\\.\\s*([^]+?)(?=\\s+[A-Z][A-Za-z'\\-\\s]{2,40}\\.\\s|$)`, 'i');
  const match = text.match(regex);
  if (!match?.[1]) {
    return undefined;
  }
  return normalizeWhitespace(match[1]);
};

const extractMonsterAbilities = (
  paragraphs: string[]
): {
  dexMod?: number;
  monsterAbilities?: SrdEntryExtra['monsterAbilities'];
} => {
  const scoreLineMatcher =
    /^(\d+)\s*\(([+\-\u2212]?\d+)\)\s+(\d+)\s*\(([+\-\u2212]?\d+)\)\s+(\d+)\s*\(([+\-\u2212]?\d+)\)\s+(\d+)\s*\(([+\-\u2212]?\d+)\)\s+(\d+)\s*\(([+\-\u2212]?\d+)\)\s+(\d+)\s*\(([+\-\u2212]?\d+)\)/;
  const scoreLine = paragraphs.find((line) => scoreLineMatcher.test(line));
  if (!scoreLine) {
    return {};
  }

  const match = scoreLine.match(scoreLineMatcher);
  if (!match) {
    return {};
  }

  const parseSigned = (value: string): number => {
    return Number.parseInt(value.replaceAll('\u2212', '-'), 10);
  };

  const str = Number.parseInt(match[1] ?? '', 10);
  const strMod = parseSigned(match[2] ?? '');
  const dex = Number.parseInt(match[3] ?? '', 10);
  const dexMod = parseSigned(match[4] ?? '');
  const con = Number.parseInt(match[5] ?? '', 10);
  const conMod = parseSigned(match[6] ?? '');
  const int = Number.parseInt(match[7] ?? '', 10);
  const intMod = parseSigned(match[8] ?? '');
  const wis = Number.parseInt(match[9] ?? '', 10);
  const wisMod = parseSigned(match[10] ?? '');
  const cha = Number.parseInt(match[11] ?? '', 10);
  const chaMod = parseSigned(match[12] ?? '');

  if (
    [str, strMod, dex, dexMod, con, conMod, int, intMod, wis, wisMod, cha, chaMod].some(
      (value) => !Number.isFinite(value)
    )
  ) {
    return Number.isFinite(dexMod) ? { dexMod } : {};
  }

  return {
    dexMod,
    monsterAbilities: {
      str,
      strMod,
      dex,
      dexMod,
      con,
      conMod,
      int,
      intMod,
      wis,
      wisMod,
      cha,
      chaMod
    }
  };
};

const extractMonsterNamedItems = (blocks: NormalizedSrdBlock[]): { traits: string[]; actions: string[] } => {
  const traits = new Set<string>();
  const actions = new Set<string>();
  let section: 'traits' | 'actions' = 'traits';

  for (const block of blocks) {
    if (block.kind === 'heading') {
      const heading = normalizeWhitespace(block.text).toLowerCase();
      if (heading === 'actions' || heading === 'legendary actions' || heading === 'reactions') {
        section = 'actions';
      }
      continue;
    }

    if (block.kind !== 'paragraph') {
      continue;
    }

    const text = normalizeWhitespace(block.text);
    const paragraphLabel = text.toLowerCase();
    if (paragraphLabel === 'actions' || paragraphLabel === 'legendary actions' || paragraphLabel === 'reactions') {
      section = 'actions';
      continue;
    }

    const sentenceBreak = text.indexOf('. ');
    if (sentenceBreak <= 1) {
      continue;
    }

    const name = normalizeWhitespace(text.slice(0, sentenceBreak));
    if (!/^[A-Z][A-Za-z0-9'(),\-/ ]{1,80}$/.test(name)) {
      continue;
    }
    if (/^(The|Each|A|An)\b/.test(name)) {
      continue;
    }
    if (name.split(/\s+/).length > 8) {
      continue;
    }
    if (
      /^(Armor Class|Hit Points|Speed|Saving Throws|Skills|Senses|Languages|Challenge|Actions)$/i.test(
        name
      )
    ) {
      continue;
    }

    if (section === 'actions') {
      actions.add(name);
    } else {
      traits.add(name);
    }
  }

  return {
    traits: [...traits],
    actions: [...actions]
  };
};

const parseMonsterExtra = (
  paragraphs: string[],
  pageStart: number,
  pageEnd: number,
  blocks: NormalizedSrdBlock[]
): SrdEntryExtra => {
  const first = paragraphs[0] ?? '';
  const firstMatch = first.match(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+([^,]+),\s*(.+)$/i);
  const ac = paragraphs.find((line) => /^Armor Class\b/i.test(line))?.replace(/^Armor Class\s*/i, '');
  const hp = paragraphs.find((line) => /^Hit Points\b/i.test(line))?.replace(/^Hit Points\s*/i, '');
  const speed = paragraphs.find((line) => /^Speed\b/i.test(line))?.replace(/^Speed\s*/i, '');
  const challengeRaw = paragraphs.find((line) => /^Challenge\b/i.test(line));
  const challengeMatch = challengeRaw?.match(/^Challenge\s+([0-9]+(?:\/[0-9]+)?)(?:\s*\(([^)]+)\))?/i);
  const abilityInfo = extractMonsterAbilities(paragraphs);
  const namedItems = extractMonsterNamedItems(blocks);

  return {
    sourcePageStart: pageStart,
    sourcePageEnd: pageEnd,
    ...pickDefined({
      size: firstMatch?.[1]?.toLowerCase(),
      monsterType: firstMatch?.[2]?.toLowerCase(),
      alignment: firstMatch?.[3],
      armorClass: ac,
      hitPoints: hp,
      speed,
      challengeRating: challengeMatch?.[1],
      challengeXp: challengeMatch?.[2],
      initiativeMod: abilityInfo.dexMod,
      monsterAbilities: abilityInfo.monsterAbilities,
      monsterTraits: namedItems.traits.length > 0 ? namedItems.traits : undefined,
      monsterActions: namedItems.actions.length > 0 ? namedItems.actions : undefined
    })
  } as SrdEntryExtra;
};

const collectParagraphs = (blocks: NormalizedSrdBlock[]): string[] => {
  return blocks
    .filter((block): block is Extract<NormalizedSrdBlock, { kind: 'paragraph' }> => block.kind === 'paragraph')
    .map((block) => normalizeWhitespace(block.text))
    .filter(Boolean);
};

const hasMonsterStatblockSignature = (paragraphs: string[]): boolean => {
  if (paragraphs.length === 0) {
    return false;
  }

  const hasArmorClass = paragraphs.some((line) => /^Armor Class\b/i.test(line));
  const hasHitPoints = paragraphs.some((line) => /^Hit Points\b/i.test(line));
  const hasSpeed = paragraphs.some((line) => /^Speed\b/i.test(line));
  const hasChallenge = paragraphs.some((line) => /^Challenge\b/i.test(line));
  const hasAbilityHeader = paragraphs.some((line) => /^STR DEX CON INT WIS CHA$/i.test(line));
  const hasAbilityRow = paragraphs.some((line) =>
    /^(\d+)\s*\(([+\-\u2212]?\d+)\)\s+(\d+)\s*\(([+\-\u2212]?\d+)\)\s+(\d+)\s*\(([+\-\u2212]?\d+)\)\s+(\d+)\s*\(([+\-\u2212]?\d+)\)\s+(\d+)\s*\(([+\-\u2212]?\d+)\)\s+(\d+)\s*\(([+\-\u2212]?\d+)\)/.test(
      line
    )
  );
  const hasCreatureTypeLine = paragraphs.some((line) =>
    /^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+[A-Za-z][^,]*,\s*.+$/i.test(line)
  );

  const hasStatblockContext =
    hasSpeed || hasChallenge || hasAbilityHeader || hasAbilityRow || hasCreatureTypeLine;

  return hasArmorClass && hasHitPoints && hasStatblockContext;
};

const buildEntriesFromSlices = (args: {
  slices: ReturnType<typeof splitByHeadingLevel>;
  category: SrdCategory;
  section: string;
  idPrefix: string;
  enrich?: (entry: {
    title: string;
    paragraphs: string[];
    pageStart: number;
    pageEnd: number;
    blocks: NormalizedSrdBlock[];
  }) => { tags?: string[]; extra?: SrdEntryExtra; summary?: string; title?: string };
}): SrdEntryDetail[] => {
  const usedIds = new Set<string>();
  const details: SrdEntryDetail[] = [];

  for (const slice of args.slices) {
    const paragraphs = collectParagraphs(slice.blocks);
    const baseSummary = summarize(paragraphs[0] ?? '');
    const enriched =
      args.enrich?.({
        title: slice.title,
        paragraphs,
        pageStart: slice.pageStart,
        pageEnd: slice.pageEnd,
        blocks: slice.blocks
      }) ?? {};
    const title = enriched.title ? normalizeWhitespace(enriched.title) : slice.title;
    const idBase = `${args.idPrefix}-${slugify(title)}`;
    const uniqueId = usedIds.has(idBase) ? `${idBase}-${slice.pageStart}` : idBase;
    usedIds.add(uniqueId);

    const tags = unique([
      `category:${args.category}`,
      `section:${slugify(args.section)}`,
      'source:srd51',
      ...(enriched.tags ?? [])
    ]).sort();

    details.push({
      id: uniqueId,
      title,
      category: args.category,
      tags,
      summary: enriched.summary ? summarize(enriched.summary) : baseSummary,
      sourcePageRange: `p.${slice.pageStart}${slice.pageEnd > slice.pageStart ? `-${slice.pageEnd}` : ''}`,
      contentBlocks: toContentBlocks(slice.blocks),
      extra: {
        sourcePageStart: slice.pageStart,
        sourcePageEnd: slice.pageEnd,
        ...(enriched.extra ?? {})
      }
    });
  }

  return details;
};

const extractRaces = (blocks: NormalizedSrdBlock[], range: [number, number]): SrdEntryDetail[] => {
  const raceBlocks = filterBlocksByPageRange(blocks, range[0], range[1]);
  const slices = splitByHeadingLevel({
    blocks: raceBlocks,
    entryLevel: 2
  });

  return buildEntriesFromSlices({
    slices,
    category: 'races',
    section: 'Races',
    idPrefix: 'race',
    enrich: ({ title, paragraphs, pageStart, pageEnd }) => {
      const joined = paragraphs.join(' ');
      const cleanTitle = compactRaceTitle(title);
      const abilityScoreIncrease = labelValueFromText(joined, 'Ability Score Increase');
      const speed = labelValueFromText(joined, 'Speed');
      const size = labelValueFromText(joined, 'Size');
      const darkvision = labelValueFromText(joined, 'Darkvision');
      const languages = labelValueFromText(joined, 'Languages');
      const traitNames = unique(
        [...joined.matchAll(/([A-Z][A-Za-z' -]{2,40})\.\s/g)]
          .map((match) => normalizeWhitespace(match[1] ?? ''))
          .filter(Boolean)
      ).slice(0, 40);
      const tags = [
        `race:${slugify(cleanTitle)}`,
        ...(size ? [`size:${slugify(size.split('.')[0] ?? size)}`] : []),
        ...(darkvision ? ['has:darkvision'] : []),
        ...(speed ? ['has:speed'] : []),
        ...(languages ? ['has:languages'] : []),
        ...(abilityScoreIncrease ? ['has:asi'] : [])
      ];

      return {
        title: cleanTitle,
        tags,
        extra: {
          sourcePageStart: pageStart,
          sourcePageEnd: pageEnd,
          ...pickDefined({
            abilityScoreIncrease,
            raceSpeed: speed,
            raceSize: size,
            raceDarkvision: darkvision,
            raceLanguages: languages
          }),
          raceTraits: traitNames
        } as SrdEntryExtra
      };
    }
  });
};

const extractEquipment = (blocks: NormalizedSrdBlock[], range: [number, number]): SrdEntryDetail[] => {
  const equipmentBlocks = filterBlocksByPageRange(blocks, range[0], range[1]);
  const slices = splitByHeadingLevel({
    blocks: equipmentBlocks,
    entryLevel: 3
  });

  const entries = buildEntriesFromSlices({
    slices,
    category: 'equipment',
    section: 'Equipment',
    idPrefix: 'equipment',
    enrich: ({ title, blocks: sliceBlocks }) => {
      const titleLower = title.toLowerCase();
      const rows = sliceBlocks
        .filter((block): block is Extract<NormalizedSrdBlock, { kind: 'table' }> => block.kind === 'table')
        .flatMap((table) => {
          const result: string[][] = [];
          if (table.header.length > 0) {
            result.push(table.header);
          }
          result.push(...table.rows);
          return result;
        })
        .slice(0, 120);

      const tags: string[] = [];
      if (titleLower.includes('weapon')) {
        tags.push('equipment:weapons');
      }
      if (titleLower.includes('armor')) {
        tags.push('equipment:armor');
      }
      if (titleLower.includes('gear')) {
        tags.push('equipment:gear');
      }
      if (titleLower.includes('pack')) {
        tags.push('equipment:packs');
      }

      return {
        tags,
        extra: rows.length > 0 ? { equipmentRows: rows } : {}
      };
    }
  });

  const overviewParagraph = firstParagraphText(equipmentBlocks);
  entries.unshift({
    id: 'equipment-overview',
    title: 'Equipment Overview',
    category: 'equipment',
    tags: ['category:equipment', 'section:equipment', 'source:srd51'].sort(),
    summary: summarize(overviewParagraph),
    sourcePageRange: `p.${range[0]}-${range[1]}`,
    contentBlocks: toContentBlocks(equipmentBlocks),
    extra: {
      sourcePageStart: range[0],
      sourcePageEnd: range[1]
    }
  });

  return entries;
};

const extractRulesChapter = (
  blocks: NormalizedSrdBlock[],
  range: [number, number],
  category: 'adventuring' | 'combat' | 'spellcasting',
  sectionLabel: string
): SrdEntryDetail[] => {
  const chapterBlocks = filterBlocksByPageRange(blocks, range[0], range[1]);
  const slices = splitByHeadingLevel({
    blocks: chapterBlocks,
    entryLevel: 3
  });

  return buildEntriesFromSlices({
    slices,
    category,
    section: sectionLabel,
    idPrefix: category,
    enrich: ({ title }) => ({
      tags: [`rules:${category}`, `chapter:${slugify(title)}`]
    })
  });
};

const extractConditions = (blocks: NormalizedSrdBlock[], range: [number, number]): SrdEntryDetail[] => {
  const conditionBlocks = filterBlocksByPageRange(blocks, range[0], range[1]);
  const paragraphs = conditionBlocks.filter(
    (block): block is Extract<NormalizedSrdBlock, { kind: 'paragraph' }> => block.kind === 'paragraph'
  );

  const entries: SrdEntryDetail[] = [];
  const introParagraph = paragraphs.find((paragraph) => !paragraph.text.includes('•'))?.text ?? '';
  entries.push({
    id: 'condition-overview',
    title: 'Conditions Overview',
    category: 'conditions',
    tags: ['category:conditions', 'section:conditions', 'source:srd51'],
    summary: summarize(introParagraph),
    sourcePageRange: `p.${range[0]}-${range[1]}`,
    contentBlocks: introParagraph
      ? [
          {
            type: 'h2',
            text: 'Conditions'
          },
          {
            type: 'p',
            text: introParagraph
          }
        ]
      : toContentBlocks(conditionBlocks),
    extra: {
      sourcePageStart: range[0],
      sourcePageEnd: range[1]
    }
  });

  const conditionMap = new Map<string, string[]>();
  let activeCondition: string | null = null;
  for (const paragraph of paragraphs) {
    const text = normalizeWhitespace(paragraph.text);
    const startMatch = text.match(/^([A-Z][A-Za-z' -]{2,40})\s+•\s+(.+)$/);
    if (startMatch?.[1]) {
      const title = normalizeWhitespace(startMatch[1]);
      const rules = text
        .replace(startMatch[1], '')
        .split('•')
        .map((item) => normalizeWhitespace(item))
        .filter(Boolean);
      conditionMap.set(title, rules);
      activeCondition = title;
      continue;
    }

    if (text.startsWith('•') && activeCondition) {
      const existing = conditionMap.get(activeCondition) ?? [];
      const rules = text
        .split('•')
        .map((item) => normalizeWhitespace(item))
        .filter(Boolean);
      conditionMap.set(activeCondition, [...existing, ...rules]);
      continue;
    }
  }

  for (const [conditionName, rules] of conditionMap.entries()) {
    entries.push({
      id: `condition-${slugify(conditionName)}`,
      title: conditionName,
      category: 'conditions',
      tags: [
        'category:conditions',
        'section:conditions',
        'source:srd51',
        `condition:${slugify(conditionName)}`
      ].sort(),
      summary: summarize(rules[0] ?? ''),
      sourcePageRange: `p.${range[0]}-${range[1]}`,
      contentBlocks: [
        {
          type: 'h2',
          text: conditionName
        },
        {
          type: 'ul',
          items: rules
        }
      ],
      extra: {
        sourcePageStart: range[0],
        sourcePageEnd: range[1],
        conditionRules: rules
      }
    });
  }

  return entries;
};

const parseMagicItemTitle = (headingText: string): { title: string; descriptor?: string } => {
  const normalized = normalizeWhitespace(headingText);
  const match = normalized.match(
    /^(.+?)\s+(Armor|Weapon|Wondrous item|Potion|Ring|Rod|Staff|Wand|Scroll|Ammunition|Shield|Instrument)\b/i
  );
  if (!match?.[1]) {
    return {
      title: normalized
    };
  }

  return {
    title: normalizeWhitespace(match[1]),
    descriptor: normalizeWhitespace(normalized.slice(match[1].length).trim())
  };
};

const extractMagicItems = (blocks: NormalizedSrdBlock[], range: [number, number]): SrdEntryDetail[] => {
  const itemBlocks = filterBlocksByPageRange(blocks, range[0], range[1]);
  const slices = splitByHeadingLevel({
    blocks: itemBlocks,
    entryLevel: 3
  });

  return buildEntriesFromSlices({
    slices,
    category: 'magic-items',
    section: 'Magic Items',
    idPrefix: 'magic-item',
    enrich: ({ title }) => {
      const parsed = parseMagicItemTitle(title);
      const text = normalizeWhitespace(title);
      const rarityMatch = text.match(/\b(common|uncommon|rare|very rare|legendary|artifact|rarity varies)\b/i);
      const rarity = rarityMatch?.[1]?.toLowerCase();
      const requiresAttunement = /\brequires attunement\b/i.test(text);
      return {
        title: parsed.title,
        tags: [
          ...(rarity ? [`item:rarity:${slugify(rarity)}`] : []),
          ...(requiresAttunement ? ['has:attunement'] : [])
        ],
        extra: {
          ...pickDefined({
            rarity,
            magicItemRarity: rarity,
            attunement: requiresAttunement ? 'Requires attunement' : undefined
          }),
          magicItemRequiresAttunement: requiresAttunement
        } as SrdEntryExtra
      };
    }
  });
};

const extractMonsters = (blocks: NormalizedSrdBlock[], range: [number, number]): SrdEntryDetail[] => {
  const monsterBlocks = filterBlocksByPageRange(blocks, range[0], range[1]);
  const slices = splitByHeadingLevel({
    blocks: monsterBlocks,
    entryLevel: 3
  }).filter((slice) => {
    if (/^(Actions|Legendary Actions|Reactions|Traits)$/i.test(slice.title)) {
      return false;
    }
    const paragraphs = collectParagraphs(slice.blocks);
    return hasMonsterStatblockSignature(paragraphs);
  });

  return buildEntriesFromSlices({
    slices,
    category: 'monsters',
    section: 'Monsters',
    idPrefix: 'monster',
    enrich: ({ title, paragraphs, pageStart, pageEnd, blocks: sliceBlocks }) => {
      const extra = parseMonsterExtra(paragraphs, pageStart, pageEnd, sliceBlocks);
      const tags = [
        ...(extra.challengeRating ? [`cr:${normalizeChallengeRatingTag(extra.challengeRating)}`] : []),
        ...(extra.monsterType ? [`type:${slugify(extra.monsterType)}`] : []),
        ...(extra.size ? [`size:${slugify(extra.size)}`] : [])
      ];

      return {
        title,
        tags,
        extra,
        summary: paragraphs[0] ?? ''
      };
    }
  });
};

const extractAttributionStatement = (blocks: NormalizedSrdBlock[]): string => {
  const attributionParagraph = blocks.find(
    (block): block is Extract<NormalizedSrdBlock, { kind: 'paragraph' }> =>
      block.kind === 'paragraph' &&
      block.text.includes('This work includes material taken from the System Reference Document 5.1')
  );

  return (
    attributionParagraph?.text ??
    'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.'
  );
};

export type ParsedSrdSections = {
  byCategory: Record<SrdCategory, SrdEntryDetail[]>;
  rulesChapters: SrdEntryDetail[];
  ranges: SrdRanges;
  attributionStatement: string;
};

export const extractSrdSections = (blocks: NormalizedSrdBlock[]): ParsedSrdSections => {
  const ranges = resolveRanges(blocks);
  const races = extractRaces(blocks, ranges.races);
  const equipment = extractEquipment(blocks, ranges.equipment);
  const adventuring = extractRulesChapter(blocks, ranges.adventuring, 'adventuring', 'Adventuring');
  const combat = extractRulesChapter(blocks, ranges.combat, 'combat', 'Combat');
  const spellcasting = extractRulesChapter(blocks, ranges.spellcasting, 'spellcasting', 'Spellcasting Rules');
  const conditions = extractConditions(blocks, ranges.conditions);
  const magicItems = extractMagicItems(blocks, ranges.magicItems);
  const monsters = extractMonsters(blocks, ranges.monsters);

  return {
    byCategory: {
      races,
      equipment,
      adventuring,
      combat,
      spellcasting,
      conditions,
      'magic-items': magicItems,
      monsters
    },
    rulesChapters: [...adventuring, ...combat, ...spellcasting],
    ranges,
    attributionStatement: extractAttributionStatement(blocks)
  };
};

