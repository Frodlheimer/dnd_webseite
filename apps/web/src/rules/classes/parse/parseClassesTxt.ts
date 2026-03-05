import type { ClassesPackIndex, GrantedSpellRef, ProgressionTable, RulesDocumentBlock, RulesEntryDetail, RulesEntryKind, RulesEntryMeta } from '../types';
import { containsWikidot, sanitizeLinks } from './sanitizeLinks';

type BuildClassesPackArgs = {
  spellSlugByName?: Map<string, string>;
};

const ENTRY_PATTERN = /\[ENTRY_BEGIN\]([\s\S]*?)\[ENTRY_END\]/g;
const DASH_SEPARATOR_PATTERN = /^-+$/;
const TABLE_SEPARATOR_CELL = /^:?-{2,}:?$/;
const TABLE_SLOT_COLUMN_PATTERN = /^([1-9])(?:st|nd|rd|th)?$/i;
const LINE_BREAK_MARKER = '\u23ce';

const normalizeEol = (value: string): string => {
  return value.replace(/\r\n?/g, '\n');
};

const normalizeMojibake = (value: string): string => {
  return value
    .replaceAll('\u23ce', LINE_BREAK_MARKER)
    .replaceAll('Ã¢ÂÅ½', LINE_BREAK_MARKER)
    .replaceAll('âŽ', LINE_BREAK_MARKER)
    .replaceAll('â€¢', '\u2022')
    .replaceAll('Ã¢â‚¬â„¢', "'")
    .replaceAll('Ã¢â‚¬Ëœ', "'")
    .replaceAll('Ã¢â‚¬Å“', '"')
    .replaceAll('Ã¢â‚¬\x9d', '"')
    .replaceAll('Ã¢â‚¬â€', '-')
    .replaceAll('Ã¢â‚¬â€œ', '-')
    .replaceAll('Ã¢â‚¬Â¦', '...')
    .replaceAll('\u2019', "'")
    .replaceAll('\u2018', "'")
    .replaceAll('\u201c', '"')
    .replaceAll('\u201d', '"')
    .replaceAll('\u2014', '-')
    .replaceAll('\u2013', '-')
    .replaceAll('\u2026', '...')
    .replaceAll('\u00a0', ' ');
};

const stripLineMarker = (value: string): string => {
  const trimmed = value.replace(/\s*(?:\u23ce|âŽ|Ã¢ÂÅ½)\s*$/gu, '');
  if (trimmed.trim() === LINE_BREAK_MARKER || trimmed.trim() === 'âŽ') {
    return '';
  }
  return trimmed;
};

const collapseWhitespace = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const stripInlineMarkers = (value: string): string => {
  return value.replace(/\[(?:\/)?(?:B|I|CODE|SUP|SUB)\]/gi, '');
};

const normalizeRunOnSpacing = (value: string): string => {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([0-9])([A-Z][a-z])/g, '$1 $2')
    .replace(/([.!?])([A-Z])/g, '$1 $2');
};

const cleanTextLine = (value: string): string => {
  const normalized = normalizeMojibake(stripLineMarker(value));
  if (normalized.trim().length === 0) {
    return '';
  }

  const sanitized = sanitizeLinks(normalized);
  const withSpacing = normalizeRunOnSpacing(sanitized);
  return collapseWhitespace(withSpacing);
};

const toFolded = (value: string): string => {
  return normalizeMojibake(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['’â€™`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const toSlug = (value: string): string => {
  return toFolded(value).replace(/\s+/g, '-');
};

const extractHeaderField = (lines: string[], key: string): string => {
  const prefix = `${key}:`;
  const line = lines.find((entry) => entry.startsWith(prefix));
  if (!line) {
    return '';
  }
  return collapseWhitespace(line.slice(prefix.length));
};

const parseTableRow = (line: string): string[] => {
  if (line.startsWith('|') && line.endsWith('|')) {
    return line
      .slice(1, -1)
      .split('|')
      .map((cell) => collapseWhitespace(stripInlineMarkers(cell)));
  }

  if (line.includes('|')) {
    return line
      .split('|')
      .map((cell) => collapseWhitespace(stripInlineMarkers(cell)));
  }

  if (/\s{2,}/.test(line)) {
    return line
      .split(/\s{2,}/)
      .map((cell) => collapseWhitespace(stripInlineMarkers(cell)))
      .filter((cell) => cell.length > 0);
  }

  return [collapseWhitespace(stripInlineMarkers(line))];
};

const isTableSeparatorRow = (row: string[]): boolean => {
  return row.length > 0 && row.every((cell) => cell.length === 0 || TABLE_SEPARATOR_CELL.test(cell));
};

const parseDocumentBlocks = (lines: string[]): RulesDocumentBlock[] => {
  const blocks: RulesDocumentBlock[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) {
      return;
    }

    const text = collapseWhitespace(paragraphBuffer.join(' '));
    if (text.length > 0) {
      blocks.push({
        type: 'p',
        text
      });
    }
    paragraphBuffer = [];
  };

  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';

    if (line.length === 0) {
      flushParagraph();
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^\[H([1-6])\]\s*(.+)$/i);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1] as '1' | '2' | '3' | '4' | '5' | '6';
      const text = collapseWhitespace(stripInlineMarkers(headingMatch[2] ?? ''));
      blocks.push({
        type: `h${level}`,
        text
      });
      index += 1;
      continue;
    }

    if (line === '[TABLE_BEGIN]') {
      flushParagraph();
      const rows: string[][] = [];
      index += 1;
      while (index < lines.length && (lines[index] ?? '') !== '[TABLE_END]') {
        const rowLine = lines[index] ?? '';
        if (rowLine.length > 0) {
          rows.push(parseTableRow(rowLine));
        }
        index += 1;
      }
      if (index < lines.length && (lines[index] ?? '') === '[TABLE_END]') {
        index += 1;
      }

      const normalizedRows = rows.filter((row) => !isTableSeparatorRow(row));
      if (normalizedRows.length > 0) {
        blocks.push({
          type: 'table',
          rows: normalizedRows
        });
      }
      continue;
    }

    if (line === '[PRE_BEGIN]') {
      flushParagraph();
      const preLines: string[] = [];
      index += 1;
      while (index < lines.length && (lines[index] ?? '') !== '[PRE_END]') {
        preLines.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length && (lines[index] ?? '') === '[PRE_END]') {
        index += 1;
      }

      if (preLines.length > 0) {
        blocks.push({
          type: 'pre',
          lines: preLines
        });
      }
      continue;
    }
    const unorderedMatch = line.match(/^(?:\[(?:\u2022|â€¢)\]|(?:\u2022|â€¢)|-|\*)\s*(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index] ?? '';
        const match = current.match(/^(?:\[(?:\u2022|â€¢)\]|(?:\u2022|â€¢)|-|\*)\s*(.+)$/);
        if (!match) {
          break;
        }
        const item = collapseWhitespace(match[1] ?? '');
        if (item.length > 0) {
          items.push(item);
        }
        index += 1;
      }
      if (items.length > 0) {
        blocks.push({
          type: 'ul',
          items
        });
      }
      continue;
    }

    const orderedMatch = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index] ?? '';
        const match = current.match(/^(\d+)[.)]\s+(.+)$/);
        if (!match) {
          break;
        }
        const item = collapseWhitespace(match[2] ?? '');
        if (item.length > 0) {
          items.push(item);
        }
        index += 1;
      }
      if (items.length > 0) {
        blocks.push({
          type: 'ol',
          items
        });
      }
      continue;
    }

    if (DASH_SEPARATOR_PATTERN.test(line)) {
      flushParagraph();
      blocks.push({
        type: 'hr'
      });
      index += 1;
      continue;
    }

    paragraphBuffer.push(line);
    index += 1;
  }

  flushParagraph();
  return blocks;
};

const firstParagraph = (blocks: RulesDocumentBlock[]): string => {
  const paragraph = blocks.find((block) => block.type === 'p');
  if (!paragraph || paragraph.type !== 'p') {
    return '';
  }
  return collapseWhitespace(stripInlineMarkers(paragraph.text));
};

const toTitleCase = (value: string): string => {
  return value
    .split(/[\s_-]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1).toLowerCase()}`)
    .join(' ');
};

const normalizeTable = (rows: string[][]): ProgressionTable | null => {
  if (rows.length < 2) {
    return null;
  }

  const nonEmptyRows = rows
    .map((row) => row.map((cell) => collapseWhitespace(stripInlineMarkers(cell))))
    .filter((row) => row.some((cell) => cell.length > 0));
  if (nonEmptyRows.length < 2) {
    return null;
  }

  let title: string | undefined;
  let columns: string[] = [];
  let dataRows: string[][] = [];

  const first = nonEmptyRows[0] ?? [];
  const second = nonEmptyRows[1] ?? [];
  const third = nonEmptyRows[2] ?? [];
  const firstNonEmptyCount = first.filter((cell) => cell.length > 0).length;

  if (isTableSeparatorRow(second) && third.length > 0 && /^level$/i.test(third[0] ?? '')) {
    title = firstNonEmptyCount <= 2 ? first.filter(Boolean).join(' ').trim() : undefined;
    columns = [...third];
    dataRows = nonEmptyRows.slice(3);
  } else if (isTableSeparatorRow(second)) {
    columns = [...first];
    dataRows = nonEmptyRows.slice(2);
  } else {
    columns = [...first];
    dataRows = nonEmptyRows.slice(1);
  }

  dataRows = dataRows.filter((row) => !isTableSeparatorRow(row));
  if (columns.length === 0 || dataRows.length === 0) {
    return null;
  }

  const width = Math.max(columns.length, ...dataRows.map((row) => row.length));
  const normalizeRowWidth = (row: string[]): string[] => {
    const next = [...row];
    while (next.length < width) {
      next.push('');
    }
    return next.slice(0, width);
  };

  const normalizedTable: ProgressionTable = {
    columns: normalizeRowWidth(columns),
    rows: dataRows.map((row) => normalizeRowWidth(row))
  };
  if (title && title.length > 0) {
    normalizedTable.title = title;
  }
  return normalizedTable;
};

const parseNumericCell = (value: string): number | null => {
  const normalized = value.trim();
  if (normalized === '-' || normalized.length === 0) {
    return 0;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

const splitFeatureNames = (value: string): string[] => {
  if (value === '-' || value.trim().length === 0) {
    return [];
  }
  return value
    .split(/[,;]+/g)
    .map((entry) => collapseWhitespace(entry))
    .filter((entry) => entry.length > 0 && entry !== '-');
};

const parseLevelFromText = (value: string): number | null => {
  const match = value.match(/(\d+)(?:st|nd|rd|th)?/i);
  if (!match || !match[1]) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) {
    return null;
  }
  return parsed;
};

const detectCasterType = (args: {
  columns: string[];
  slotColumns: Array<{ index: number; level: number }>;
  spellSlotsByLevel: number[][];
}): 'FULL' | 'HALF' | 'THIRD' | 'PACT' | 'NONE' | undefined => {
  if (args.slotColumns.length === 0) {
    return undefined;
  }

  const hasPact = args.columns.some((column) => /pact/i.test(column));
  if (hasPact) {
    return 'PACT';
  }

  const maxSlotLevel = Math.max(...args.slotColumns.map((entry) => entry.level));
  if (maxSlotLevel >= 9) {
    return 'FULL';
  }
  if (maxSlotLevel === 5) {
    return 'HALF';
  }
  if (maxSlotLevel === 4) {
    return 'THIRD';
  }

  const anySlots = args.spellSlotsByLevel.some((row) => row.some((slotCount) => slotCount > 0));
  if (!anySlots) {
    return 'NONE';
  }

  return undefined;
};

const extractSpellNames = (value: string): string[] => {
  return value
    .split(/[,/;]+/g)
    .map((entry) => collapseWhitespace(stripInlineMarkers(entry)))
    .filter((entry) => /^[A-Za-z][A-Za-z0-9'’â€™\- ]+$/.test(entry) && entry.length > 1);
};

const extractStructuredFromBlocks = (args: {
  kind: RulesEntryKind;
  blocks: RulesDocumentBlock[];
  spellSlugByName?: Map<string, string>;
}): RulesEntryDetail['extracted'] => {
  const progressionTables: ProgressionTable[] = [];
  const progressionByLevel: Record<number, Record<string, string | number>> = {};
  const featuresByLevel: Record<number, string[]> = {};
  const grantedSpells: Record<number, string[]> = {};
  const grantedSpellRefs: Record<number, GrantedSpellRef[]> = {};
  const spellSlotsByLevel: number[][] = Array.from({ length: 20 }, () => Array(9).fill(0));
  const cantripsKnownByLevel: number[] = Array.from({ length: 20 }, () => 0);
  const spellsKnownByLevel: number[] = Array.from({ length: 20 }, () => 0);

  const plainText = args.blocks
    .map((block) => {
      if (block.type === 'p') {
        return stripInlineMarkers(block.text);
      }
      if (block.type === 'h1' || block.type === 'h2' || block.type === 'h3' || block.type === 'h4' || block.type === 'h5' || block.type === 'h6') {
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

  const normalizedText = collapseWhitespace(plainText);

  let casterType: 'FULL' | 'HALF' | 'THIRD' | 'PACT' | 'NONE' | undefined;

  for (const block of args.blocks) {
    if (block.type !== 'table') {
      continue;
    }

    const normalizedTable = normalizeTable(block.rows);
    if (!normalizedTable) {
      continue;
    }

    progressionTables.push(normalizedTable);
    const levelColumnIndex =
      normalizedTable.columns.findIndex((column) => /^level$/i.test(column)) >= 0
        ? normalizedTable.columns.findIndex((column) => /^level$/i.test(column))
        : 0;

    const slotColumns = normalizedTable.columns
      .map((column, index) => {
        const match = column.match(TABLE_SLOT_COLUMN_PATTERN);
        if (!match || !match[1]) {
          return null;
        }
        return {
          index,
          level: Number.parseInt(match[1], 10)
        };
      })
      .filter((entry): entry is { index: number; level: number } => !!entry);

    const featuresColumnIndex = normalizedTable.columns.findIndex((column) => /feature/i.test(column));
    const cantripsColumnIndex = normalizedTable.columns.findIndex((column) => /cantrips known/i.test(column));
    const spellsKnownColumnIndex = normalizedTable.columns.findIndex((column) => /spells known/i.test(column));
    const spellsColumnIndex = normalizedTable.columns.findIndex((column) => /spells?/i.test(column));

    for (const row of normalizedTable.rows) {
      const levelValue = row[levelColumnIndex] ?? '';
      const level = parseLevelFromText(levelValue);
      if (!level) {
        continue;
      }

      if (!progressionByLevel[level]) {
        progressionByLevel[level] = {};
      }

      normalizedTable.columns.forEach((column, columnIndex) => {
        const cell = collapseWhitespace(row[columnIndex] ?? '');
        if (cell.length === 0) {
          return;
        }
        const numeric = parseNumericCell(cell);
        progressionByLevel[level]![column] = numeric ?? cell;
      });

      if (featuresColumnIndex >= 0) {
        const featuresCell = row[featuresColumnIndex] ?? '';
        const names = splitFeatureNames(featuresCell);
        if (names.length > 0) {
          featuresByLevel[level] = [...new Set([...(featuresByLevel[level] ?? []), ...names])];
        }
      }

      if (slotColumns.length > 0) {
        for (const slotColumn of slotColumns) {
          const value = parseNumericCell(row[slotColumn.index] ?? '');
          spellSlotsByLevel[level - 1]![slotColumn.level - 1] = value ?? 0;
        }
      }

      if (cantripsColumnIndex >= 0) {
        const cantrips = parseNumericCell(row[cantripsColumnIndex] ?? '');
        cantripsKnownByLevel[level - 1] = cantrips ?? 0;
      }

      if (spellsKnownColumnIndex >= 0) {
        const spellsKnown = parseNumericCell(row[spellsKnownColumnIndex] ?? '');
        spellsKnownByLevel[level - 1] = spellsKnown ?? 0;
      }

      if (args.kind === 'SUBCLASS' && spellsColumnIndex >= 0) {
        const spellNames = extractSpellNames(row[spellsColumnIndex] ?? '');
        if (spellNames.length > 0) {
          grantedSpells[level] = [...new Set([...(grantedSpells[level] ?? []), ...spellNames])];
        }
      }
    }

    if (!casterType) {
      casterType = detectCasterType({
        columns: normalizedTable.columns,
        slotColumns,
        spellSlotsByLevel
      });
    }
  }

  if (args.kind === 'SUBCLASS' && Object.keys(grantedSpells).length === 0) {
    const sectionRegex = /(\d+)(?:st|nd|rd|th)\s+(.+?)(?=(\d+)(?:st|nd|rd|th)|$)/gi;
    let sectionMatch = sectionRegex.exec(normalizedText);
    while (sectionMatch) {
      const level = sectionMatch[1] ? Number.parseInt(sectionMatch[1], 10) : Number.NaN;
      const value = sectionMatch[2] ?? '';
      if (Number.isFinite(level) && level >= 1 && level <= 20) {
        const spellNames = extractSpellNames(value);
        if (spellNames.length >= 1 && /spell/i.test(normalizedText)) {
          grantedSpells[level] = [...new Set([...(grantedSpells[level] ?? []), ...spellNames])];
        }
      }
      sectionMatch = sectionRegex.exec(normalizedText);
    }
  }

  for (const [levelKey, names] of Object.entries(grantedSpells)) {
    const level = Number.parseInt(levelKey, 10);
    if (!Number.isFinite(level)) {
      continue;
    }
    grantedSpellRefs[level] = names.map((name) => {
      const folded = toFolded(name);
      const slug = args.spellSlugByName?.get(folded);
      if (slug) {
        return { name, slug };
      }
      return { name };
    });
  }

  const hitDie = normalizedText.match(/Hit Dice?:\s*([^\n.]+)/i)?.[1];
  const primaryAbility = normalizedText.match(/Primary Ability(?: Score)?s?:\s*([^\n.]+)/i)?.[1];
  const savingThrowsRaw = normalizedText.match(/Saving Throws?:\s*([^\n.]+)/i)?.[1];
  const armor = normalizedText.match(/Armor:\s*([^\n.]+)/i)?.[1];
  const weapons = normalizedText.match(/Weapons:\s*([^\n.]+)/i)?.[1];
  const tools = normalizedText.match(/Tools:\s*([^\n.]+)/i)?.[1];
  const preparedFormula = normalizedText.match(/prepare(?:d|s)?[^.]{0,120}(?:equal to|=)\s*([^.]+)/i)?.[1];

  const savingThrows =
    savingThrowsRaw
      ?.split(/,| and /i)
      .map((entry) => collapseWhitespace(entry))
      .filter((entry) => entry.length > 0) ?? [];

  const armorWeaponProficiencies = [armor, weapons, tools]
    .filter((entry): entry is string => !!entry && entry.trim().length > 0)
    .join(' | ');

  const headingLevelMatches = args.blocks
    .filter((block) => block.type === 'h1' || block.type === 'h2' || block.type === 'h3' || block.type === 'h4' || block.type === 'h5' || block.type === 'h6')
    .flatMap((block) => {
      const text = (block as { text: string }).text;
      const match = text.match(/(\d+)(?:st|nd|rd|th)-level/i);
      if (!match || !match[1]) {
        return [];
      }
      const level = Number.parseInt(match[1], 10);
      if (!Number.isFinite(level) || level < 1 || level > 20) {
        return [];
      }
      const featureName = collapseWhitespace(
        text.replace(/(\d+)(?:st|nd|rd|th)-level/gi, '').replace(/feature/gi, '')
      );
      return [
        {
          level,
          featureName
        }
      ];
    });

  for (const match of headingLevelMatches) {
    if (!match.featureName) {
      continue;
    }
    featuresByLevel[match.level] = [...new Set([...(featuresByLevel[match.level] ?? []), match.featureName])];
  }
  const sentenceLevelRegex = /([A-Z][A-Za-z'’â€™\- ]{2,80})\s+(?:at|starting at|beginning at)\s+(\d+)(?:st|nd|rd|th)\s+level/gi;
  let sentenceLevelMatch = sentenceLevelRegex.exec(normalizedText);
  while (sentenceLevelMatch) {
    const featureName = collapseWhitespace(sentenceLevelMatch[1] ?? '');
    const level = sentenceLevelMatch[2] ? Number.parseInt(sentenceLevelMatch[2], 10) : Number.NaN;
    if (featureName.length > 0 && Number.isFinite(level) && level >= 1 && level <= 20) {
      featuresByLevel[level] = [...new Set([...(featuresByLevel[level] ?? []), featureName])];
    }
    sentenceLevelMatch = sentenceLevelRegex.exec(normalizedText);
  }

  const subclassLevelCandidates = [
    ...Array.from(normalizedText.matchAll(/(?:at|starting at|beginning at|when you (?:adopt|choose)[^.]{0,40})\s+(\d+)(?:st|nd|rd|th)\s+level/gi)).map(
      (match) => Number.parseInt(match[1] ?? '', 10)
    ),
    ...headingLevelMatches.map((entry) => entry.level)
  ].filter((value) => Number.isFinite(value) && value >= 1 && value <= 20);

  const subclassLevelStart =
    args.kind === 'SUBCLASS' && subclassLevelCandidates.length > 0
      ? Math.min(...subclassLevelCandidates)
      : undefined;

  const hasSpellSlots = spellSlotsByLevel.some((row) => row.some((slotCount) => slotCount > 0));
  const hasCantrips = cantripsKnownByLevel.some((count) => count > 0);
  const hasSpellsKnown = spellsKnownByLevel.some((count) => count > 0);

  const extracted: RulesEntryDetail['extracted'] = {
    progressionTables,
    progressionByLevel,
    featuresByLevel,
    grantedSpells,
    grantedSpellRefs
  };
  if (hitDie) {
    extracted.hitDie = collapseWhitespace(hitDie);
  }
  if (primaryAbility) {
    extracted.primaryAbility = collapseWhitespace(primaryAbility);
  }
  if (savingThrows.length > 0) {
    extracted.savingThrows = savingThrows.map(toTitleCase);
  }
  if (armorWeaponProficiencies.length > 0) {
    extracted.armorWeaponProficiencies = armorWeaponProficiencies;
  }

  if (hasSpellSlots || hasCantrips || hasSpellsKnown || casterType || preparedFormula) {
    const spellcasting: NonNullable<RulesEntryDetail['extracted']['spellcasting']> = {};
    if (casterType) {
      spellcasting.casterType = casterType;
    }
    if (hasSpellSlots) {
      spellcasting.spellSlotsByLevel = spellSlotsByLevel;
    }
    if (hasCantrips) {
      spellcasting.cantripsKnownByLevel = cantripsKnownByLevel;
    }
    if (hasSpellsKnown) {
      spellcasting.spellsKnownByLevel = spellsKnownByLevel;
    }
    if (preparedFormula) {
      spellcasting.preparedFormula = collapseWhitespace(preparedFormula);
    }
    extracted.spellcasting = spellcasting;
  }

  if (subclassLevelStart !== undefined) {
    extracted.subclassLevelStart = subclassLevelStart;
  }
  return extracted;
};

const extractNameTags = (name: string): string[] => {
  const tags = new Set<string>();
  const match = name.match(/^\(([^)]+)\)\s*/);
  if (!match || !match[1]) {
    return [];
  }

  const tokens = match[1]
    .split(/[\/,]/g)
    .map((entry) => collapseWhitespace(entry))
    .filter((entry) => entry.length > 0);
  for (const token of tokens) {
    const folded = toFolded(token);
    if (folded === 'ua' || folded.includes('unearthed arcana')) {
      tags.add('ua');
      continue;
    }
    tags.add(`setting:${toSlug(token)}`);
  }

  return [...tags];
};

const buildTags = (entry: RulesEntryDetail): string[] => {
  const tags = new Set<string>();
  tags.add(entry.kind === 'CLASS' ? 'kind:class' : 'kind:subclass');
  tags.add(`class:${entry.classId}`);

  if (entry.kind === 'SUBCLASS') {
    tags.add(`subclass:${entry.id}`);
  }

  for (const nameTag of extractNameTags(entry.name)) {
    tags.add(nameTag);
  }

  const spellcasting = entry.extracted.spellcasting;
  if (spellcasting?.spellSlotsByLevel && spellcasting.spellSlotsByLevel.some((row) => row.some((value) => value > 0))) {
    tags.add('spellcaster');
    tags.add('has:spell-slots');
  }
  if (spellcasting?.casterType) {
    tags.add(`caster:${spellcasting.casterType.toLowerCase()}`);
  }

  if (Object.keys(entry.extracted.grantedSpellRefs).length > 0) {
    tags.add('has:granted-spells');
  }
  if (entry.extracted.progressionTables.length > 0) {
    tags.add('has:tables');
  }
  if (Object.keys(entry.extracted.featuresByLevel).length > 0) {
    tags.add('has:features');
  }

  return [...tags].sort();
};

const buildBitsetIndexes = (metas: RulesEntryMeta[]): Pick<ClassesPackIndex, 'allTags' | 'tagCounts' | 'tagBitsets'> => {
  const wordCount = Math.ceil(metas.length / 32);
  const bitsets = new Map<string, Uint32Array>();
  const counts = new Map<string, number>();

  metas.forEach((meta, index) => {
    for (const tag of meta.tags) {
      let bits = bitsets.get(tag);
      if (!bits) {
        bits = new Uint32Array(wordCount);
        bitsets.set(tag, bits);
      }
      const wordIndex = Math.floor(index / 32);
      const bitOffset = index % 32;
      const currentWord = bits[wordIndex] ?? 0;
      bits[wordIndex] = currentWord | (1 << bitOffset);
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  });

  const allTags = [...bitsets.keys()].sort();
  const tagCounts: Record<string, number> = {};
  const tagBitsets: Record<string, number[]> = {};

  for (const tag of allTags) {
    tagCounts[tag] = counts.get(tag) ?? 0;
    tagBitsets[tag] = [...(bitsets.get(tag) ?? new Uint32Array(wordCount))];
  }

  return {
    allTags,
    tagCounts,
    tagBitsets
  };
};

const assertNoWikidotInObject = (value: unknown): void => {
  const serialized = JSON.stringify(value);
  if (containsWikidot(serialized)) {
    throw new Error('Sanitization failure: generated classes output still contains "wikidot".');
  }
};

export const parseClassesTxt = (rawText: string, args: BuildClassesPackArgs = {}): RulesEntryDetail[] => {
  const normalized = normalizeMojibake(normalizeEol(rawText));
  const entries: RulesEntryDetail[] = [];
  const seenIds = new Set<string>();

  for (const entryMatch of normalized.matchAll(ENTRY_PATTERN)) {
    const body = entryMatch[1] ?? '';
    const rawLines = body.split('\n').map((line) => stripLineMarker(normalizeMojibake(line)).trimEnd());
    const lines = rawLines.map((line) => (line.trim() === LINE_BREAK_MARKER || line.trim() === 'âŽ' ? '' : line));

    const typeRaw = extractHeaderField(lines, 'TYPE').toUpperCase();
    if (typeRaw !== 'CLASS' && typeRaw !== 'SUBCLASS') {
      continue;
    }
    const kind = typeRaw as RulesEntryKind;
    const name = extractHeaderField(lines, 'NAME');
    if (!name) {
      continue;
    }

    const parentClassName = extractHeaderField(lines, 'PARENT_CLASS');
    const classId = kind === 'CLASS' ? toSlug(name) : toSlug(parentClassName || 'unknown');

    const contentStartIndex = lines.findIndex((line) => line === '[CONTENT_BEGIN]');
    const contentEndIndex = lines.findIndex((line) => line === '[CONTENT_END]');
    const contentLinesRaw =
      contentStartIndex >= 0 && contentEndIndex > contentStartIndex
        ? lines.slice(contentStartIndex + 1, contentEndIndex)
        : [];

    const contentLines = contentLinesRaw
      .map((line) => cleanTextLine(line))
      .filter((line, index, array) => {
        if (DASH_SEPARATOR_PATTERN.test(line)) {
          return false;
        }
        if (line.length === 0) {
          const previous = array[index - 1] ?? '';
          return previous.length > 0;
        }
        return true;
      });

    const documentBlocks = parseDocumentBlocks(contentLines);
    const extracted = extractStructuredFromBlocks({
      kind,
      blocks: documentBlocks,
      ...(args.spellSlugByName ? { spellSlugByName: args.spellSlugByName } : {})
    });
    const summary = firstParagraph(documentBlocks);

    const idBase =
      kind === 'CLASS'
        ? toSlug(name)
        : `${classId || 'class'}--${toSlug(name)}`;

    let id = idBase || `${kind.toLowerCase()}-${entries.length + 1}`;
    let duplicateSuffix = 2;
    while (seenIds.has(id)) {
      id = `${idBase}-${duplicateSuffix}`;
      duplicateSuffix += 1;
    }
    seenIds.add(id);

    const detail: RulesEntryDetail = {
      id,
      kind,
      name: collapseWhitespace(name),
      classId,
      summary,
      tags: [],
      documentBlocks,
      extracted,
      ...(kind === 'SUBCLASS' && classId.length > 0 ? { parentClassId: classId } : {})
    };

    detail.tags = buildTags(detail);
    entries.push(detail);
  }

  const sorted = entries.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'CLASS' ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });

  assertNoWikidotInObject(sorted);
  return sorted;
};

export const buildClassesPackFromText = (
  rawText: string,
  args: BuildClassesPackArgs = {}
): {
  index: ClassesPackIndex;
  details: RulesEntryDetail[];
} => {
  const details = parseClassesTxt(rawText, args);
  const entriesMeta: RulesEntryMeta[] = details.map((detail) => {
    const quick: RulesEntryMeta['quick'] = {};
    const spellcasting = detail.extracted.spellcasting;
    if (spellcasting?.casterType) {
      quick.casterType = spellcasting.casterType;
    }
    if (spellcasting?.spellSlotsByLevel) {
      quick.spellSlotsByLevel = spellcasting.spellSlotsByLevel;
    }
    if (Object.keys(detail.extracted.featuresByLevel).length > 0) {
      quick.featuresByLevel = detail.extracted.featuresByLevel;
    }
    if (detail.extracted.subclassLevelStart !== undefined) {
      quick.subclassLevelStart = detail.extracted.subclassLevelStart;
    }
    if (Object.keys(detail.extracted.grantedSpellRefs).length > 0) {
      quick.grantedSpellRefsByLevel = detail.extracted.grantedSpellRefs;
    }

    return {
      id: detail.id,
      kind: detail.kind,
      name: detail.name,
      classId: detail.classId,
      tags: detail.tags,
      nameFolded: toFolded(detail.name),
      summary: detail.summary,
      detailUrl: `/rules/classes/entries/${detail.id}.json`,
      quick,
      ...(detail.parentClassId ? { parentClassId: detail.parentClassId } : {})
    };
  });

  const bitsetIndex = buildBitsetIndexes(entriesMeta);
  const index: ClassesPackIndex = {
    version: 1,
    generatedAt: new Date().toISOString(),
    count: entriesMeta.length,
    entriesMeta,
    allTags: bitsetIndex.allTags,
    tagCounts: bitsetIndex.tagCounts,
    tagBitsets: bitsetIndex.tagBitsets
  };

  assertNoWikidotInObject(index);
  return {
    index,
    details
  };
};

