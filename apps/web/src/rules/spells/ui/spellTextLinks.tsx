import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { spellNameIndex } from '../generated/spellNameIndex';

type SpellTextLinkifyOptions = {
  currentSlug?: string;
  linkState?: unknown;
};

const normalizeForLookup = (value: string): string => {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const spellNamesByLength = [...spellNameIndex]
  .sort((left, right) => right.name.length - left.name.length)
  .map((entry) => entry.name);

const SPELL_NAME_REGEX_SOURCE = `\\b(?:${spellNamesByLength.map((name) => escapeRegExp(name)).join('|')})\\b`;

const slugByNormalizedName = new Map<string, string>(
  spellNameIndex.map((entry) => [normalizeForLookup(entry.name), entry.slug])
);

export const renderSpellTextWithLinks = (
  text: string,
  options: SpellTextLinkifyOptions
): ReactNode[] => {
  if (!text) {
    return [];
  }

  const regex = new RegExp(SPELL_NAME_REGEX_SOURCE, 'gi');
  const nodes: ReactNode[] = [];

  let cursor = 0;
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    const start = match.index;
    const end = regex.lastIndex;
    const matchText = match[0] ?? '';

    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }

    const normalized = normalizeForLookup(matchText);
    const slug = slugByNormalizedName.get(normalized);

    if (!slug || slug === options.currentSlug) {
      nodes.push(matchText);
    } else {
      nodes.push(
        <Link
          key={`spell-link-${slug}-${start}-${end}`}
          to={`/rules/spells/${slug}`}
          state={options.linkState}
          className="text-sky-300 underline decoration-sky-600/70 underline-offset-2 hover:text-sky-200"
        >
          {matchText}
        </Link>
      );
    }

    cursor = end;
    match = regex.exec(text);
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
};
