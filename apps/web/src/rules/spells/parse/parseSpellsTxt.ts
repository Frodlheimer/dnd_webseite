import type {
  SpellDescriptionBlock,
  SpellDescriptionListBlock,
  SpellDescriptionTableBlock,
  SpellDetail,
  SpellFlagCode,
  SpellFlags,
  SpellMeta,
  SpellsPack
} from '../types';
import { buildDescriptionBlocks, hasTableLikeSignature } from './spellTableOverrides';

const BLOCK_SEPARATOR = /^={30,}[^\n]*$/m;
const LABEL_SOURCE = /^Source:\s*/i;
const LABEL_CASTING_TIME = /^Casting Time:\s*/i;
const LABEL_RANGE = /^Range:\s*/i;
const LABEL_COMPONENTS = /^Components:\s*/i;
const LABEL_DURATION = /^Duration:\s*/i;
const LABEL_AT_HIGHER = /^At Higher Levels(?:\.|:)\s*/i;
const LABEL_SPELL_LISTS = /^Spell Lists(?:\.|:)\s*/i;
const TABLE_LINE_PATTERN = /^\|.*\|$/;
const LIST_ITEM_PATTERN = /^([-*]|\d+\.)\s+(.*)$/;

const BASE_CLASS_NAMES = [
  'Artificer',
  'Barbarian',
  'Bard',
  'Cleric',
  'Druid',
  'Fighter',
  'Monk',
  'Paladin',
  'Ranger',
  'Rogue',
  'Sorcerer',
  'Warlock',
  'Wizard'
] as const;
const BASE_CLASS_SET = new Set<string>(BASE_CLASS_NAMES);
const CLASS_NAME_PATTERN = new RegExp(`\\b(${BASE_CLASS_NAMES.join('|')})\\b`, 'gi');

const normalizeEol = (value: string): string => {
  return value.replace(/\r\n?/g, '\n');
};

const normalizeMojibake = (value: string): string => {
  return value
    .replaceAll('â€™', "'")
    .replaceAll('â€˜', "'")
    .replaceAll('â€œ', '"')
    .replaceAll('â€\x9d', '"')
    .replaceAll('â€”', '-')
    .replaceAll('â€“', '-')
    .replaceAll('â€¦', '...')
    .replaceAll('\u2019', "'")
    .replaceAll('\u2018', "'")
    .replaceAll('\u201c', '"')
    .replaceAll('\u201d', '"')
    .replaceAll('\u2014', '-')
    .replaceAll('\u2013', '-')
    .replaceAll('\u2026', '...')
    .replaceAll('\u00a0', ' ');
};

const collapseWhitespace = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const stripLineBreakMarker = (value: string): string => {
  return value.replace(/\s*⏎\s*$/u, '');
};

const stripInlineMarkdown = (value: string): string => {
  return value
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s{2,}/g, ' ')
    .replace(/([.!?])([A-Z])/g, '$1 $2');
};

const stripExternalUrls = (value: string): string => {
  return value
    .replace(/\(\s*https?:\/\/[^)\s]+[^)]*\)/gi, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
};

const cleanLine = (value: string): string => {
  return stripExternalUrls(stripInlineMarkdown(stripLineBreakMarker(normalizeMojibake(value))));
};

const toAsciiLower = (value: string): string => {
  return normalizeMojibake(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9:\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const toTagValue = (value: string): string => {
  return toAsciiLower(value).replace(/\s+/g, '-');
};

const toSlug = (value: string): string => {
  return toAsciiLower(value).replace(/\s+/g, '-');
};

const toOrdinal = (level: number): string => {
  const mod100 = level % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${level}th`;
  }

  switch (level % 10) {
    case 1:
      return `${level}st`;
    case 2:
      return `${level}nd`;
    case 3:
      return `${level}rd`;
    default:
      return `${level}th`;
  }
};

const titleCaseWord = (word: string): string => {
  if (word.length === 0) {
    return word;
  }

  if (/^[ivxlcdm]+$/i.test(word)) {
    return word.toUpperCase();
  }

  return `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`;
};

const slugToName = (slug: string): string => {
  return slug
    .split('-')
    .filter(Boolean)
    .map((segment) => titleCaseWord(segment))
    .join(' ');
};

const compactLines = (lines: string[]): string[] => {
  return lines.map((line) => cleanLine(line));
};

const findLabelIndex = (lines: string[], label: RegExp): number => {
  return lines.findIndex((line) => label.test(line));
};

const findNextNonEmptyLineIndex = (lines: string[], startIndex: number): number => {
  for (let index = Math.max(0, startIndex); index < lines.length; index += 1) {
    if ((lines[index] ?? '').trim().length > 0) {
      return index;
    }
  }

  return -1;
};

const isNextSectionStart = (line: string): boolean => {
  return (
    LABEL_CASTING_TIME.test(line) ||
    LABEL_RANGE.test(line) ||
    LABEL_COMPONENTS.test(line) ||
    LABEL_DURATION.test(line) ||
    LABEL_AT_HIGHER.test(line) ||
    LABEL_SPELL_LISTS.test(line)
  );
};

const readLabeledValue = (
  lines: string[],
  startIndex: number,
  label: RegExp
): {
  value: string;
  nextIndex: number;
} => {
  if (startIndex < 0 || startIndex >= lines.length) {
    return {
      value: '',
      nextIndex: startIndex + 1
    };
  }

  const line = lines[startIndex] ?? '';
  const inline = line.replace(label, '').trim();
  if (inline.length > 0) {
    return {
      value: inline,
      nextIndex: startIndex + 1
    };
  }

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const current = lines[index] ?? '';
    if (isNextSectionStart(current)) {
      break;
    }

    if (current.length === 0) {
      continue;
    }

    return {
      value: collapseWhitespace(current),
      nextIndex: index + 1
    };
  }

  return {
    value: '',
    nextIndex: startIndex + 1
  };
};

const joinParagraphs = (lines: string[]): string => {
  const paragraphs: string[] = [];
  let buffer: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      if (buffer.length > 0) {
        paragraphs.push(buffer.join(' '));
        buffer = [];
      }
      continue;
    }

    buffer.push(line);
  }

  if (buffer.length > 0) {
    paragraphs.push(buffer.join(' '));
  }

  return normalizeMojibake(paragraphs.join('\n\n')).trim();
};

const parseClasses = (rawText: string): string[] => {
  const classes = new Set<string>();
  const section = collapseWhitespace(normalizeMojibake(rawText));
  if (section.length === 0) {
    return [];
  }

  CLASS_NAME_PATTERN.lastIndex = 0;
  const matches = section.matchAll(CLASS_NAME_PATTERN);
  for (const match of matches) {
    const value = match[1];
    if (!value) {
      continue;
    }

    const canonical =
      BASE_CLASS_NAMES.find((entry) => entry.toLowerCase() === value.toLowerCase()) ?? value;
    if (BASE_CLASS_SET.has(canonical)) {
      classes.add(canonical);
    }
  }

  return [...classes];
};

const extractBaseClass = (value: string): string => {
  return value.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
};

const parseLevelAndSchool = (
  levelLineRaw: string
): { level: number; school: string; levelLabel: string } => {
  const levelLine = normalizeMojibake(levelLineRaw).trim();
  const withoutFlags = levelLine.replace(/\([^)]*\)/g, '').trim();
  const lowered = withoutFlags.toLowerCase();

  if (lowered.includes('cantrip')) {
    const schoolMatch = withoutFlags.match(/([A-Za-z]+)\s+cantrip/i);
    const school = schoolMatch?.[1] ? titleCaseWord(schoolMatch[1]) : 'Unknown';
    return {
      level: 0,
      school,
      levelLabel: `${school} cantrip`
    };
  }

  const match = withoutFlags.match(/(\d+)(?:st|nd|rd|th)\s*-?\s*level\s+([A-Za-z]+)/i);
  if (!match) {
    return {
      level: 0,
      school: 'Unknown',
      levelLabel: withoutFlags
    };
  }

  const level = Number.parseInt(match[1] ?? '0', 10);
  const schoolRaw = match[2] ?? 'Unknown';
  const school = titleCaseWord(schoolRaw);

  return {
    level: Number.isFinite(level) ? level : 0,
    school,
    levelLabel: `${toOrdinal(Number.isFinite(level) ? level : 0)}-level ${school}`
  };
};

const parseFlags = (levelLineRaw: string, classSectionRaw: string): SpellFlags => {
  const normalizedLevel = toAsciiLower(levelLineRaw);
  const normalizedClassSection = toAsciiLower(classSectionRaw);

  const dunamancyFromClass = normalizedClassSection.includes('dunamancy');
  const graviturgyFromClass = normalizedClassSection.includes('graviturgy');
  const chronurgyFromClass = normalizedClassSection.includes('chronurgy');

  const ritual = normalizedLevel.includes('ritual');
  const technomagic = normalizedLevel.includes('technomagic');
  const dunamancy = normalizedLevel.includes('dunamancy') || dunamancyFromClass;
  const dunamancyGraviturgy =
    normalizedLevel.includes('dunamancy:graviturgy') || graviturgyFromClass;
  const dunamancyChronurgy = normalizedLevel.includes('dunamancy:chronurgy') || chronurgyFromClass;

  return {
    ritual,
    technomagic,
    dunamancy,
    dunamancyGraviturgy,
    dunamancyChronurgy
  };
};

const flagsToCodes = (flags: SpellFlags): SpellFlagCode[] => {
  const codes: SpellFlagCode[] = [];
  if (flags.ritual) {
    codes.push('R');
  }
  if (flags.dunamancy) {
    codes.push('D');
  }
  if (flags.dunamancyGraviturgy) {
    codes.push('DG');
  }
  if (flags.dunamancyChronurgy) {
    codes.push('DC');
  }
  if (flags.technomagic) {
    codes.push('T');
  }
  return codes;
};

const deriveTags = (args: {
  level: number;
  school: string;
  classes: string[];
  source: string;
  flags: SpellFlags;
  duration: string;
  components: string;
  range: string;
  description: string;
}): string[] => {
  const tags = new Set<string>();

  if (args.level === 0) {
    tags.add('cantrip');
    tags.add('level:0');
  } else {
    tags.add(`level:${args.level}`);
  }
  tags.add(`school:${toTagValue(args.school)}`);
  tags.add(`source:${toTagValue(args.source)}`);

  for (const rawClass of args.classes) {
    const className = extractBaseClass(rawClass);
    if (className.length > 0) {
      tags.add(`class:${toTagValue(className)}`);
    }
  }

  if (args.flags.ritual) {
    tags.add('ritual');
  }
  if (args.flags.technomagic) {
    tags.add('technomagic');
  }
  if (args.flags.dunamancy) {
    tags.add('dunamancy');
  }
  if (args.flags.dunamancyGraviturgy) {
    tags.add('dunamancy:graviturgy');
  }
  if (args.flags.dunamancyChronurgy) {
    tags.add('dunamancy:chronurgy');
  }

  const componentsHead =
    args.components.split('(')[0]?.toUpperCase() ?? args.components.toUpperCase();
  if (/\bV\b/.test(componentsHead)) {
    tags.add('components:v');
  }
  if (/\bS\b/.test(componentsHead)) {
    tags.add('components:s');
  }
  if (/\bM\b/.test(componentsHead)) {
    tags.add('components:m');
  }

  const normalizedDuration = toAsciiLower(args.duration);
  if (normalizedDuration.includes('concentration')) {
    tags.add('concentration');
    tags.add('concentration:yes');
  } else {
    tags.add('concentration:no');
  }

  const normalizedRange = toAsciiLower(args.range);
  const normalizedDescription = toAsciiLower(args.description);
  const areaPattern =
    /\b\d+\s*-?\s*foot[-\s]*(radius|diameter|cone|cube|line|sphere|cylinder|hemisphere)\b/;
  const areaFromRange =
    /\bself\s*\([^)]*(radius|diameter|cone|cube|line|sphere|cylinder|hemisphere|wall)\b/.test(
      normalizedRange
    ) || areaPattern.test(normalizedRange);
  const areaFromDescription = areaPattern.test(normalizedDescription);

  if (areaFromRange || areaFromDescription) {
    tags.add('target:area');
  } else if (normalizedRange === 'self' || normalizedRange.startsWith('self ')) {
    tags.add('target:self');
  } else {
    tags.add('target:single');
  }

  return [...tags].sort();
};

const buildTagBitsets = (
  metas: SpellMeta[]
): {
  allTags: string[];
  tagBitsets: Record<string, number[]>;
  tagCounts: Record<string, number>;
} => {
  const words = Math.ceil(metas.length / 32);
  const bitsets = new Map<string, Uint32Array>();
  const counts = new Map<string, number>();

  metas.forEach((meta, index) => {
    for (const tag of meta.tags) {
      let bits = bitsets.get(tag);
      if (!bits) {
        bits = new Uint32Array(words);
        bitsets.set(tag, bits);
      }

      const wordIndex = Math.floor(index / 32);
      const bitOffset = index % 32;
      const existingWord = bits[wordIndex] ?? 0;
      bits[wordIndex] = existingWord | (1 << bitOffset);
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  });

  const allTags = [...bitsets.keys()].sort();
  const tagBitsets: Record<string, number[]> = {};
  const tagCounts: Record<string, number> = {};

  for (const tag of allTags) {
    tagBitsets[tag] = [...(bitsets.get(tag) ?? new Uint32Array(words))];
    tagCounts[tag] = counts.get(tag) ?? 0;
  }

  return {
    allTags,
    tagBitsets,
    tagCounts
  };
};

const splitMarkdownTableRow = (line: string): string[] => {
  const trimmed = line.trim();
  const core = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells = core.split('|').map((cell) => collapseWhitespace(cell));

  while (cells.length > 0 && (cells[cells.length - 1] ?? '').length === 0) {
    cells.pop();
  }

  return cells;
};

const isAlignmentCell = (cell: string): boolean => {
  return /^:?-{2,}:?$/.test(cell.trim());
};

const isAlignmentRow = (cells: string[]): boolean => {
  return cells.length > 0 && cells.every((cell) => cell.length === 0 || isAlignmentCell(cell));
};

const nonEmptyCellCount = (cells: string[]): number => {
  return cells.filter((cell) => cell.length > 0).length;
};

const firstNonEmptyCell = (cells: string[]): string => {
  return cells.find((cell) => cell.length > 0) ?? '';
};

const normalizeTableRow = (cells: string[], columnCount: number): string[] => {
  const normalized = [...cells];
  if (normalized.length > columnCount) {
    return normalized.slice(0, columnCount);
  }

  while (normalized.length < columnCount) {
    normalized.push('');
  }

  return normalized;
};

const inferTableTitle = (header: string[]): string => {
  const first = header[0] ?? '';
  const second = header[1] ?? '';

  if (first.length > 0 && second.length > 0) {
    return `${first} ${second}`.trim();
  }

  if (first.length > 0) {
    return `${first} Table`;
  }

  return 'Spell Table';
};

const parseMarkdownTableBlock = (
  lines: string[],
  startIndex: number
): {
  block: SpellDescriptionTableBlock;
  nextIndex: number;
} | null => {
  const tableLines: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = (lines[index] ?? '').trim();
    if (!TABLE_LINE_PATTERN.test(line)) {
      break;
    }

    tableLines.push(line);
    index += 1;
  }

  if (tableLines.length < 2) {
    return null;
  }

  const rows = tableLines
    .map((line) => splitMarkdownTableRow(line))
    .filter((cells) => cells.length > 0 && cells.some((cell) => cell.length > 0));

  if (rows.length < 2) {
    return null;
  }

  let title = '';
  let header: string[] = [];
  let dataStart = 0;

  if (
    rows.length >= 3 &&
    nonEmptyCellCount(rows[0] ?? []) === 1 &&
    isAlignmentRow(rows[1] ?? []) &&
    !isAlignmentRow(rows[2] ?? [])
  ) {
    title = firstNonEmptyCell(rows[0] ?? []);
    header = rows[2] ?? [];
    dataStart = 3;
  } else if (
    rows.length >= 3 &&
    nonEmptyCellCount(rows[0] ?? []) === 1 &&
    !isAlignmentRow(rows[1] ?? []) &&
    isAlignmentRow(rows[2] ?? [])
  ) {
    title = firstNonEmptyCell(rows[0] ?? []);
    header = rows[1] ?? [];
    dataStart = 3;
  } else if (rows.length >= 2 && !isAlignmentRow(rows[0] ?? []) && isAlignmentRow(rows[1] ?? [])) {
    header = rows[0] ?? [];
    dataStart = 2;
  } else {
    const headerIndex = rows.findIndex((cells) => !isAlignmentRow(cells));
    if (headerIndex < 0) {
      return null;
    }

    header = rows[headerIndex] ?? [];
    dataStart = headerIndex + 1;
    if (isAlignmentRow(rows[dataStart] ?? [])) {
      dataStart += 1;
    }
  }

  const nonEmptyHeader = header.filter((cell) => cell.length > 0);
  if (nonEmptyHeader.length === 0) {
    return null;
  }

  const rawDataRows = rows
    .slice(dataStart)
    .filter((cells) => !isAlignmentRow(cells) && cells.some((cell) => cell.length > 0));
  if (rawDataRows.length === 0) {
    return null;
  }

  const columnCount = Math.max(
    header.length,
    ...rawDataRows.map((cells) => cells.length),
    nonEmptyHeader.length
  );

  const normalizedHeader = normalizeTableRow(header, columnCount);
  const normalizedRows = rawDataRows.map((cells) => normalizeTableRow(cells, columnCount));

  const block: SpellDescriptionTableBlock = {
    type: 'table',
    title: title.length > 0 ? title : inferTableTitle(normalizedHeader),
    columns: normalizedHeader,
    rows: normalizedRows
  };

  return {
    block,
    nextIndex: index
  };
};

const deriveListTitle = (slug: string, contextParagraph: string): string => {
  if (slug === 'symbol') {
    return 'Symbol Effects';
  }

  const context = toAsciiLower(contextParagraph);
  if (context.includes('diseases below')) {
    return 'Disease Effects';
  }
  if (context.includes('choose one of the options below') || context.includes('choose one of the following')) {
    return 'Options';
  }
  if (context.includes('following effects')) {
    return 'Effects';
  }

  return 'Options';
};

const parseMarkdownListBlock = (
  args: {
    lines: string[];
    startIndex: number;
    slug: string;
    contextParagraph: string;
  }
): {
  block: SpellDescriptionListBlock;
  nextIndex: number;
} | null => {
  const firstLine = (args.lines[args.startIndex] ?? '').trim();
  if (!LIST_ITEM_PATTERN.test(firstLine)) {
    return null;
  }

  const items: string[] = [];
  let index = args.startIndex;

  while (index < args.lines.length) {
    const current = (args.lines[index] ?? '').trim();

    if (current.length === 0) {
      const next = (args.lines[index + 1] ?? '').trim();
      if (LIST_ITEM_PATTERN.test(next)) {
        index += 1;
        continue;
      }
      break;
    }

    const itemMatch = current.match(LIST_ITEM_PATTERN);
    if (!itemMatch) {
      break;
    }

    let itemText = collapseWhitespace(itemMatch[2] ?? '');
    index += 1;

    while (index < args.lines.length) {
      const continuation = (args.lines[index] ?? '').trim();
      if (
        continuation.length === 0 ||
        LIST_ITEM_PATTERN.test(continuation) ||
        TABLE_LINE_PATTERN.test(continuation)
      ) {
        break;
      }

      itemText = collapseWhitespace(`${itemText} ${continuation}`);
      index += 1;
    }

    if (itemText.length > 0) {
      items.push(itemText);
    }

    if ((args.lines[index] ?? '').trim().length === 0) {
      let lookahead = index;
      while (lookahead < args.lines.length && (args.lines[lookahead] ?? '').trim().length === 0) {
        lookahead += 1;
      }

      if (LIST_ITEM_PATTERN.test((args.lines[lookahead] ?? '').trim())) {
        index = lookahead;
        continue;
      }

      index = lookahead;
      break;
    }
  }

  if (items.length === 0) {
    return null;
  }

  return {
    block: {
      type: 'list',
      title: deriveListTitle(args.slug, args.contextParagraph),
      items
    },
    nextIndex: index
  };
};

const parseDescriptionBlocksFromLines = (args: {
  slug: string;
  lines: string[];
}): SpellDescriptionBlock[] => {
  const blocks: SpellDescriptionBlock[] = [];
  let paragraphBuffer: string[] = [];
  let lastParagraph = '';

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) {
      return;
    }

    const text = collapseWhitespace(paragraphBuffer.join(' '));
    if (text.length > 0) {
      blocks.push({
        type: 'paragraph',
        text
      });
      lastParagraph = text;
    }

    paragraphBuffer = [];
  };

  let index = 0;
  while (index < args.lines.length) {
    const line = (args.lines[index] ?? '').trim();

    if (line.length === 0) {
      flushParagraph();
      index += 1;
      continue;
    }

    if (TABLE_LINE_PATTERN.test(line)) {
      flushParagraph();
      const parsedTable = parseMarkdownTableBlock(args.lines, index);
      if (parsedTable) {
        blocks.push(parsedTable.block);
        index = parsedTable.nextIndex;
        continue;
      }
    }

    const parsedList = parseMarkdownListBlock({
      lines: args.lines,
      startIndex: index,
      slug: args.slug,
      contextParagraph: lastParagraph
    });

    if (parsedList) {
      flushParagraph();
      blocks.push(parsedList.block);
      index = parsedList.nextIndex;
      continue;
    }

    paragraphBuffer.push(line);
    index += 1;
  }

  flushParagraph();
  return blocks;
};

const parseSpellBlock = (blockRaw: string): SpellDetail | null => {
  const block = normalizeMojibake(normalizeEol(blockRaw)).trim();
  if (block.length === 0) {
    return null;
  }

  const lines = compactLines(block.split('\n')).filter((line) => !/^-{20,}$/.test(line));
  const slugLine = lines.find((line) => /^spell:/i.test(line));
  if (!slugLine) {
    return null;
  }

  const parsedSlug = slugLine.replace(/^spell:/i, '').trim();
  const slug = toSlug(parsedSlug);
  if (!slug) {
    return null;
  }

  const sourceIndex = findLabelIndex(lines, LABEL_SOURCE);
  if (sourceIndex < 0) {
    return null;
  }

  const source = lines[sourceIndex]?.replace(LABEL_SOURCE, '').trim() ?? 'Unknown';
  const levelLineIndex = findNextNonEmptyLineIndex(lines, sourceIndex + 1);
  const levelLine = levelLineIndex >= 0 ? lines[levelLineIndex] ?? '' : '';
  const { level, school, levelLabel } = parseLevelAndSchool(levelLine);

  const castingIndex = findLabelIndex(lines, LABEL_CASTING_TIME);
  const rangeIndex = findLabelIndex(lines, LABEL_RANGE);
  const componentsIndex = findLabelIndex(lines, LABEL_COMPONENTS);
  const durationIndex = findLabelIndex(lines, LABEL_DURATION);

  const castingTime = readLabeledValue(lines, castingIndex, LABEL_CASTING_TIME).value;
  const range = readLabeledValue(lines, rangeIndex, LABEL_RANGE).value;
  const components = readLabeledValue(lines, componentsIndex, LABEL_COMPONENTS).value;
  const durationRead = readLabeledValue(lines, durationIndex, LABEL_DURATION);
  const duration = durationRead.value;

  const spellListsIndex = findLabelIndex(lines, LABEL_SPELL_LISTS);
  if (spellListsIndex < 0) {
    return null;
  }

  const atHigherIndex = findLabelIndex(lines, LABEL_AT_HIGHER);
  const fallbackContentStart = findNextNonEmptyLineIndex(lines, (levelLineIndex >= 0 ? levelLineIndex : sourceIndex) + 1);
  const contentStart = durationIndex >= 0 ? durationRead.nextIndex : Math.max(0, fallbackContentStart);
  const descriptionEnd = atHigherIndex >= 0 ? atHigherIndex : spellListsIndex;
  const descriptionLines = lines.slice(contentStart, Math.max(contentStart, descriptionEnd));
  const description = joinParagraphs(descriptionLines);

  const parsedBlocks = parseDescriptionBlocksFromLines({
    slug,
    lines: descriptionLines
  });
  const fallbackBlocks = buildDescriptionBlocks({
    slug,
    description
  });
  const hasStructuredParsedBlocks = parsedBlocks.some((block) => block.type !== 'paragraph');
  const descriptionBlocks =
    hasStructuredParsedBlocks || !fallbackBlocks.restored ? parsedBlocks : fallbackBlocks.blocks;

  let atHigherLevels: string | null = null;
  if (atHigherIndex >= 0) {
    const atHigherInline = (lines[atHigherIndex] ?? '').replace(LABEL_AT_HIGHER, '').trim();
    const atHigherLines = [
      ...(atHigherInline.length > 0 ? [atHigherInline] : []),
      ...lines.slice(atHigherIndex + 1, spellListsIndex)
    ];
    const joined = joinParagraphs(atHigherLines);
    atHigherLevels = joined.length > 0 ? joined : null;
  }

  const spellListInline = (lines[spellListsIndex] ?? '').replace(LABEL_SPELL_LISTS, '').trim();
  const classSectionRaw = [spellListInline, ...lines.slice(spellListsIndex + 1)].join(' ');
  const classes = parseClasses(classSectionRaw);
  const flags = parseFlags(levelLine, classSectionRaw);
  const flagCodes = flagsToCodes(flags);
  const name = slugToName(slug);

  return {
    slug,
    name,
    source,
    level,
    levelLabel,
    school,
    castingTime,
    range,
    duration,
    components,
    classes,
    flags,
    flagCodes,
    description,
    descriptionBlocks,
    atHigherLevels
  };
};

export const parseSpellsTxt = (rawText: string): SpellDetail[] => {
  const text = normalizeMojibake(normalizeEol(rawText));
  const blocks = text
    .split(BLOCK_SEPARATOR)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const details: SpellDetail[] = [];
  const seenSlugs = new Set<string>();

  for (const block of blocks) {
    const detail = parseSpellBlock(block);
    if (!detail) {
      continue;
    }

    if (seenSlugs.has(detail.slug)) {
      continue;
    }

    seenSlugs.add(detail.slug);
    details.push(detail);
  }

  return details.sort((left, right) => left.name.localeCompare(right.name));
};

const toMeta = (detail: SpellDetail): SpellMeta => {
  const tags = deriveTags({
    level: detail.level,
    school: detail.school,
    classes: detail.classes,
    source: detail.source,
    flags: detail.flags,
    duration: detail.duration,
    components: detail.components,
    range: detail.range,
    description: detail.description
  });

  return {
    slug: detail.slug,
    name: detail.name,
    source: detail.source,
    level: detail.level,
    levelLabel: detail.levelLabel,
    school: detail.school,
    castingTime: detail.castingTime,
    range: detail.range,
    duration: detail.duration,
    components: detail.components,
    classes: detail.classes,
    flags: detail.flags,
    flagCodes: detail.flagCodes,
    tags,
    nameNormalized: toAsciiLower(detail.name)
  };
};

export const buildSpellsPackFromText = (rawText: string): SpellsPack => {
  const details = parseSpellsTxt(rawText);
  const metas = details.map((detail) => toMeta(detail));

  const detailsBySlug: Record<string, SpellDetail> = {};
  for (const detail of details) {
    detailsBySlug[detail.slug] = detail;
  }

  const { allTags, tagBitsets, tagCounts } = buildTagBitsets(metas);
  const hasStructuredDescriptionBlock = (detail: SpellDetail): boolean => {
    return detail.descriptionBlocks.some((block) => block.type !== 'paragraph');
  };

  const restored = details
    .filter((detail) => hasStructuredDescriptionBlock(detail))
    .map((detail) => detail.slug)
    .sort();

  const unresolvedCandidates = details
    .filter(
      (detail) =>
        hasTableLikeSignature(detail.description) &&
        !hasStructuredDescriptionBlock(detail)
    )
    .map((detail) => detail.slug)
    .sort();

  return {
    generatedAt: new Date().toISOString(),
    count: metas.length,
    metas,
    detailsBySlug,
    allTags,
    tagBitsets,
    tagCounts,
    tableRestoration: {
      restored,
      unresolvedCandidates
    }
  };
};

export const normalizeSpellQuery = (value: string): string => {
  return toAsciiLower(value);
};
