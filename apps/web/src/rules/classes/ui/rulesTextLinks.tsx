import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { classesPackIndex } from '../generated/classesIndex';
import { spellNameIndex } from '../../spells/generated/spellNameIndex';

type ReferenceKind = 'class' | 'subclass' | 'spell';

type TextReference = {
  kind: ReferenceKind;
  name: string;
  normalizedName: string;
  idOrSlug: string;
  classId?: string;
  aliasScore: number;
  singleWordAlias: boolean;
};

type RulesTextLinkifyOptions = {
  currentEntryId?: string;
  currentClassId?: string;
  allowSingleWordSubclassAliases?: boolean;
  spellLinkState?: unknown;
  onSpellLinkClick?: (event: MouseEvent<HTMLAnchorElement>, slug: string) => void;
};

const PATH_OF_ALIAS_PATTERN = /^Path of(?: the)? (.+)$/i;
const COLLEGE_OF_ALIAS_PATTERN = /^College of (.+)$/i;
const CIRCLE_OF_ALIAS_PATTERN = /^Circle of(?: the)? (.+)$/i;
const WAY_OF_ALIAS_PATTERN = /^Way of(?: the)? (.+)$/i;
const OATH_OF_ALIAS_PATTERN = /^Oath of(?: the)? (.+)$/i;
const ORDER_OF_ALIAS_PATTERN = /^Order of(?: the)? (.+)$/i;
const SCHOOL_OF_ALIAS_PATTERN = /^School of (.+)$/i;
const THE_PREFIX_ALIAS_PATTERN = /^The (.+)$/i;
const DOMAIN_SUFFIX_ALIAS_PATTERN = /^(.+?) Domain$/i;
const CONCLAVE_SUFFIX_ALIAS_PATTERN = /^(.+?) Conclave$/i;
const LEADING_NAME_TAG_PATTERN = /^\([^)]*\)\s*/;

const normalizeForLookup = (value: string): string => {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2019\u2018'`]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const stripLeadingNameTag = (value: string): string => {
  return value.replace(LEADING_NAME_TAG_PATTERN, '').trim();
};

const collectSubclassDisplayAliases = (name: string): string[] => {
  const aliases = new Set<string>();
  const addAlias = (candidate: string | undefined) => {
    if (!candidate) {
      return;
    }
    const trimmed = candidate.trim();
    if (!trimmed) {
      return;
    }
    aliases.add(trimmed);
  };

  const cleanName = stripLeadingNameTag(name);
  addAlias(name);
  addAlias(cleanName);

  const patterns = [
    PATH_OF_ALIAS_PATTERN,
    COLLEGE_OF_ALIAS_PATTERN,
    CIRCLE_OF_ALIAS_PATTERN,
    WAY_OF_ALIAS_PATTERN,
    OATH_OF_ALIAS_PATTERN,
    ORDER_OF_ALIAS_PATTERN,
    SCHOOL_OF_ALIAS_PATTERN,
    THE_PREFIX_ALIAS_PATTERN,
    DOMAIN_SUFFIX_ALIAS_PATTERN,
    CONCLAVE_SUFFIX_ALIAS_PATTERN
  ];

  for (const pattern of patterns) {
    const match = cleanName.match(pattern);
    addAlias(match?.[1]);
  }

  return [...aliases];
};

const createClassAndSubclassReferences = (): TextReference[] => {
  const references: TextReference[] = [];

  for (const entry of classesPackIndex.entriesMeta) {
    const kind: ReferenceKind = entry.kind === 'CLASS' ? 'class' : 'subclass';
    const names = entry.kind === 'SUBCLASS' ? collectSubclassDisplayAliases(entry.name) : [entry.name];

    for (const candidateName of names) {
      const normalizedName = normalizeForLookup(candidateName);
      if (!normalizedName) {
        continue;
      }

      const isAlias = candidateName !== entry.name;
      references.push({
        kind,
        name: candidateName,
        normalizedName,
        idOrSlug: entry.id,
        classId: entry.classId,
        aliasScore: isAlias ? 1 : 0,
        singleWordAlias: isAlias && candidateName.trim().split(/\s+/).length === 1
      });
    }
  }

  return references;
};

const classAndSubclassReferences = createClassAndSubclassReferences();

const spellReferences: TextReference[] = spellNameIndex.map((entry) => ({
  kind: 'spell',
  name: entry.name,
  normalizedName: normalizeForLookup(entry.nameNormalized || entry.name),
  idOrSlug: entry.slug,
  aliasScore: 0,
  singleWordAlias: false
}));

const referencesByNormalizedName = new Map<string, TextReference[]>();
const registerReference = (reference: TextReference): void => {
  const existing = referencesByNormalizedName.get(reference.normalizedName);
  if (existing) {
    existing.push(reference);
    return;
  }
  referencesByNormalizedName.set(reference.normalizedName, [reference]);
};

for (const reference of classAndSubclassReferences) {
  registerReference(reference);
}
for (const reference of spellReferences) {
  registerReference(reference);
}

const referenceNamesByLength = [...new Set([...referencesByNormalizedName.values()].flatMap((refs) => refs.map((ref) => ref.name)))]
  .sort((left, right) => right.length - left.length);

const REFERENCE_NAME_REGEX_SOURCE = referenceNamesByLength
  .map((name) => escapeRegExp(name))
  .join('|');

const REFERENCE_REGEX = REFERENCE_NAME_REGEX_SOURCE.length
  ? new RegExp(`(^|[^A-Za-z0-9])(${REFERENCE_NAME_REGEX_SOURCE})(?=$|[^A-Za-z0-9])`, 'gi')
  : null;

const kindOrder = (kind: ReferenceKind): number => {
  if (kind === 'subclass') {
    return 0;
  }
  if (kind === 'class') {
    return 1;
  }
  return 2;
};

const chooseReferenceCandidate = (
  candidates: TextReference[],
  matchedName: string,
  options: RulesTextLinkifyOptions
): TextReference | null => {
  let nextCandidates = [...candidates];

  nextCandidates = nextCandidates.filter((candidate) => {
    if (!candidate.singleWordAlias) {
      return true;
    }
    if (!options.allowSingleWordSubclassAliases) {
      return false;
    }
    return /^[A-Z]/.test(matchedName);
  });

  if (nextCandidates.length === 0) {
    return null;
  }

  if (options.currentClassId) {
    const sameClassSubclasses = nextCandidates.filter(
      (candidate) => candidate.kind === 'subclass' && candidate.classId === options.currentClassId
    );
    if (sameClassSubclasses.length > 0) {
      nextCandidates = sameClassSubclasses;
    }
  }

  const withoutSelf = nextCandidates.filter((candidate) => {
    if (candidate.kind !== 'class' && candidate.kind !== 'subclass') {
      return true;
    }
    return candidate.idOrSlug !== options.currentEntryId;
  });
  if (withoutSelf.length > 0) {
    nextCandidates = withoutSelf;
  }

  nextCandidates.sort((left, right) => {
    if (left.aliasScore !== right.aliasScore) {
      return left.aliasScore - right.aliasScore;
    }
    if (kindOrder(left.kind) !== kindOrder(right.kind)) {
      return kindOrder(left.kind) - kindOrder(right.kind);
    }
    return left.name.length - right.name.length;
  });

  return nextCandidates[0] ?? null;
};

const renderReferenceLink = (
  matchText: string,
  reference: TextReference,
  start: number,
  options: RulesTextLinkifyOptions
): ReactNode => {
  if (reference.kind === 'class') {
    return (
      <Link
        key={`class-link-${reference.idOrSlug}-${start}`}
        to={`/rules/classes/${reference.idOrSlug}`}
        className="text-emerald-300 underline decoration-emerald-600/70 underline-offset-2 hover:text-emerald-200"
      >
        {matchText}
      </Link>
    );
  }

  if (reference.kind === 'subclass') {
    return (
      <Link
        key={`subclass-link-${reference.idOrSlug}-${start}`}
        to={`/rules/subclasses/${reference.idOrSlug}`}
        className="text-indigo-300 underline decoration-indigo-600/70 underline-offset-2 hover:text-indigo-200"
      >
        {matchText}
      </Link>
    );
  }

  return (
    <Link
      key={`spell-link-${reference.idOrSlug}-${start}`}
      to={`/rules/spells/${reference.idOrSlug}`}
      state={options.spellLinkState}
      onClick={(event) => options.onSpellLinkClick?.(event, reference.idOrSlug)}
      className="text-sky-300 underline decoration-sky-600/70 underline-offset-2 hover:text-sky-200"
    >
      {matchText}
    </Link>
  );
};

const renderLineWithLinks = (
  line: string,
  lineOffset: number,
  options: RulesTextLinkifyOptions
): ReactNode[] => {
  if (!line || !REFERENCE_REGEX) {
    return [line];
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;

  REFERENCE_REGEX.lastIndex = 0;
  let match = REFERENCE_REGEX.exec(line);
  while (match) {
    const fullStart = match.index;
    const prefix = match[1] ?? '';
    const matchedName = match[2] ?? '';

    const nameStart = fullStart + prefix.length;
    const nameEnd = nameStart + matchedName.length;

    if (fullStart > cursor) {
      nodes.push(line.slice(cursor, fullStart));
    }
    if (prefix.length > 0) {
      nodes.push(prefix);
    }

    const candidates = referencesByNormalizedName.get(normalizeForLookup(matchedName)) ?? [];
    const reference = chooseReferenceCandidate(candidates, matchedName, options);
    if (!reference) {
      nodes.push(matchedName);
    } else {
      nodes.push(renderReferenceLink(matchedName, reference, lineOffset + nameStart, options));
    }

    cursor = nameEnd;
    REFERENCE_REGEX.lastIndex = nameEnd;
    match = REFERENCE_REGEX.exec(line);
  }

  if (cursor < line.length) {
    nodes.push(line.slice(cursor));
  }

  return nodes;
};

export const renderRulesTextWithLinks = (
  text: string,
  options: RulesTextLinkifyOptions = {}
): ReactNode[] => {
  if (!text) {
    return [];
  }

  const lines = text.split('\n');
  const nodes: ReactNode[] = [];
  let offset = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    nodes.push(...renderLineWithLinks(line, offset, options));
    if (index < lines.length - 1) {
      nodes.push(<br key={`line-break-${offset}-${index}`} />);
    }
    offset += line.length + 1;
  }

  return nodes;
};
