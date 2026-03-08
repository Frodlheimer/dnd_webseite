import { readFileSync } from 'node:fs';

type SourceSpan = {
  text?: string;
  size?: number;
  bold?: boolean;
};

type SourceBlock = {
  type?: string;
  text?: string;
  level?: number;
  column?: number;
  bbox?: number[];
  spans?: SourceSpan[];
  header_texts?: string[];
  rows_text?: string[][];
};

type SourcePage = {
  page_number?: number;
  blocks?: SourceBlock[];
};

type SourceSrdJson = {
  pages?: SourcePage[];
};

export type NormalizedSrdBlock =
  | {
      kind: 'heading';
      page: number;
      column: number;
      y: number;
      text: string;
      level: number;
    }
  | {
      kind: 'paragraph';
      page: number;
      column: number;
      y: number;
      text: string;
      size: number;
      bold: boolean;
    }
  | {
      kind: 'table';
      page: number;
      column: number;
      y: number;
      header: string[];
      rows: string[][];
    };

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const decodeCommonMojibake = (value: string): string => {
  return value
    .replaceAll('Ã¢â‚¬Â¢', '•')
    .replaceAll('â€¢', '•')
    .replaceAll('Ã¢â‚¬Å“', '"')
    .replaceAll('Ã¢â‚¬\u009d', '"')
    .replaceAll('â€œ', '"')
    .replaceAll('â€\u009d', '"')
    .replaceAll('â€', '"')
    .replaceAll('Ã¢â‚¬â„¢', "'")
    .replaceAll('â€™', "'")
    .replaceAll('Ã¢â‚¬â€œ', '-')
    .replaceAll('Ã¢â‚¬â€', '--')
    .replaceAll('â€“', '-')
    .replaceAll('â€”', '--')
    .replaceAll('Ã‚', '');
};

const sanitizeText = (value: string): string => normalizeWhitespace(decodeCommonMojibake(value));

const blockY = (block: SourceBlock): number => {
  if (Array.isArray(block.bbox) && typeof block.bbox[1] === 'number') {
    return block.bbox[1];
  }
  return Number.MAX_SAFE_INTEGER;
};

const isLikelyHeaderFooter = (text: string): boolean => {
  if (!text) {
    return true;
  }

  if (/^\d+$/.test(text)) {
    return true;
  }

  if (/^system reference document 5\.1$/i.test(text)) {
    return true;
  }

  if (/^table of contents$/i.test(text)) {
    return true;
  }

  return false;
};

const normalizeHeadingText = (text: string): string => {
  const clean = sanitizeText(text);
  const duplicateMatch = clean.match(/^(.+?)\s+\1\s+Traits$/i);
  if (duplicateMatch?.[1]) {
    return duplicateMatch[1].trim();
  }
  return clean;
};

const toNormalizedBlock = (page: number, source: SourceBlock): NormalizedSrdBlock | null => {
  const type = source.type ?? '';
  const column = typeof source.column === 'number' ? source.column : 0;
  const y = blockY(source);

  if (type === 'heading') {
    const text = normalizeHeadingText(source.text ?? '');
    if (isLikelyHeaderFooter(text)) {
      return null;
    }
    const level = typeof source.level === 'number' ? source.level : 3;
    return {
      kind: 'heading',
      page,
      column,
      y,
      text,
      level: Math.max(1, Math.min(6, level))
    };
  }

  if (type === 'paragraph') {
    const text = sanitizeText(source.text ?? '');
    if (isLikelyHeaderFooter(text)) {
      return null;
    }
    const firstSpan = source.spans?.find((span) => typeof span.text === 'string' && span.text.trim().length > 0);
    return {
      kind: 'paragraph',
      page,
      column,
      y,
      text,
      size: typeof firstSpan?.size === 'number' ? firstSpan.size : 0,
      bold: Boolean(firstSpan?.bold)
    };
  }

  if (type === 'table') {
    const header = Array.isArray(source.header_texts)
      ? source.header_texts.map((entry) => sanitizeText(entry)).filter(Boolean)
      : [];
    const rows = Array.isArray(source.rows_text)
      ? source.rows_text
          .map((row) => row.map((cell) => sanitizeText(cell ?? '')).filter(Boolean))
          .filter((row) => row.length > 0)
      : [];
    if (header.length === 0 && rows.length === 0) {
      return null;
    }
    return {
      kind: 'table',
      page,
      column,
      y,
      header,
      rows
    };
  }

  return null;
};

export const loadSrdJson = (inputPath: string): SourceSrdJson => {
  const raw = readFileSync(inputPath, 'utf8');
  return JSON.parse(raw) as SourceSrdJson;
};

export const normalizeSrdBlocks = (source: SourceSrdJson): NormalizedSrdBlock[] => {
  const normalized: NormalizedSrdBlock[] = [];
  for (const page of source.pages ?? []) {
    const pageNumber = typeof page.page_number === 'number' ? page.page_number : 0;
    if (!Array.isArray(page.blocks)) {
      continue;
    }
    for (const block of page.blocks) {
      const normalizedBlock = toNormalizedBlock(pageNumber, block);
      if (normalizedBlock) {
        normalized.push(normalizedBlock);
      }
    }
  }

  normalized.sort((left, right) => {
    if (left.page !== right.page) {
      return left.page - right.page;
    }
    if (left.column !== right.column) {
      return left.column - right.column;
    }
    return left.y - right.y;
  });

  return normalized;
};

export const foldSrdText = (value: string): string => {
  return sanitizeText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};
