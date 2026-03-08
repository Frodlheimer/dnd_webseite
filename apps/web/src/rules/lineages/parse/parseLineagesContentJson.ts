import type {
  LineageDocumentBlock,
  LineageEntryDetail,
  LineageEntryMeta,
  LineageQuickFacts,
  LineageTrait,
  LineagesPackIndex
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

export type SourceLineageJson = {
  kind?: string;
  group?: string | null;
  setting?: string | null;
  slug?: string;
  page_title?: string;
  content?: {
    tree?: SourceTreeNode[];
  };
};

type EntryInput = {
  fileName: string;
  payload: SourceLineageJson;
};

export type BuildLineagesPackResult = {
  index: LineagesPackIndex;
  details: LineageEntryDetail[];
};

const TRAIT_ITEM_PATTERN = /^([A-Za-z][A-Za-z0-9'()/+\- ]{1,50})\.\s*(.+)$/;

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
    .replace(/[\u2019\u2018â€™'`]/g, '')
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

const parseTreeToBlocks = (nodes: SourceTreeNode[]): LineageDocumentBlock[] => {
  const blocks: LineageDocumentBlock[] = [];

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

const mergeAdjacentListBlocks = (blocks: LineageDocumentBlock[]): LineageDocumentBlock[] => {
  const merged: LineageDocumentBlock[] = [];

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

const extractTraits = (blocks: LineageDocumentBlock[]): LineageTrait[] => {
  const out: LineageTrait[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    if (block.type !== 'ul' && block.type !== 'ol') {
      continue;
    }

    for (const item of block.items) {
      const normalizedItem = collapseWhitespace(item);
      const match = normalizedItem.match(TRAIT_ITEM_PATTERN);
      if (!match) {
        continue;
      }

      const label = collapseWhitespace((match[1] ?? '').replace(/[:.]$/, ''));
      const value = collapseWhitespace(match[2] ?? '');
      if (!label || !value) {
        continue;
      }

      const labelKey = toSlug(label);
      if (seen.has(labelKey)) {
        continue;
      }
      seen.add(labelKey);

      out.push({
        label,
        labelKey,
        value
      });
    }
  }

  return out;
};

const findSource = (blocks: LineageDocumentBlock[]): string | undefined => {
  for (const block of blocks) {
    if (block.type !== 'p') {
      continue;
    }
    const match = block.text.match(/^source\s*:\s*(.+)$/i);
    if (match && match[1]) {
      return collapseWhitespace(match[1]);
    }
  }
  return undefined;
};

const findFirstSummary = (blocks: LineageDocumentBlock[], traits: LineageTrait[]): string => {
  for (const block of blocks) {
    if (block.type !== 'p') {
      continue;
    }
    if (/^source\s*:/i.test(block.text)) {
      continue;
    }
    const text = collapseWhitespace(block.text);
    if (!text) {
      continue;
    }
    return text.length > 220 ? `${text.slice(0, 217).trimEnd()}...` : text;
  }

  const firstTrait = traits[0];
  if (firstTrait) {
    const text = `${firstTrait.label}: ${firstTrait.value}`;
    return text.length > 220 ? `${text.slice(0, 217).trimEnd()}...` : text;
  }

  return 'Built-in lineage reference entry.';
};

const firstTraitValue = (
  traitsByKey: Map<string, string>,
  labelCandidates: string[]
): string | undefined => {
  for (const candidate of labelCandidates) {
    const value = traitsByKey.get(toSlug(candidate));
    if (value) {
      return value;
    }
  }
  return undefined;
};

const extractQuickFacts = (
  blocks: LineageDocumentBlock[],
  traits: LineageTrait[]
): LineageQuickFacts => {
  const traitsByKey = new Map(traits.map((trait) => [trait.labelKey, trait.value]));
  const quickFacts: LineageQuickFacts = {};

  const source = findSource(blocks);
  if (source) {
    quickFacts.source = source;
  }

  const abilityScoreIncrease = firstTraitValue(traitsByKey, ['ability score increase']);
  if (abilityScoreIncrease) {
    quickFacts.abilityScoreIncrease = abilityScoreIncrease;
  }

  const creatureType = firstTraitValue(traitsByKey, ['creature type']);
  if (creatureType) {
    quickFacts.creatureType = creatureType;
  }

  const size = firstTraitValue(traitsByKey, ['size']);
  if (size) {
    quickFacts.size = size;
  }

  const speed = firstTraitValue(traitsByKey, ['speed']);
  if (speed) {
    quickFacts.speed = speed;
  }

  const languages = firstTraitValue(traitsByKey, ['languages']);
  if (languages) {
    quickFacts.languages = languages;
  }

  const darkvision = firstTraitValue(traitsByKey, ['darkvision']);
  if (darkvision) {
    quickFacts.darkvision = darkvision;
  }

  if (quickFacts.speed) {
    const match = quickFacts.speed.match(/(\d+)\s*feet/i);
    if (match?.[1]) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed)) {
        quickFacts.speedFeet = parsed;
      }
    }
  }

  return quickFacts;
};

const extractGroupFromFileName = (fileName: string): string => {
  const withoutExt = fileName.replace(/\.json$/i, '');
  const groupPart = withoutExt.split('__')[0] ?? '';
  const normalized = groupPart.replace(/_/g, ' ').trim();
  return normalized.length > 0 ? normalized : 'Lineages';
};

const buildTags = (args: {
  groupSlug: string;
  settingSlug?: string;
  quickFacts: LineageQuickFacts;
  traits: LineageTrait[];
  documentBlocks: LineageDocumentBlock[];
}): string[] => {
  const tags = new Set<string>();
  tags.add('kind:lineage');
  tags.add(`group:${args.groupSlug}`);
  if (args.settingSlug) {
    tags.add(`setting:${args.settingSlug}`);
  } else {
    tags.add('setting:none');
  }

  if (args.quickFacts.source) {
    tags.add(`source:${toSlug(args.quickFacts.source)}`);
  }

  if (args.traits.length > 0) {
    tags.add('has:traits');
    for (const trait of args.traits.slice(0, 16)) {
      tags.add(`trait:${trait.labelKey}`);
    }
  }

  if (args.documentBlocks.some((block) => block.type === 'table')) {
    tags.add('has:table');
  }

  if (args.quickFacts.darkvision) {
    tags.add('has:darkvision');
  }

  if (args.quickFacts.abilityScoreIncrease) {
    tags.add('has:asi');
  }

  if (args.quickFacts.speedFeet) {
    tags.add(`speed:${args.quickFacts.speedFeet}`);
  }

  if (args.quickFacts.size) {
    const folded = toFolded(args.quickFacts.size);
    if (folded.includes('small')) {
      tags.add('size:small');
    }
    if (folded.includes('medium')) {
      tags.add('size:medium');
    }
    if (folded.includes('large')) {
      tags.add('size:large');
    }
  }

  return [...tags].sort();
};

const buildBitsets = (entriesMeta: LineageEntryMeta[]): Pick<
  LineagesPackIndex,
  'allTags' | 'tagCounts' | 'tagBitsets'
> => {
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

const buildDisplayName = (slug: string, pageTitle?: string): string => {
  const fromTitle = sanitizeInlineText(pageTitle ?? '');
  if (fromTitle.length > 0 && !/^[a-z0-9-]+$/i.test(fromTitle)) {
    return fromTitle;
  }
  return toTitleCase(slug);
};

export const buildLineagesPackFromContentEntries = (
  entries: EntryInput[]
): BuildLineagesPackResult => {
  const details: LineageEntryDetail[] = [];

  for (const entry of entries) {
    const payload = entry.payload;
    const nodes = payload.content?.tree ?? [];
    if (!Array.isArray(nodes) || nodes.length === 0) {
      continue;
    }

    const slugRaw = sanitizeInlineText(payload.slug ?? '');
    const slug = toSlug(slugRaw || entry.fileName.replace(/\.json$/i, ''));
    if (!slug) {
      continue;
    }

    const groupLabelRaw = sanitizeInlineText(payload.group ?? '');
    const groupLabel = groupLabelRaw || extractGroupFromFileName(entry.fileName);
    const groupSlug = toSlug(groupLabel);

    const settingRaw = sanitizeInlineText(payload.setting ?? '');
    const setting = settingRaw || undefined;
    const settingSlug = setting ? toSlug(setting) : undefined;

    const baseBlocks = parseTreeToBlocks(nodes);
    const documentBlocks = mergeAdjacentListBlocks(baseBlocks);
    const traits = extractTraits(documentBlocks);
    const quickFacts = extractQuickFacts(documentBlocks, traits);
    const summary = findFirstSummary(documentBlocks, traits);
    const name = buildDisplayName(slug, payload.page_title);

    const tags = buildTags({
      groupSlug,
      quickFacts,
      traits,
      documentBlocks,
      ...(settingSlug ? { settingSlug } : {})
    });

    const detail: LineageEntryDetail = {
      id: slug,
      slug,
      name,
      group: groupLabel,
      groupSlug,
      tags,
      summary,
      documentBlocks,
      traits,
      quickFacts
    };

    if (setting) {
      detail.setting = setting;
    }
    if (settingSlug) {
      detail.settingSlug = settingSlug;
    }

    details.push(detail);
  }

  details.sort((left, right) => {
    const groupCompare = left.group.localeCompare(right.group);
    if (groupCompare !== 0) {
      return groupCompare;
    }

    const settingLeft = left.setting ?? '';
    const settingRight = right.setting ?? '';
    const settingCompare = settingLeft.localeCompare(settingRight);
    if (settingCompare !== 0) {
      return settingCompare;
    }

    return left.name.localeCompare(right.name);
  });

  const entriesMeta: LineageEntryMeta[] = details.map((detail) => {
    const meta: LineageEntryMeta = {
      id: detail.id,
      slug: detail.slug,
      name: detail.name,
      group: detail.group,
      groupSlug: detail.groupSlug,
      tags: detail.tags,
      nameFolded: toFolded(detail.name),
      summary: detail.summary,
      detailUrl: `/rules/lineages/entries/${detail.id}.json`,
      quickFacts: detail.quickFacts
    };

    if (detail.setting) {
      meta.setting = detail.setting;
    }
    if (detail.settingSlug) {
      meta.settingSlug = detail.settingSlug;
    }

    return meta;
  });

  const bitsetData = buildBitsets(entriesMeta);

  return {
    index: {
      version: 1,
      generatedAt: new Date().toISOString(),
      count: entriesMeta.length,
      entriesMeta,
      ...bitsetData
    },
    details
  };
};
