import { useMemo } from 'react';

import type { SrdContentBlock, SrdEntryDetail } from '../types';

type MonsterSectionKey =
  | 'traits'
  | 'actions'
  | 'bonus-actions'
  | 'reactions'
  | 'legendary-actions'
  | 'mythic-actions'
  | 'other';

type MonsterSectionItem =
  | {
      kind: 'entry';
      name: string;
      description: string;
    }
  | {
      kind: 'text';
      text: string;
    };

type QuickStatLabel =
  | 'Armor Class'
  | 'Hit Points'
  | 'Speed'
  | 'Saving Throws'
  | 'Skills'
  | 'Damage Vulnerabilities'
  | 'Damage Resistances'
  | 'Damage Immunities'
  | 'Condition Immunities'
  | 'Senses'
  | 'Languages'
  | 'Challenge';

type ParsedMonsterLines = {
  creatureLine: string | null;
  quickStats: Partial<Record<QuickStatLabel, string>>;
  bodyLines: string[];
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const cleanDisplayText = (value: string): string => {
  const cleaned = value
    .replace(/’|‘/g, "'")
    .replace(/“|”/g, '"')
    .replace(/—|–/g, '-')
    .replace(/…/g, '...')
    .replace(/(\d)--(?=[A-Za-z])/g, '$1-')
    .replace(/(\d)--(\d)/g, '$1-$2');
  return normalizeWhitespace(cleaned);
};

const abilityRowMatcher =
  /^\d+\s*\([+\-\u2212]?\d+\)\s+\d+\s*\([+\-\u2212]?\d+\)\s+\d+\s*\([+\-\u2212]?\d+\)\s+\d+\s*\([+\-\u2212]?\d+\)\s+\d+\s*\([+\-\u2212]?\d+\)\s+\d+\s*\([+\-\u2212]?\d+\)$/;

const sectionHeadingMap: Record<string, MonsterSectionKey> = {
  traits: 'traits',
  actions: 'actions',
  'bonus actions': 'bonus-actions',
  reactions: 'reactions',
  'legendary actions': 'legendary-actions',
  'mythic actions': 'mythic-actions'
};

const sectionTitles: Record<MonsterSectionKey, string> = {
  traits: 'Traits',
  actions: 'Actions',
  'bonus-actions': 'Bonus Actions',
  reactions: 'Reactions',
  'legendary-actions': 'Legendary Actions',
  'mythic-actions': 'Mythic Actions',
  other: 'Details'
};

const sectionOrder: MonsterSectionKey[] = [
  'traits',
  'actions',
  'bonus-actions',
  'reactions',
  'legendary-actions',
  'mythic-actions',
  'other'
];

const quickStatLabels: QuickStatLabel[] = [
  'Armor Class',
  'Hit Points',
  'Speed',
  'Saving Throws',
  'Skills',
  'Damage Vulnerabilities',
  'Damage Resistances',
  'Damage Immunities',
  'Condition Immunities',
  'Senses',
  'Languages',
  'Challenge'
];

const labelMatchers = quickStatLabels.map((label) => ({
  label,
  matcher: new RegExp(`^${label.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i')
}));

const toParagraphLines = (blocks: SrdContentBlock[], title: string): string[] => {
  const lines: string[] = [];
  for (const block of blocks) {
    if (block.type === 'p') {
      const text = cleanDisplayText(block.text);
      if (text) {
        lines.push(text);
      }
      continue;
    }

    if (
      block.type === 'h1' ||
      block.type === 'h2' ||
      block.type === 'h3' ||
      block.type === 'h4' ||
      block.type === 'h5' ||
      block.type === 'h6'
    ) {
      const headingText = cleanDisplayText(block.text);
      if (headingText && headingText.toLowerCase() !== title.toLowerCase()) {
        lines.push(headingText);
      }
    }
  }
  return lines;
};

const isSectionHeadingLine = (line: string): MonsterSectionKey | null => {
  const heading = sectionHeadingMap[line.toLowerCase()];
  return heading ?? null;
};

const matchQuickStatLine = (line: string): { label: QuickStatLabel; value: string } | null => {
  for (const { label, matcher } of labelMatchers) {
    if (!matcher.test(line)) {
      continue;
    }
    const value = normalizeWhitespace(line.replace(matcher, '').trim());
    return {
      label,
      value
    };
  }
  return null;
};

const isCreatureLine = (line: string): boolean => {
  return /^(Tiny|Small|Medium|Large|Huge|Gargantuan)\b/i.test(line);
};

const isAbilityHeaderLine = (line: string): boolean => {
  return /^STR DEX CON INT WIS CHA$/i.test(line);
};

const isActionEntryStart = (line: string): boolean => {
  return /^[A-Z][A-Za-z0-9'(),/ -]{1,100}\.\s+/.test(line);
};

const isQuickStatContinuationLine = (line: string): boolean => {
  if (!line) {
    return false;
  }
  if (isSectionHeadingLine(line)) {
    return false;
  }
  if (matchQuickStatLine(line)) {
    return false;
  }
  if (isAbilityHeaderLine(line) || abilityRowMatcher.test(line)) {
    return false;
  }
  if (isActionEntryStart(line)) {
    return false;
  }
  return true;
};

const appendValue = (current: string | undefined, value: string): string => {
  if (!value) {
    return current ?? '';
  }
  if (!current) {
    return value;
  }
  return normalizeWhitespace(`${current} ${value}`);
};

const parseMonsterLines = (lines: string[]): ParsedMonsterLines => {
  const consumed = new Set<number>();
  const quickStats: Partial<Record<QuickStatLabel, string>> = {};
  let creatureLine: string | null = null;

  let lastLabel: QuickStatLabel | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!line) {
      continue;
    }

    if (!creatureLine && index < 5 && isCreatureLine(line)) {
      creatureLine = line;
      consumed.add(index);
      lastLabel = null;
      continue;
    }

    if (isAbilityHeaderLine(line) || abilityRowMatcher.test(line)) {
      consumed.add(index);
      lastLabel = null;
      continue;
    }

    const quickStat = matchQuickStatLine(line);
    if (quickStat) {
      quickStats[quickStat.label] = appendValue(quickStats[quickStat.label], quickStat.value);
      consumed.add(index);
      lastLabel = quickStat.label;
      continue;
    }

    if (lastLabel && isQuickStatContinuationLine(line)) {
      quickStats[lastLabel] = appendValue(quickStats[lastLabel], line);
      consumed.add(index);
      continue;
    }

    lastLabel = null;
  }

  return {
    creatureLine,
    quickStats,
    bodyLines: lines.filter((_, index) => !consumed.has(index))
  };
};

const parseSpellNames = (lines: string[]): string[] => {
  const names = new Set<string>();
  for (const line of lines) {
    if (!/(cantrips|at will|\/day|spell slots|spellcasting|[1-9](st|nd|rd|th) level)/i.test(line)) {
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex < 0) {
      continue;
    }

    const tail = line.slice(colonIndex + 1);
    const chunks = tail.split(/[;,]/);
    for (const chunk of chunks) {
      const cleaned = normalizeWhitespace(
        chunk
          .replace(/\([^)]*\)/g, '')
          .replace(/\b(and|or)\b/gi, ' ')
          .replace(/[.]/g, '')
      );
      if (!cleaned || /\d/.test(cleaned) || cleaned.length < 2) {
        continue;
      }
      names.add(cleaned);
    }
  }
  return [...names].slice(0, 30);
};

const dedupe = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeWhitespace(value).toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalizeWhitespace(value));
  }
  return result;
};

const isContinuationLine = (line: string): boolean => {
  return /^[a-z0-9(["'-]/.test(line);
};

const buildSections = (lines: string[]): Record<MonsterSectionKey, MonsterSectionItem[]> => {
  const sections: Record<MonsterSectionKey, MonsterSectionItem[]> = {
    traits: [],
    actions: [],
    'bonus-actions': [],
    reactions: [],
    'legendary-actions': [],
    'mythic-actions': [],
    other: []
  };

  let current: MonsterSectionKey = 'traits';

  for (const rawLine of lines) {
    const line = cleanDisplayText(rawLine);
    if (!line) {
      continue;
    }

    const headingKey = isSectionHeadingLine(line);
    if (headingKey) {
      current = headingKey;
      continue;
    }

    const entryMatch = line.match(/^([A-Z][A-Za-z0-9'(),/ -]{1,100})\.\s+(.+)$/);
    if (entryMatch?.[1] && entryMatch?.[2]) {
      sections[current].push({
        kind: 'entry',
        name: normalizeWhitespace(entryMatch[1]),
        description: normalizeWhitespace(entryMatch[2])
      });
      continue;
    }

    const items = sections[current];
    const last = items[items.length - 1];
    if (last && last.kind === 'entry' && isContinuationLine(line)) {
      last.description = `${last.description} ${normalizeWhitespace(line)}`;
      continue;
    }

    if (last && last.kind === 'text' && isContinuationLine(line)) {
      last.text = `${last.text} ${normalizeWhitespace(line)}`;
      continue;
    }

    sections[current].push({
      kind: 'text',
      text: line
    });
  }

  return sections;
};

const sectionEntryNames = (items: MonsterSectionItem[]): string[] => {
  return items
    .filter((item): item is Extract<MonsterSectionItem, { kind: 'entry' }> => item.kind === 'entry')
    .map((item) => item.name);
};

const formatModifier = (value: number): string => {
  return value >= 0 ? `+${value}` : `${value}`;
};

const statValue = (
  parsedQuickStats: Partial<Record<QuickStatLabel, string>>,
  label: QuickStatLabel,
  fallback: string | null
): string | null => {
  const value = parsedQuickStats[label];
  if (value && value.length > 0) {
    return value;
  }
  return fallback;
};

const QuickList = ({ title, values }: { title: string; values: string[] }) => {
  if (values.length === 0) {
    return null;
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={`${title}-${value}`}
            className="rounded-md border border-slate-700 bg-slate-900/65 px-2 py-0.5 text-xs text-slate-200"
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
};

const StatRow = ({ label, value }: { label: string; value: string | null }) => {
  if (!value) {
    return null;
  }
  return (
    <p className="text-sm text-slate-200">
      <span className="font-semibold text-slate-100">{label}</span> {value}
    </p>
  );
};

export const SrdMonsterStatblock = ({ detail }: { detail: SrdEntryDetail }) => {
  const lines = useMemo(() => toParagraphLines(detail.contentBlocks, detail.title), [detail.contentBlocks, detail.title]);

  const parsedLines = useMemo(() => parseMonsterLines(lines), [lines]);

  const sections = useMemo(() => {
    return buildSections(parsedLines.bodyLines);
  }, [parsedLines.bodyLines]);

  const quickTraits = useMemo(() => {
    const fromSections = sectionEntryNames(sections.traits);
    if (fromSections.length > 0) {
      return dedupe(fromSections);
    }
    return dedupe(detail.extra.monsterTraits ?? []);
  }, [detail.extra.monsterTraits, sections.traits]);

  const quickActions = useMemo(() => {
    const fromSections = [
      ...sectionEntryNames(sections.actions),
      ...sectionEntryNames(sections['bonus-actions']),
      ...sectionEntryNames(sections.reactions),
      ...sectionEntryNames(sections['legendary-actions']),
      ...sectionEntryNames(sections['mythic-actions'])
    ];
    if (fromSections.length > 0) {
      return dedupe(fromSections);
    }
    return dedupe(detail.extra.monsterActions ?? []);
  }, [
    detail.extra.monsterActions,
    sections.actions,
    sections['bonus-actions'],
    sections.reactions,
    sections['legendary-actions'],
    sections['mythic-actions']
  ]);

  const quickSpells = useMemo(() => dedupe(parseSpellNames(parsedLines.bodyLines)), [parsedLines.bodyLines]);

  const creatureLine = useMemo(() => {
    if (parsedLines.creatureLine) {
      return parsedLines.creatureLine;
    }
    if (!detail.extra.size || !detail.extra.monsterType) {
      return null;
    }
    if (detail.extra.alignment) {
      return `${detail.extra.size} ${detail.extra.monsterType}, ${detail.extra.alignment}`;
    }
    return `${detail.extra.size} ${detail.extra.monsterType}`;
  }, [detail.extra.alignment, detail.extra.monsterType, detail.extra.size, parsedLines.creatureLine]);

  const armorClass = useMemo(
    () => statValue(parsedLines.quickStats, 'Armor Class', detail.extra.armorClass ?? null),
    [detail.extra.armorClass, parsedLines.quickStats]
  );
  const hitPoints = useMemo(
    () => statValue(parsedLines.quickStats, 'Hit Points', detail.extra.hitPoints ?? null),
    [detail.extra.hitPoints, parsedLines.quickStats]
  );
  const speed = useMemo(
    () => statValue(parsedLines.quickStats, 'Speed', detail.extra.speed ?? null),
    [detail.extra.speed, parsedLines.quickStats]
  );
  const savingThrows = useMemo(
    () => statValue(parsedLines.quickStats, 'Saving Throws', null),
    [parsedLines.quickStats]
  );
  const skills = useMemo(() => statValue(parsedLines.quickStats, 'Skills', null), [parsedLines.quickStats]);
  const damageVulnerabilities = useMemo(
    () => statValue(parsedLines.quickStats, 'Damage Vulnerabilities', null),
    [parsedLines.quickStats]
  );
  const damageResistances = useMemo(
    () => statValue(parsedLines.quickStats, 'Damage Resistances', null),
    [parsedLines.quickStats]
  );
  const damageImmunities = useMemo(
    () => statValue(parsedLines.quickStats, 'Damage Immunities', null),
    [parsedLines.quickStats]
  );
  const conditionImmunities = useMemo(
    () => statValue(parsedLines.quickStats, 'Condition Immunities', null),
    [parsedLines.quickStats]
  );
  const senses = useMemo(() => statValue(parsedLines.quickStats, 'Senses', null), [parsedLines.quickStats]);
  const languages = useMemo(
    () => statValue(parsedLines.quickStats, 'Languages', null),
    [parsedLines.quickStats]
  );
  const challenge = useMemo(
    () =>
      statValue(
        parsedLines.quickStats,
        'Challenge',
        detail.extra.challengeRating
          ? `${detail.extra.challengeRating}${detail.extra.challengeXp ? ` (${detail.extra.challengeXp})` : ''}`
          : null
      ),
    [detail.extra.challengeRating, detail.extra.challengeXp, parsedLines.quickStats]
  );

  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-lg border border-slate-700 bg-slate-950/55 p-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Quick Stats</p>
        {creatureLine ? <p className="mt-1 text-sm italic text-slate-200">{creatureLine}</p> : null}

        <div className="mt-3 space-y-1.5">
          <StatRow label="Armor Class" value={armorClass} />
          <StatRow label="Hit Points" value={hitPoints} />
          <StatRow label="Speed" value={speed} />
          <StatRow label="Saving Throws" value={savingThrows} />
          <StatRow label="Skills" value={skills} />
          <StatRow label="Damage Vulnerabilities" value={damageVulnerabilities} />
          <StatRow label="Damage Resistances" value={damageResistances} />
          <StatRow label="Damage Immunities" value={damageImmunities} />
          <StatRow label="Condition Immunities" value={conditionImmunities} />
          <StatRow label="Senses" value={senses} />
          <StatRow label="Languages" value={languages} />
          <StatRow label="Challenge" value={challenge} />
        </div>

        {detail.extra.monsterAbilities ? (
          <div className="mt-3 overflow-x-auto rounded-md border border-slate-700 bg-slate-900/55">
            <table className="min-w-full text-center text-xs sm:text-sm">
              <thead className="border-b border-slate-700 text-slate-300">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">STR</th>
                  <th className="px-2 py-1.5 font-semibold">DEX</th>
                  <th className="px-2 py-1.5 font-semibold">CON</th>
                  <th className="px-2 py-1.5 font-semibold">INT</th>
                  <th className="px-2 py-1.5 font-semibold">WIS</th>
                  <th className="px-2 py-1.5 font-semibold">CHA</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-slate-100">
                  <td className="px-2 py-2">
                    {detail.extra.monsterAbilities.str} ({formatModifier(detail.extra.monsterAbilities.strMod)})
                  </td>
                  <td className="px-2 py-2">
                    {detail.extra.monsterAbilities.dex} ({formatModifier(detail.extra.monsterAbilities.dexMod)})
                  </td>
                  <td className="px-2 py-2">
                    {detail.extra.monsterAbilities.con} ({formatModifier(detail.extra.monsterAbilities.conMod)})
                  </td>
                  <td className="px-2 py-2">
                    {detail.extra.monsterAbilities.int} ({formatModifier(detail.extra.monsterAbilities.intMod)})
                  </td>
                  <td className="px-2 py-2">
                    {detail.extra.monsterAbilities.wis} ({formatModifier(detail.extra.monsterAbilities.wisMod)})
                  </td>
                  <td className="px-2 py-2">
                    {detail.extra.monsterAbilities.cha} ({formatModifier(detail.extra.monsterAbilities.chaMod)})
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <QuickList title="Traits" values={quickTraits} />
          <QuickList title="Actions" values={quickActions} />
          <QuickList title="Spells" values={quickSpells} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        {sectionOrder
          .map((key) => ({
            key,
            items: sections[key]
          }))
          .filter((section) => section.items.length > 0)
          .map((section) => (
            <div key={section.key} className="mb-5 last:mb-0">
              <h3 className="border-b border-slate-700 pb-1 text-lg font-semibold tracking-tight text-slate-100">
                {sectionTitles[section.key]}
              </h3>
              <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-200">
                {section.items.map((item, index) => {
                  if (item.kind === 'entry') {
                    return (
                      <p key={`${section.key}-entry-${index}`}>
                        <span className="font-semibold italic text-slate-100">{item.name}.</span>{' '}
                        {item.description}
                      </p>
                    );
                  }
                  return <p key={`${section.key}-text-${index}`}>{item.text}</p>;
                })}
              </div>
            </div>
          ))}
      </section>
    </div>
  );
};
