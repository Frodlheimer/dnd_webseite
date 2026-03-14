import type { NormalizedSrdBlock } from '../../srd/parse/srdJsonLoader';
import type { RuleBlock } from '../model';
import { normalizeRaceText, slugifyRaceId, summarizeRaceText } from './normalizeRaceText';

const raceStartMatcher = /^Dwarf$/i;
const raceEndMatcher = /^Barbarian$/i;
const subraceLeadMatcher =
  /^([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){0,2})(?:\.|\s+)(As|This|These|You)\b/;

type HeadingBlockType = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

const findHeadingPage = (blocks: NormalizedSrdBlock[], matcher: RegExp): number | null => {
  const heading = blocks.find((block) => block.kind === 'heading' && matcher.test(block.text));
  return heading?.page ?? null;
};

const toSourceRange = (blocks: NormalizedSrdBlock[]): string => {
  const pages = blocks.map((block) => block.page);
  const pageStart = pages[0] ?? 0;
  const pageEnd = pages[pages.length - 1] ?? pageStart;
  return `p.${pageStart}${pageEnd > pageStart ? `-${pageEnd}` : ''}`;
};

const headingTypeFromLevel = (level: number): HeadingBlockType => {
  return `h${Math.max(1, Math.min(6, level))}` as HeadingBlockType;
};

const blocksToRuleBlocks = (blocks: NormalizedSrdBlock[]): RuleBlock[] => {
  const result: RuleBlock[] = [];
  for (const block of blocks) {
    if (block.kind === 'heading') {
      const headingBlock: Extract<RuleBlock, { text: string; type: HeadingBlockType }> = {
        type: headingTypeFromLevel(block.level),
        text: normalizeRaceText(block.text)
      };
      result.push(headingBlock);
      continue;
    }

    if (block.kind === 'paragraph') {
      result.push({
        type: 'p',
        text: normalizeRaceText(block.text)
      });
      continue;
    }

    const tableBlock: Extract<RuleBlock, { type: 'table' }> = {
      type: 'table',
      rows: block.rows.map((row) => row.map((cell) => normalizeRaceText(cell)))
    };
    if (block.header.length > 0) {
      tableBlock.headers = block.header.map((entry) => normalizeRaceText(entry));
    }
    result.push(tableBlock);
  }
  return result;
};

const structuredTextFromBlocks = (blocks: NormalizedSrdBlock[]): string => {
  return blocks
    .map((block) => {
      if (block.kind === 'heading') {
        return normalizeRaceText(block.text);
      }
      if (block.kind === 'paragraph') {
        return normalizeRaceText(block.text);
      }
      if (block.header.length > 0) {
        return [...block.header, ...block.rows.flat()].map((entry) => normalizeRaceText(entry)).join(' ');
      }
      return block.rows.flat().map((entry) => normalizeRaceText(entry)).join(' ');
    })
    .join(' ')
    .trim();
};

const isSubraceLeadParagraph = (block: NormalizedSrdBlock): boolean => {
  if (block.kind !== 'paragraph' || !block.bold) {
    return false;
  }
  return subraceLeadMatcher.test(normalizeRaceText(block.text));
};

const getSubraceLeadName = (value: string): string | null => {
  const match = normalizeRaceText(value).match(subraceLeadMatcher);
  return match?.[1] ? normalizeRaceText(match[1]) : null;
};

type ParentRaceSection = {
  name: string;
  id: string;
  blocks: NormalizedSrdBlock[];
};

export type ExtractedRaceEntrySource = {
  id: string;
  name: string;
  parentRaceId: string | null;
  kind: 'race' | 'subrace';
  source: 'srd51';
  summary: string;
  sourcePageRange: string;
  structuredText: string;
  documentBlocks: RuleBlock[];
};

export type ExtractedRacesFromSrd = {
  entries: ExtractedRaceEntrySource[];
  parentToSubraces: Record<string, string[]>;
};

const splitParentSections = (blocks: NormalizedSrdBlock[]): ParentRaceSection[] => {
  const sections: ParentRaceSection[] = [];
  let current: ParentRaceSection | null = null;

  for (const block of blocks) {
    if (block.kind === 'heading' && block.level === 2) {
      if (current && current.blocks.length > 0) {
        sections.push(current);
      }
      const name = normalizeRaceText(block.text);
      current = {
        name,
        id: slugifyRaceId(name),
        blocks: [block]
      };
      continue;
    }

    if (current) {
      current.blocks.push(block);
    }
  }

  if (current && current.blocks.length > 0) {
    sections.push(current);
  }

  return sections;
};

const buildSubraceDocumentBlocks = (name: string, blocks: NormalizedSrdBlock[]): RuleBlock[] => {
  const documentBlocks: RuleBlock[] = [
    {
      type: 'h2',
      text: name
    }
  ];

  let consumedLead = false;
  for (const block of blocks) {
    if (block.kind !== 'paragraph') {
      documentBlocks.push(...blocksToRuleBlocks([block]));
      continue;
    }

    const text = normalizeRaceText(block.text);
    if (!consumedLead && text.startsWith(`${name} `)) {
      const trimmed = normalizeRaceText(text.slice(name.length).trim());
      if (trimmed.length > 0) {
        documentBlocks.push({
          type: 'p',
          text: trimmed
        });
      }
      consumedLead = true;
      continue;
    }

    documentBlocks.push({
      type: 'p',
      text
    });
  }

  return documentBlocks;
};

const extractEntriesFromParent = (section: ParentRaceSection): {
  parent: ExtractedRaceEntrySource;
  subraces: ExtractedRaceEntrySource[];
} => {
  const blocksAfterHeading = section.blocks.slice(1);
  const subraceStartIndices = blocksAfterHeading
    .map((block, index) => (isSubraceLeadParagraph(block) ? index : -1))
    .filter((index) => index >= 0);

  const parentStructuredBlocks =
    subraceStartIndices.length > 0 ? blocksAfterHeading.slice(0, subraceStartIndices[0]) : blocksAfterHeading;
  const parentDocumentSource = [section.blocks[0], ...parentStructuredBlocks].filter(
    (block): block is NormalizedSrdBlock => !!block
  );
  const parent = {
    id: section.id,
    name: section.name,
    parentRaceId: null,
    kind: 'race' as const,
    source: 'srd51' as const,
    summary: summarizeRaceText(structuredTextFromBlocks(parentStructuredBlocks)),
    sourcePageRange: toSourceRange(parentDocumentSource),
    structuredText: structuredTextFromBlocks(parentStructuredBlocks),
    documentBlocks: blocksToRuleBlocks(parentDocumentSource)
  };

  const subraces: ExtractedRaceEntrySource[] = [];
  for (let index = 0; index < subraceStartIndices.length; index += 1) {
    const startIndex = subraceStartIndices[index]!;
    const nextStartIndex = subraceStartIndices[index + 1] ?? blocksAfterHeading.length;
    const subraceBlocks = blocksAfterHeading.slice(startIndex, nextStartIndex);
    const lead = subraceBlocks[0];
    const name = lead && lead.kind === 'paragraph' ? getSubraceLeadName(lead.text) : null;
    if (!name) {
      continue;
    }
    subraces.push({
      id: slugifyRaceId(name),
      name,
      parentRaceId: section.id,
      kind: 'subrace',
      source: 'srd51',
      summary: summarizeRaceText(structuredTextFromBlocks(subraceBlocks)),
      sourcePageRange: toSourceRange(subraceBlocks),
      structuredText: structuredTextFromBlocks(subraceBlocks),
      documentBlocks: buildSubraceDocumentBlocks(name, subraceBlocks)
    });
  }

  return {
    parent,
    subraces
  };
};

export const extractRacesFromSrd = (blocks: NormalizedSrdBlock[]): ExtractedRacesFromSrd => {
  const raceStartPage = findHeadingPage(blocks, raceStartMatcher) ?? 3;
  const raceEndPage = (findHeadingPage(blocks, raceEndMatcher) ?? 8) - 1;
  const raceBlocks = blocks.filter((block) => block.page >= raceStartPage && block.page <= raceEndPage);
  const parentSections = splitParentSections(raceBlocks);

  const entries: ExtractedRaceEntrySource[] = [];
  const parentToSubraces: Record<string, string[]> = {};

  for (const section of parentSections) {
    const extracted = extractEntriesFromParent(section);
    entries.push(extracted.parent);
    parentToSubraces[extracted.parent.id] = extracted.subraces.map((entry) => entry.id);
    entries.push(...extracted.subraces);
  }

  return {
    entries,
    parentToSubraces
  };
};
