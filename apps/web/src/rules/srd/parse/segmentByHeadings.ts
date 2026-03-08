import type { SrdContentBlock } from '../types';
import type { NormalizedSrdBlock } from './srdJsonLoader';

export type BlockSlice = {
  title: string;
  blocks: NormalizedSrdBlock[];
  pageStart: number;
  pageEnd: number;
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const slugify = (value: string): string => {
  const normalized = normalizeWhitespace(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'entry';
};

const extractPageBounds = (blocks: NormalizedSrdBlock[]): { pageStart: number; pageEnd: number } => {
  if (blocks.length === 0) {
    return {
      pageStart: 0,
      pageEnd: 0
    };
  }
  return {
    pageStart: blocks[0]?.page ?? 0,
    pageEnd: blocks[blocks.length - 1]?.page ?? 0
  };
};

export const makeEntryId = (prefix: string, title: string, used: Set<string>): string => {
  const base = `${prefix}-${slugify(title)}`;
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  let counter = 2;
  let candidate = `${base}-${counter}`;
  while (used.has(candidate)) {
    counter += 1;
    candidate = `${base}-${counter}`;
  }
  used.add(candidate);
  return candidate;
};

export const filterBlocksByPageRange = (
  blocks: NormalizedSrdBlock[],
  pageStart: number,
  pageEnd: number
): NormalizedSrdBlock[] => {
  return blocks.filter((block) => block.page >= pageStart && block.page <= pageEnd);
};

export const findFirstHeadingPage = (
  blocks: NormalizedSrdBlock[],
  matcher: RegExp,
  options?: { minPage?: number }
): number | null => {
  const minPage = options?.minPage ?? 1;
  const heading = blocks.find(
    (block) => block.kind === 'heading' && block.page >= minPage && matcher.test(block.text)
  );
  return heading?.page ?? null;
};

export const splitByHeadingLevel = (args: {
  blocks: NormalizedSrdBlock[];
  entryLevel: number;
  includeMatcher?: RegExp;
}): BlockSlice[] => {
  const slices: BlockSlice[] = [];
  let current: BlockSlice | null = null;

  for (const block of args.blocks) {
    if (block.kind === 'heading' && block.level === args.entryLevel) {
      if (args.includeMatcher && !args.includeMatcher.test(block.text)) {
        if (current) {
          current.blocks.push(block);
        }
        continue;
      }

      if (current && current.blocks.length > 0) {
        const bounds = extractPageBounds(current.blocks);
        current.pageStart = bounds.pageStart;
        current.pageEnd = bounds.pageEnd;
        slices.push(current);
      }

      current = {
        title: normalizeWhitespace(block.text),
        blocks: [block],
        pageStart: block.page,
        pageEnd: block.page
      };
      continue;
    }

    if (current) {
      current.blocks.push(block);
    }
  }

  if (current && current.blocks.length > 0) {
    const bounds = extractPageBounds(current.blocks);
    current.pageStart = bounds.pageStart;
    current.pageEnd = bounds.pageEnd;
    slices.push(current);
  }

  return slices;
};

export const firstParagraphText = (blocks: NormalizedSrdBlock[]): string => {
  const paragraph = blocks.find(
    (block): block is Extract<NormalizedSrdBlock, { kind: 'paragraph' }> =>
      block.kind === 'paragraph' && block.text.length > 0
  );
  return paragraph?.text ?? '';
};

export const toContentBlocks = (blocks: NormalizedSrdBlock[]): SrdContentBlock[] => {
  const result: SrdContentBlock[] = [];

  for (const block of blocks) {
    if (block.kind === 'heading') {
      const level = Math.max(1, Math.min(6, block.level));
      const headingType = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      result.push({
        type: headingType,
        text: block.text
      });
      continue;
    }

    if (block.kind === 'paragraph') {
      result.push({
        type: 'p',
        text: block.text
      });
      continue;
    }

    const rows: string[][] = [];
    if (block.header.length > 0) {
      rows.push(block.header);
    }
    rows.push(...block.rows);
    if (rows.length > 0) {
      result.push({
        type: 'table',
        rows
      });
    }
  }

  return result;
};
