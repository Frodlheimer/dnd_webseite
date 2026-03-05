import type {
  ClassesPackIndex,
  GrantedSpellRef,
  ProgressionTable,
  RulesDocumentBlock,
  RulesEntryDetail,
  RulesEntryKind,
  RulesEntryMeta
} from '../types';

export type SourceTreeNode =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'element';
      tag: string;
      children?: SourceTreeNode[];
    }
  | {
      type: 'fragment';
      children?: SourceTreeNode[];
    };

export type SourceEntryJson = {
  type: RulesEntryKind;
  name: string;
  parent_class?: string | null;
  page_title?: string;
  content?: {
    tree?: SourceTreeNode[];
  };
};

type BuildClassesPackArgs = {
  spellSlugByName?: Map<string, string>;
};

type EntryInput = {
  fileName: string;
  payload: SourceEntryJson;
};

const TABLE_SLOT_COLUMN_PATTERN = /^([1-9])(?:st|nd|rd|th)?$/i;
const TABLE_SEPARATOR_CELL = /^:?-{2,}:?$/;

const normalizeMojibake = (value: string): string => {
  return value
    .replaceAll('Ã¢ÂÅ½', '\n')
    .replaceAll('âŽ', '\n')
    .replaceAll('â€¢', '•')
    .replaceAll('Ã¢â‚¬â„¢', "'")
    .replaceAll('Ã¢â‚¬Ëœ', "'")
    .replaceAll('Ã¢â‚¬Å“', '"')
    .replaceAll('Ã¢â‚¬\x9d', '"')
    .replaceAll('Ã¢â‚¬â€', '-')
    .replaceAll('Ã¢â‚¬â€œ', '-')
    .replaceAll('Ã¢â‚¬Â¦', '...')
    .replaceAll('â€™', "'")
    .replaceAll('â€œ', '"')
    .replaceAll('â€\x9d', '"')
    .replaceAll('â€“', '-')
    .replaceAll('â€”', '-')
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

const stripForbiddenLinks = (value: string): string => {
  return value
    .replace(/\bhttps?:\/\/\S+/gi, ' ')
    .replace(/\bwww\.\S+/gi, ' ')
    .replace(/\S*wikidot\S*/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
};

const isUnearthedArcanaText = (value: string): boolean => {
  const normalized = toFolded(normalizeMojibake(value));
  if (normalized.length === 0) {
    return false;
  }

  return (
    normalized.includes('unearthed arcana') ||
    /\bua\b/.test(normalized) ||
    normalized.startsWith('ua ') ||
    normalized.includes('(ua)')
  );
};

const collapseWhitespace = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const sanitizeInlineText = (value: string): string => {
  return stripForbiddenLinks(normalizeMojibake(value));
};

const sanitizeMultilineText = (value: string): string => {
  const normalized = normalizeMojibake(value).replace(/\r\n?/g, '\n');
  const lines = normalized
    .split('\n')
    .map((line) => stripForbiddenLinks(line))
    .map((line) => collapseWhitespace(line));
  return lines.filter((line) => line.length > 0).join('\n');
};

const toFolded = (value: string): string => {
  return normalizeMojibake(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2019\u2018â€™'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const toSlug = (value: string): string => {
  return toFolded(value).replace(/\s+/g, '-');
};

const stripNamePrefixTag = (value: string): string => {
  return collapseWhitespace(value.replace(/^\(([^)]+)\)\s*/, ''));
};

const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const asChildren = (node: SourceTreeNode): SourceTreeNode[] => {
  if ('children' in node && Array.isArray(node.children)) {
    return node.children;
  }
  return [];
};

const extractTextFromNodes = (
  nodes: SourceTreeNode[],
  options: {
    preserveLineBreaks?: boolean;
  } = {}
): string => {
  const parts: string[] = [];

  const visit = (node: SourceTreeNode): void => {
    if (node.type === 'text') {
      parts.push(node.text);
      return;
    }

    if (node.type === 'element' && node.tag.toLowerCase() === 'br') {
      parts.push(options.preserveLineBreaks ? '\n' : ' ');
      return;
    }

    for (const child of asChildren(node)) {
      visit(child);
    }
  };

  for (const node of nodes) {
    visit(node);
  }

  const raw = parts.join('');
  if (options.preserveLineBreaks) {
    return sanitizeMultilineText(raw);
  }
  return sanitizeInlineText(raw);
};

const collectElementsByTag = (root: SourceTreeNode, tag: string): SourceTreeNode[] => {
  const wanted = tag.toLowerCase();
  const out: SourceTreeNode[] = [];

  const visit = (node: SourceTreeNode): void => {
    if (node.type === 'element' && node.tag.toLowerCase() === wanted) {
      out.push(node);
    }
    for (const child of asChildren(node)) {
      visit(child);
    }
  };

  visit(root);
  return out;
};

const parseTableRows = (node: SourceTreeNode): string[][] => {
  const rows: string[][] = [];
  const trNodes = collectElementsByTag(node, 'tr');
  for (const trNode of trNodes) {
    const cellNodes = asChildren(trNode).filter(
      (child) => child.type === 'element' && (child.tag.toLowerCase() === 'th' || child.tag.toLowerCase() === 'td')
    );

    const effectiveCells =
      cellNodes.length > 0
        ? cellNodes
        : collectElementsByTag(trNode, 'th').concat(collectElementsByTag(trNode, 'td'));

    if (effectiveCells.length === 0) {
      continue;
    }

    const row = effectiveCells
      .map((cellNode) => extractTextFromNodes(asChildren(cellNode), { preserveLineBreaks: true }).replace(/\n+/g, ' / '))
      .map((cell) => collapseWhitespace(cell));

    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
};

const parseTreeToBlocks = (nodes: SourceTreeNode[]): RulesDocumentBlock[] => {
  const blocks: RulesDocumentBlock[] = [];

  const appendParagraph = (text: string): void => {
    const normalized = collapseWhitespace(text);
    if (normalized.length === 0) {
      return;
    }
    blocks.push({
      type: 'p',
      text: normalized
    });
  };

  const visit = (node: SourceTreeNode): void => {
    if (node.type === 'text') {
      appendParagraph(sanitizeInlineText(node.text));
      return;
    }

    if (node.type !== 'element') {
      for (const child of asChildren(node)) {
        visit(child);
      }
      return;
    }

    const tag = node.tag.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      const text = extractTextFromNodes(asChildren(node), { preserveLineBreaks: false });
      if (text.length > 0) {
        blocks.push({
          type: tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
          text
        });
      }
      return;
    }

    if (tag === 'p') {
      appendParagraph(extractTextFromNodes(asChildren(node), { preserveLineBreaks: true }).replace(/\n+/g, ' '));
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = asChildren(node)
        .filter((child) => child.type === 'element' && child.tag.toLowerCase() === 'li')
        .map((liNode) => extractTextFromNodes(asChildren(liNode), { preserveLineBreaks: true }).replace(/\n+/g, ' '))
        .map((item) => collapseWhitespace(item))
        .filter((item) => item.length > 0);

      if (items.length > 0) {
        blocks.push({
          type: tag,
          items
        });
      }
      return;
    }

    if (tag === 'table') {
      const rows = parseTableRows(node);
      if (rows.length > 0) {
        blocks.push({
          type: 'table',
          rows
        });
      }
      return;
    }

    if (tag === 'pre') {
      const text = extractTextFromNodes(asChildren(node), { preserveLineBreaks: true });
      const lines = text
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0);
      if (lines.length > 0) {
        blocks.push({
          type: 'pre',
          lines
        });
      }
      return;
    }

    if (tag === 'blockquote') {
      const text = extractTextFromNodes(asChildren(node), { preserveLineBreaks: true }).replace(/\n+/g, ' ');
      appendParagraph(text);
      return;
    }

    for (const child of asChildren(node)) {
      visit(child);
    }
  };

  for (const node of nodes) {
    visit(node);
  }

  return blocks;
};

const filterUaRows = (rows: string[][]): string[][] => {
  return rows.filter((row) => row.every((cell) => !isUnearthedArcanaText(cell)));
};

const filterUaBlocks = (blocks: RulesDocumentBlock[]): RulesDocumentBlock[] => {
  const filtered: RulesDocumentBlock[] = [];

  for (const block of blocks) {
    if (block.type === 'p' || block.type === 'h1' || block.type === 'h2' || block.type === 'h3' || block.type === 'h4' || block.type === 'h5' || block.type === 'h6') {
      if (isUnearthedArcanaText(block.text)) {
        continue;
      }
      filtered.push(block);
      continue;
    }

    if (block.type === 'ul' || block.type === 'ol') {
      const items = block.items.filter((item) => !isUnearthedArcanaText(item));
      if (items.length === 0) {
        continue;
      }
      filtered.push({
        type: block.type,
        items
      });
      continue;
    }

    if (block.type === 'pre') {
      const lines = block.lines.filter((line) => !isUnearthedArcanaText(line));
      if (lines.length === 0) {
        continue;
      }
      filtered.push({
        type: 'pre',
        lines
      });
      continue;
    }

    if (block.type === 'table') {
      const rows = filterUaRows(block.rows);
      if (rows.length === 0) {
        continue;
      }
      filtered.push({
        type: 'table',
        rows
      });
      continue;
    }

    filtered.push(block);
  }

  return filtered;
};

const firstParagraph = (blocks: RulesDocumentBlock[]): string => {
  const paragraph = blocks.find((block) => block.type === 'p');
  if (!paragraph || paragraph.type !== 'p') {
    return '';
  }
  return collapseWhitespace(paragraph.text);
};

const isTableSeparatorRow = (row: string[]): boolean => {
  return row.length > 0 && row.every((cell) => cell.length === 0 || TABLE_SEPARATOR_CELL.test(cell));
};

const normalizeTable = (rows: string[][]): ProgressionTable | null => {
  if (rows.length < 2) {
    return null;
  }

  const nonEmptyRows = rows
    .map((row) => row.map((cell) => collapseWhitespace(cell)))
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
  const secondStartsWithLevel = /^level$/i.test(second[0] ?? '');

  if (isTableSeparatorRow(second) && third.length > 0 && /^level$/i.test(third[0] ?? '')) {
    title = firstNonEmptyCount <= 2 ? first.filter(Boolean).join(' ').trim() : undefined;
    columns = [...third];
    dataRows = nonEmptyRows.slice(3);
  } else if (secondStartsWithLevel && firstNonEmptyCount <= 2) {
    title = first.filter(Boolean).join(' ').trim() || undefined;
    columns = [...second];
    dataRows = nonEmptyRows.slice(2);
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

const ABILITY_NAMES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'] as const;

const sanitizeFactValue = (value: string | undefined, maxLength = 120): string | undefined => {
  if (!value) {
    return undefined;
  }
  const normalized = collapseWhitespace(value);
  if (normalized.length === 0 || normalized.length > maxLength) {
    return undefined;
  }
  return normalized;
};

const extractLabelValue = (
  source: string,
  label: string,
  nextLabels: string[],
  maxLength = 120
): string | undefined => {
  const nextPattern = nextLabels.map((entry) => escapeRegex(entry)).join('|');
  const lookAhead = nextPattern.length > 0 ? `(?=\\s*(?:${nextPattern})\\s*:|\\.|$)` : '(?=\\.|$)';
  const pattern = new RegExp(`${escapeRegex(label)}\\s*:\\s*([\\s\\S]{1,260}?)${lookAhead}`, 'i');
  const value = pattern.exec(source)?.[1];
  return sanitizeFactValue(value, maxLength);
};

const extractSavingThrows = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }
  return ABILITY_NAMES.filter((ability) => new RegExp(`\\b${ability}\\b`, 'i').test(value));
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
    .split(/[,/;]+|\band\b/gi)
    .map((entry) => collapseWhitespace(entry))
    .filter((entry) => /^[A-Za-z][A-Za-z0-9'\- ]+$/.test(entry) && entry.length > 1);
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
        return block.text;
      }
      if (
        block.type === 'h1' ||
        block.type === 'h2' ||
        block.type === 'h3' ||
        block.type === 'h4' ||
        block.type === 'h5' ||
        block.type === 'h6'
      ) {
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

  const headingLevelMatches = args.blocks
    .filter(
      (block) =>
        block.type === 'h1' ||
        block.type === 'h2' ||
        block.type === 'h3' ||
        block.type === 'h4' ||
        block.type === 'h5' ||
        block.type === 'h6'
    )
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
      const featureName = collapseWhitespace(text.replace(/(\d+)(?:st|nd|rd|th)-level/gi, '').replace(/feature/gi, ''));
      return [{ level, featureName }];
    });

  for (const match of headingLevelMatches) {
    if (!match.featureName) {
      continue;
    }
    featuresByLevel[match.level] = [...new Set([...(featuresByLevel[match.level] ?? []), match.featureName])];
  }

  const sentenceLevelRegex = /([A-Z][A-Za-z'\- ]{2,80})\s+(?:at|starting at|beginning at)\s+(\d+)(?:st|nd|rd|th)\s+level/gi;
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
    ...Array.from(
      normalizedText.matchAll(
        /(?:at|starting at|beginning at|when you (?:adopt|choose)[^.]{0,40})\s+(\d+)(?:st|nd|rd|th)\s+level/gi
      )
    ).map((match) => Number.parseInt(match[1] ?? '', 10)),
    ...headingLevelMatches.map((entry) => entry.level)
  ].filter((value) => Number.isFinite(value) && value >= 1 && value <= 20);

  for (const [levelKey, names] of Object.entries(grantedSpells)) {
    const level = Number.parseInt(levelKey, 10);
    if (!Number.isFinite(level)) {
      continue;
    }
    grantedSpellRefs[level] = names.map((name) => {
      const slug = args.spellSlugByName?.get(toFolded(name));
      if (slug) {
        return { name, slug };
      }
      return { name };
    });
  }

  const labels = [
    'Hit Dice',
    'Hit Die',
    'Hit Points at 1st Level',
    'Hit Points at Higher Levels',
    'Primary Ability',
    'Saving Throws',
    'Armor',
    'Weapons',
    'Tools',
    'Skills',
    'Proficiencies',
    'Equipment'
  ];
  const hitDie =
    extractLabelValue(normalizedText, 'Hit Dice', labels.filter((label) => label !== 'Hit Dice'), 60) ??
    extractLabelValue(normalizedText, 'Hit Die', labels.filter((label) => label !== 'Hit Die'), 60);
  const primaryAbility = extractLabelValue(
    normalizedText,
    'Primary Ability',
    labels.filter((label) => label !== 'Primary Ability'),
    80
  );
  const savingThrowsRaw = extractLabelValue(
    normalizedText,
    'Saving Throws',
    labels.filter((label) => label !== 'Saving Throws'),
    80
  );
  const armor = extractLabelValue(normalizedText, 'Armor', labels.filter((label) => label !== 'Armor'), 120);
  const weapons = extractLabelValue(normalizedText, 'Weapons', labels.filter((label) => label !== 'Weapons'), 120);
  const tools = extractLabelValue(normalizedText, 'Tools', labels.filter((label) => label !== 'Tools'), 120);

  const preparedFormula = normalizedText.match(/prepare(?:d|s)?[^.]{0,120}(?:equal to|=)\s*([^.]+)/i)?.[1];
  const savingThrows = extractSavingThrows(savingThrowsRaw);
  const armorWeaponProficiencies = [armor, weapons, tools]
    .filter((entry): entry is string => !!entry && entry.trim().length > 0)
    .join(' | ');

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
    extracted.hitDie = hitDie;
  }
  if (primaryAbility) {
    extracted.primaryAbility = primaryAbility;
  }
  if (savingThrows.length > 0) {
    extracted.savingThrows = savingThrows;
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

  if (args.kind === 'SUBCLASS' && subclassLevelCandidates.length > 0) {
    extracted.subclassLevelStart = Math.min(...subclassLevelCandidates);
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
    .split(/[/,]/g)
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

const assertNoWikidotInObject = (value: unknown, contextPath = 'root'): void => {
  if (typeof value === 'string') {
    if (/wikidot/i.test(value)) {
      throw new Error(`[classes:build] Forbidden reference found at ${contextPath}`);
    }
    if (/\bhttps?:\/\//i.test(value)) {
      throw new Error(`[classes:build] Forbidden URL found at ${contextPath}`);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoWikidotInObject(entry, `${contextPath}[${index}]`));
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      assertNoWikidotInObject(entry, `${contextPath}.${key}`);
    }
  }
};

const normalizeEntry = (
  entryInput: EntryInput,
  args: BuildClassesPackArgs
): RulesEntryDetail => {
  const payload = entryInput.payload;
  const kind = payload.type;
  const name = sanitizeInlineText(payload.name);
  const parentClassName = sanitizeInlineText(payload.parent_class ?? '');
  const classId = kind === 'CLASS' ? toSlug(stripNamePrefixTag(name)) : toSlug(stripNamePrefixTag(parentClassName));
  const subclassSlug = toSlug(stripNamePrefixTag(name));
  const id = kind === 'CLASS' ? classId : `${classId}--${subclassSlug}`;

  const tree = payload.content?.tree ?? [];
  const documentBlocks = filterUaBlocks(parseTreeToBlocks(tree));
  const summary = firstParagraph(documentBlocks);
  const extractionArgs: {
    kind: RulesEntryKind;
    blocks: RulesDocumentBlock[];
    spellSlugByName?: Map<string, string>;
  } = {
    kind,
    blocks: documentBlocks
  };
  if (args.spellSlugByName) {
    extractionArgs.spellSlugByName = args.spellSlugByName;
  }
  const extracted = extractStructuredFromBlocks(extractionArgs);

  const baseDetail: RulesEntryDetail = {
    id,
    kind,
    name,
    classId,
    tags: [],
    summary,
    documentBlocks,
    extracted
  };

  if (kind === 'SUBCLASS') {
    baseDetail.parentClassId = classId;
  }

  baseDetail.tags = buildTags(baseDetail);
  return baseDetail;
};

const isUnearthedArcanaEntry = (payload: SourceEntryJson): boolean => {
  if (isUnearthedArcanaText(payload.name) || isUnearthedArcanaText(payload.page_title ?? '')) {
    return true;
  }

  const tree = payload.content?.tree ?? [];
  for (const node of tree) {
    if (node.type !== 'element' || node.tag.toLowerCase() !== 'p') {
      continue;
    }

    const text = extractTextFromNodes(asChildren(node), { preserveLineBreaks: true });
    if (!/^source:/i.test(text)) {
      continue;
    }
    if (isUnearthedArcanaText(text)) {
      return true;
    }
  }

  return false;
};

export const buildClassesPackFromContentEntries = (
  entries: EntryInput[],
  args: BuildClassesPackArgs = {}
): {
  index: ClassesPackIndex;
  details: RulesEntryDetail[];
} => {
  const filteredEntries = entries.filter((entry) => !isUnearthedArcanaEntry(entry.payload));
  const details = filteredEntries.map((entry) => normalizeEntry(entry, args));

  const entriesMeta: RulesEntryMeta[] = details.map((detail) => {
    const quick: RulesEntryMeta['quick'] = {};
    if (detail.extracted.spellcasting?.casterType) {
      quick.casterType = detail.extracted.spellcasting.casterType;
    }
    if (detail.extracted.spellcasting?.spellSlotsByLevel) {
      quick.spellSlotsByLevel = detail.extracted.spellcasting.spellSlotsByLevel;
    }
    if (Object.keys(detail.extracted.featuresByLevel).length > 0) {
      quick.featuresByLevel = detail.extracted.featuresByLevel;
    }
    if (detail.extracted.subclassLevelStart) {
      quick.subclassLevelStart = detail.extracted.subclassLevelStart;
    }
    if (Object.keys(detail.extracted.grantedSpellRefs).length > 0) {
      quick.grantedSpellRefsByLevel = detail.extracted.grantedSpellRefs;
    }

    const meta: RulesEntryMeta = {
      id: detail.id,
      kind: detail.kind,
      name: detail.name,
      classId: detail.classId,
      tags: detail.tags,
      nameFolded: toFolded(detail.name),
      summary: detail.summary,
      detailUrl: `/rules/classes/entries/${detail.id}.json`,
      quick
    };

    if (detail.parentClassId) {
      meta.parentClassId = detail.parentClassId;
    }

    return meta;
  });

  const index: ClassesPackIndex = {
    version: 1,
    generatedAt: new Date().toISOString(),
    count: entriesMeta.length,
    entriesMeta,
    ...buildBitsetIndexes(entriesMeta)
  };

  assertNoWikidotInObject(index, 'index');
  for (const detail of details) {
    assertNoWikidotInObject(detail, `detail:${detail.id}`);
  }

  return {
    index,
    details
  };
};

