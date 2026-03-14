import type { RuleBlock } from '../model';
import { collapseMultilineWhitespace, collapseWhitespace, normalizeText } from './normalizeNames';

export type BackgroundTreeNode =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'element';
      tag: string;
      children?: BackgroundTreeNode[];
    };

const renderInlineNodes = (nodes: BackgroundTreeNode[]): string => {
  return nodes
    .map((node) => {
      if (node.type === 'text') {
        return normalizeText(node.text);
      }

      if (node.tag === 'br') {
        return '\n';
      }

      return renderInlineNodes(node.children ?? []);
    })
    .join('');
};

const parseList = (node: Extract<BackgroundTreeNode, { type: 'element' }>): RuleBlock | null => {
  const ordered = node.tag === 'ol';
  const items = (node.children ?? [])
    .filter((child): child is Extract<BackgroundTreeNode, { type: 'element' }> => child.type === 'element')
    .filter((child) => child.tag === 'li')
    .map((child) => collapseWhitespace(renderInlineNodes(child.children ?? [])))
    .filter(Boolean);

  if (items.length === 0) {
    return null;
  }

  return {
    type: 'list',
    ordered,
    items
  };
};

const parseTable = (node: Extract<BackgroundTreeNode, { type: 'element' }>): RuleBlock | null => {
  const rows = (node.children ?? [])
    .filter((child): child is Extract<BackgroundTreeNode, { type: 'element' }> => child.type === 'element')
    .filter((child) => child.tag === 'tr')
    .map((row) => {
      const cells = (row.children ?? [])
        .filter((child): child is Extract<BackgroundTreeNode, { type: 'element' }> => child.type === 'element')
        .filter((child) => ['th', 'td'].includes(child.tag))
        .map((cell) => collapseWhitespace(renderInlineNodes(cell.children ?? [])))
        .filter(Boolean);
      const allHeaders = (row.children ?? [])
        .filter((child): child is Extract<BackgroundTreeNode, { type: 'element' }> => child.type === 'element')
        .filter((child) => ['th', 'td'].includes(child.tag))
        .every((cell) => cell.tag === 'th');

      return {
        cells,
        allHeaders
      };
    })
    .filter((row) => row.cells.length > 0);

  if (rows.length === 0) {
    return null;
  }

  let caption: string | undefined;
  let headers: string[] | undefined;
  const bodyRows = [...rows];

  if (bodyRows[0]?.allHeaders && bodyRows[0].cells.length === 1 && bodyRows[1]?.allHeaders) {
    caption = bodyRows.shift()?.cells[0];
  }

  if (bodyRows[0]?.allHeaders) {
    headers = bodyRows.shift()?.cells;
  }

  const tableBlock: Extract<RuleBlock, { type: 'table' }> = {
    type: 'table',
    rows: bodyRows.map((row) => row.cells)
  };
  if (caption) {
    tableBlock.caption = caption;
  }
  if (headers && headers.length > 0) {
    tableBlock.headers = headers;
  }
  return tableBlock;
};

const toRuleBlock = (node: BackgroundTreeNode): RuleBlock | null => {
  if (node.type !== 'element') {
    return null;
  }

  if (/^h[1-6]$/i.test(node.tag)) {
    const text = collapseWhitespace(renderInlineNodes(node.children ?? []));
    if (!text) {
      return null;
    }
    const headingType = node.tag.toLowerCase() as Extract<RuleBlock, { text: string }>['type'];
    return {
      type: headingType,
      text
    };
  }

  if (node.tag === 'p' || node.tag === 'blockquote' || node.tag === 'pre') {
    const text = collapseMultilineWhitespace(renderInlineNodes(node.children ?? []));
    if (!text) {
      return null;
    }
    return {
      type: 'p',
      text
    };
  }

  if (node.tag === 'ul' || node.tag === 'ol') {
    return parseList(node);
  }

  if (node.tag === 'table') {
    return parseTable(node);
  }

  return null;
};

export const treeToBlocks = (tree: BackgroundTreeNode[]): RuleBlock[] => {
  const blocks: RuleBlock[] = [];
  tree.forEach((node) => {
    const block = toRuleBlock(node);
    if (block) {
      blocks.push(block);
    }
  });
  return blocks;
};
