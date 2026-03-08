import type { FeatAbility, FeatDocumentBlock, FeatEntryDetail, FeatEntryMeta, FeatsPackIndex } from '../types';

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

export type SourceFeatJson = {
  kind?: string;
  group?: string | null;
  collection?: string | null;
  slug?: string;
  page_title?: string;
  content?: {
    tree?: SourceTreeNode[];
  };
};

type EntryInput = {
  fileName: string;
  payload: SourceFeatJson;
};

export type BuildFeatsPackResult = {
  index: FeatsPackIndex;
  details: FeatEntryDetail[];
};

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
    .replace(/\[LINK:([^|\]]*)\|([^\]]+)\]/gi, (_full, text: string, url: string) => {
      if (/wikidot/i.test(url ?? '')) {
        return (text ?? '').trim();
      }
      return (text ?? '').trim();
    })
    .replace(/\bhttps?:\/\/\S+/gi, ' ')
    .replace(/\bwww\.\S+/gi, ' ')
    .replace(/\S*wikidot\S*/gi, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
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
    .replace(/[\u2019\u2018’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const toSlug = (value: string): string => {
  return toFolded(value).replace(/\s+/g, '-');
};

const toTitleCase = (value: string): string => {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
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

const parseTreeToBlocks = (nodes: SourceTreeNode[]): FeatDocumentBlock[] => {
  const blocks: FeatDocumentBlock[] = [];

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
      const text = extractTextFromNodes(asChildren(node), {
        preserveLineBreaks: false
      });
      if (text.length > 0) {
        blocks.push({
          type: tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
          text
        });
      }
      return;
    }

    if (tag === 'p') {
      const text = extractTextFromNodes(asChildren(node), {
        preserveLineBreaks: true
      });
      appendParagraph(text);
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      const liNodes = asChildren(node).filter((child) => child.type === 'element' && child.tag.toLowerCase() === 'li');
      const items = liNodes
        .map((liNode) => extractTextFromNodes(asChildren(liNode), { preserveLineBreaks: true }))
        .map((item) => item.replace(/\n+/g, ' ').trim())
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
      if (text.length > 0) {
        blocks.push({
          type: 'pre',
          lines: text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)
        });
      }
      return;
    }

    if (tag === 'hr') {
      blocks.push({
        type: 'hr'
      });
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

const mergeAdjacentListBlocks = (blocks: FeatDocumentBlock[]): FeatDocumentBlock[] => {
  const merged: FeatDocumentBlock[] = [];

  for (const block of blocks) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      (previous.type === 'ul' || previous.type === 'ol') &&
      previous.type === block.type &&
      (block.type === 'ul' || block.type === 'ol')
    ) {
      previous.items.push(...block.items);
      continue;
    }
    merged.push(block);
  }

  return merged;
};

const isUnearthedArcanaText = (value: string): boolean => {
  const normalized = toFolded(value);
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

const toAbility = (value: string): FeatAbility | null => {
  const normalized = toFolded(value);
  if (normalized === 'strength') {
    return 'STR';
  }
  if (normalized === 'dexterity') {
    return 'DEX';
  }
  if (normalized === 'constitution') {
    return 'CON';
  }
  if (normalized === 'intelligence') {
    return 'INT';
  }
  if (normalized === 'wisdom') {
    return 'WIS';
  }
  if (normalized === 'charisma') {
    return 'CHA';
  }
  return null;
};

const parseAbilitiesFromText = (value: string): FeatAbility[] => {
  const normalized = toFolded(value);
  if (
    normalized.includes('ability score of your choice') ||
    normalized.includes('an ability score of your choice') ||
    normalized.includes('one ability score of your choice') ||
    normalized.includes('any ability score')
  ) {
    return ['ALL'];
  }

  const output = new Set<FeatAbility>();
  const tokens = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  for (const token of tokens) {
    if (new RegExp(`\\b${token}\\b`, 'i').test(value)) {
      const mapped = toAbility(token);
      if (mapped) {
        output.add(mapped);
      }
    }
  }

  return [...output];
};

const ABILITY_INCREASE_PATTERN = /(?:increase|increases?)\s+(?:your\s+)?(.+?)\s+score\s+by\s+(\d+)/i;

type RacePattern = {
  label: string;
  slug: string;
  pattern: RegExp;
};

const RACE_PREREQUISITE_PATTERNS: RacePattern[] = [
  { label: 'Half-Elf', slug: 'half-elf', pattern: /\bhalf[- ]elf\b/i },
  { label: 'Half-Orc', slug: 'half-orc', pattern: /\bhalf[- ]orc\b/i },
  { label: 'Dragonborn', slug: 'dragonborn', pattern: /\bdragonborn\b/i },
  { label: 'Tiefling', slug: 'tiefling', pattern: /\btiefling\b/i },
  { label: 'Dwarf', slug: 'dwarf', pattern: /\bdwarf\b/i },
  { label: 'Elf', slug: 'elf', pattern: /\belf\b/i },
  { label: 'Gnome', slug: 'gnome', pattern: /\bgnome\b/i },
  { label: 'Halfling', slug: 'halfling', pattern: /\bhalfling\b/i },
  { label: 'Human', slug: 'human', pattern: /\bhuman\b/i },
  { label: 'Small race', slug: 'small', pattern: /\bsmall race\b/i },
  { label: 'Genasi', slug: 'genasi', pattern: /\bgenasi\b/i },
  { label: 'Goliath', slug: 'goliath', pattern: /\bgoliath\b/i },
  { label: 'Orc', slug: 'orc', pattern: /\borc\b/i },
  { label: 'Aasimar', slug: 'aasimar', pattern: /\baasimar\b/i },
  { label: 'Changeling', slug: 'changeling', pattern: /\bchangeling\b/i },
  { label: 'Kobold', slug: 'kobold', pattern: /\bkobold\b/i },
  { label: 'Gith', slug: 'gith', pattern: /\bgith\b/i }
];

const extractSource = (blocks: FeatDocumentBlock[]): string | undefined => {
  for (const block of blocks) {
    if (block.type !== 'p') {
      continue;
    }
    const match = block.text.match(/^sou?rce\s*:\s*(.+)$/i);
    if (match?.[1]) {
      return collapseWhitespace(match[1]);
    }
  }
  return undefined;
};

const extractPrerequisite = (blocks: FeatDocumentBlock[]): string | undefined => {
  for (const block of blocks) {
    if (block.type !== 'p') {
      continue;
    }
    const match = block.text.match(/^prerequisites?\s*:\s*(.+)$/i);
    if (match?.[1]) {
      return collapseWhitespace(match[1]);
    }
  }
  return undefined;
};

const extractAbilityIncrease = (blocks: FeatDocumentBlock[]): FeatEntryDetail['quickFacts']['abilityIncrease'] => {
  const candidates: string[] = [];

  for (const block of blocks) {
    if (block.type === 'ul' || block.type === 'ol') {
      candidates.push(...block.items);
      continue;
    }
    if (block.type === 'p') {
      candidates.push(block.text);
    }
  }

  for (const candidate of candidates) {
    const anyAbilityMatch = candidate.match(
      /(?:increase|increases?)\s+(?:one|an)\s+ability\s+score(?:\s+of\s+your\s+choice)?\s+by\s+(\d+)/i
    );
    if (anyAbilityMatch) {
      const amount = Number.parseInt(anyAbilityMatch[1] ?? '', 10);
      const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 1;
      return {
        amount: safeAmount,
        mode: 'CHOICE',
        abilities: ['ALL'],
        description: collapseWhitespace(candidate)
      };
    }

    const match = candidate.match(ABILITY_INCREASE_PATTERN);
    if (!match) {
      continue;
    }

    const scopeText = collapseWhitespace(match[1] ?? '');
    const amount = Number.parseInt(match[2] ?? '', 10);
    const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 1;
    const parsedAbilities = parseAbilitiesFromText(scopeText);

    if (parsedAbilities.length === 0) {
      continue;
    }

    if (parsedAbilities.includes('ALL')) {
      return {
        amount: safeAmount,
        mode: 'CHOICE',
        abilities: ['ALL'],
        description: collapseWhitespace(candidate)
      };
    }

    if (parsedAbilities.length === 1) {
      return {
        amount: safeAmount,
        mode: 'FIXED',
        abilities: parsedAbilities,
        description: collapseWhitespace(candidate)
      };
    }

    return {
      amount: safeAmount,
      mode: 'CHOICE',
      abilities: parsedAbilities,
      description: collapseWhitespace(candidate)
    };
  }

  return {
    amount: 0,
    mode: 'NONE',
    abilities: [],
    description: ''
  };
};

const extractRacePrerequisites = (prerequisite: string | undefined): string[] => {
  if (!prerequisite) {
    return [];
  }

  const out: string[] = [];
  for (const racePattern of RACE_PREREQUISITE_PATTERNS) {
    if (racePattern.pattern.test(prerequisite)) {
      out.push(racePattern.label);
    }
  }

  return out;
};

const extractHighlights = (blocks: FeatDocumentBlock[]): string[] => {
  const listBlocks = blocks.filter(
    (
      block
    ): block is Extract<FeatDocumentBlock, { type: 'ul' | 'ol' }> => block.type === 'ul' || block.type === 'ol'
  );
  const fromLists = listBlocks
    .flatMap((block) => block.items)
    .map((item) => collapseWhitespace(item))
    .filter((item) => item.length > 0);

  const unique: string[] = [];
  for (const item of fromLists) {
    if (!unique.includes(item)) {
      unique.push(item);
    }
  }

  return unique.slice(0, 6);
};

const extractSummary = (blocks: FeatDocumentBlock[]): string => {
  for (const block of blocks) {
    if (block.type !== 'p') {
      continue;
    }
    if (/^sou?rce\s*:/i.test(block.text)) {
      continue;
    }
    if (/^prerequisites?\s*:/i.test(block.text)) {
      continue;
    }

    const text = collapseWhitespace(block.text);
    if (!text) {
      continue;
    }
    return text.length > 220 ? `${text.slice(0, 217).trimEnd()}...` : text;
  }

  return 'Built-in feat reference.';
};

const extractNameFromPayload = (payload: SourceFeatJson, fileName: string): string => {
  const pageTitle = sanitizeInlineText(payload.page_title ?? '');
  if (pageTitle.length > 0 && !/^[a-z0-9-]+$/i.test(pageTitle)) {
    return pageTitle;
  }

  const slug = sanitizeInlineText(payload.slug ?? '');
  if (slug.length > 0) {
    return toTitleCase(slug);
  }

  return toTitleCase(fileName.replace(/\.json$/i, ''));
};

const buildTags = (detail: Omit<FeatEntryDetail, 'tags'>): string[] => {
  const tags = new Set<string>();
  tags.add('kind:feat');
  tags.add(`group:${toSlug(detail.group || 'Feats')}`);

  if (detail.collection) {
    tags.add(`collection:${toSlug(detail.collection)}`);
  }

  if (detail.quickFacts.source) {
    tags.add(`source:${toSlug(detail.quickFacts.source)}`);
  }

  if (detail.quickFacts.prerequisite) {
    tags.add('has:prerequisite');
  }

  if (detail.quickFacts.abilityIncrease.amount > 0) {
    tags.add('has:ability-increase');
    for (const ability of detail.quickFacts.abilityIncrease.abilities) {
      tags.add(`ability:${ability.toLowerCase()}`);
    }
  }

  for (const race of detail.quickFacts.racePrerequisites) {
    tags.add(`race:${toSlug(race)}`);
  }

  if (detail.highlights.length > 0) {
    tags.add('has:highlights');
  }

  return [...tags].sort();
};

const buildBitsets = (entriesMeta: FeatEntryMeta[]): Pick<FeatsPackIndex, 'allTags' | 'tagCounts' | 'tagBitsets'> => {
  const words = Math.ceil(entriesMeta.length / 32);
  const tagBitsets: Record<string, number[]> = {};
  const tagCounts: Record<string, number> = {};
  const allTags = new Set<string>();

  entriesMeta.forEach((meta, index) => {
    for (const tag of meta.tags) {
      let bits = tagBitsets[tag];
      if (!bits) {
        bits = Array.from({ length: words }).map(() => 0);
        tagBitsets[tag] = bits;
      }
      const wordIndex = Math.floor(index / 32);
      const bitOffset = index % 32;
      bits[wordIndex] = (bits[wordIndex] ?? 0) | (1 << bitOffset);
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      allTags.add(tag);
    }
  });

  return {
    allTags: [...allTags].sort(),
    tagCounts,
    tagBitsets
  };
};

const assertNoWikidotInObject = (value: unknown, contextPath = 'root'): void => {
  if (typeof value === 'string') {
    if (/wikidot/i.test(value)) {
      throw new Error(`[feats:build] Forbidden reference found at ${contextPath}`);
    }
    if (/\bhttps?:\/\//i.test(value)) {
      throw new Error(`[feats:build] Forbidden URL found at ${contextPath}`);
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

const isUnearthedArcanaEntry = (entry: EntryInput): boolean => {
  const payload = entry.payload;
  if (isUnearthedArcanaText(payload.page_title ?? '')) {
    return true;
  }
  if (isUnearthedArcanaText(payload.collection ?? '')) {
    return true;
  }
  if (isUnearthedArcanaText(payload.group ?? '')) {
    return true;
  }

  const source = extractSource(mergeAdjacentListBlocks(parseTreeToBlocks(payload.content?.tree ?? [])));
  if (source && isUnearthedArcanaText(source)) {
    return true;
  }

  return false;
};

export const buildFeatsPackFromContentEntries = (entries: EntryInput[]): BuildFeatsPackResult => {
  const details: FeatEntryDetail[] = [];

  for (const entry of entries) {
    const payload = entry.payload;
    const nodes = payload.content?.tree ?? [];
    if (!Array.isArray(nodes) || nodes.length === 0) {
      continue;
    }
    if (payload.kind !== 'FEAT') {
      continue;
    }
    if (isUnearthedArcanaEntry(entry)) {
      continue;
    }

    const slugRaw = sanitizeInlineText(payload.slug ?? '');
    const slug = toSlug(slugRaw || entry.fileName.replace(/\.json$/i, ''));
    if (!slug) {
      continue;
    }

    const group = sanitizeInlineText(payload.group ?? '') || 'Feats';
    const collectionText = sanitizeInlineText(payload.collection ?? '');
    const collection = collectionText.length > 0 ? collectionText : undefined;

    const documentBlocks = mergeAdjacentListBlocks(parseTreeToBlocks(nodes));
    const source = extractSource(documentBlocks);
    const prerequisite = extractPrerequisite(documentBlocks);
    const abilityIncrease = extractAbilityIncrease(documentBlocks);
    const racePrerequisites = extractRacePrerequisites(prerequisite);
    const highlights = extractHighlights(documentBlocks);
    const summary = extractSummary(documentBlocks);
    const name = extractNameFromPayload(payload, entry.fileName);

    const baseDetail: Omit<FeatEntryDetail, 'tags'> = {
      id: slug,
      slug,
      name,
      group,
      summary,
      documentBlocks,
      quickFacts: {
        racePrerequisites,
        abilityIncrease,
        ...(source ? { source } : {}),
        ...(prerequisite ? { prerequisite } : {})
      },
      highlights,
      ...(collection ? { collection } : {})
    };

    const detail: FeatEntryDetail = {
      ...baseDetail,
      tags: buildTags(baseDetail)
    };

    details.push(detail);
  }

  details.sort((left, right) => left.name.localeCompare(right.name));

  const entriesMeta: FeatEntryMeta[] = details.map((detail) => {
    return {
      id: detail.id,
      slug: detail.slug,
      name: detail.name,
      group: detail.group,
      tags: detail.tags,
      nameFolded: toFolded(detail.name),
      summary: detail.summary,
      detailUrl: `/rules/feats/entries/${detail.id}.json`,
      quickFacts: detail.quickFacts,
      ...(detail.collection ? { collection: detail.collection } : {})
    };
  });

  const bitsets = buildBitsets(entriesMeta);

  const result: BuildFeatsPackResult = {
    index: {
      version: 1,
      generatedAt: new Date().toISOString(),
      count: entriesMeta.length,
      entriesMeta,
      ...bitsets
    },
    details
  };

  assertNoWikidotInObject(result, 'featsPack');
  return result;
};
