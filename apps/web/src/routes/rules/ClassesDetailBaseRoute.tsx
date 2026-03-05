import type { MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  getClassMeta,
  getRulesEntryDetail,
  getRulesEntryMeta,
  getSubclassesForClass
} from '../../rules/classes/api/classesData';
import { ClassDocumentBlocks } from '../../rules/classes/ui/ClassDocumentBlocks';
import type { GrantedSpellRef, RulesEntryDetail, RulesEntryKind, RulesEntryMeta } from '../../rules/classes/types';

const toClassLabel = (value: string): string => {
  return value
    .split('-')
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
};

const toOrdinalLevelLabel = (level: number): string => {
  const remainderHundred = level % 100;
  if (remainderHundred >= 11 && remainderHundred <= 13) {
    return `${level}th`;
  }

  switch (level % 10) {
    case 1:
      return `${level}st`;
    case 2:
      return `${level}nd`;
    case 3:
      return `${level}rd`;
    default:
      return `${level}th`;
  }
};

const normalizeFact = (value: string | undefined, maxLength = 90): string | null => {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    return null;
  }
  if (/(Class Features|Proficiencies|Equipment|Spellcasting)/i.test(normalized) && normalized.length > 45) {
    return null;
  }
  return normalized;
};

const asDistinctSpellRefs = (refs: GrantedSpellRef[]): GrantedSpellRef[] => {
  const byKey = new Map<string, GrantedSpellRef>();
  for (const ref of refs) {
    const key = `${ref.slug ?? ''}::${ref.name.toLowerCase()}`;
    if (!byKey.has(key)) {
      byKey.set(key, ref);
    }
  }
  return [...byKey.values()].sort((left, right) => left.name.localeCompare(right.name));
};

const flattenGrantedSpellRefs = (detail: RulesEntryDetail): GrantedSpellRef[] => {
  return asDistinctSpellRefs(
    Object.values(detail.extracted.grantedSpellRefs)
      .flatMap((refs) => refs ?? [])
      .filter((entry): entry is GrantedSpellRef => !!entry && typeof entry.name === 'string')
  );
};

const isModifiedClick = (event: MouseEvent<HTMLAnchorElement>): boolean => {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
};

const SpellRefChips = ({
  refs,
  spellLinkState,
  onSpellLinkClick
}: {
  refs: GrantedSpellRef[];
  spellLinkState: unknown;
  onSpellLinkClick: (event: MouseEvent<HTMLAnchorElement>, slug: string) => void;
}) => {
  if (refs.length === 0) {
    return <p className="text-xs text-slate-400">No linked spells.</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {refs.map((spell) => {
        if (!spell.slug) {
          return (
            <span
              key={`spell-text-${spell.name}`}
              className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-200"
            >
              {spell.name}
            </span>
          );
        }

        return (
          <Link
            key={`spell-link-${spell.slug}-${spell.name}`}
            to={`/rules/spells/${spell.slug}`}
            state={spellLinkState}
            onClick={(event) => onSpellLinkClick(event, spell.slug!)}
            className="rounded-full border border-sky-600/60 bg-sky-950/35 px-2 py-1 text-[11px] text-sky-200 hover:border-sky-500 hover:text-sky-100"
          >
            {spell.name}
          </Link>
        );
      })}
    </div>
  );
};

const QuickFacts = ({
  detail,
  parentClassMeta,
  spellLinkState,
  onSpellLinkClick
}: {
  detail: RulesEntryDetail;
  parentClassMeta: RulesEntryMeta | null;
  spellLinkState: unknown;
  onSpellLinkClick: (event: MouseEvent<HTMLAnchorElement>, slug: string) => void;
}) => {
  const extracted = detail.extracted;
  const spellcasting = extracted.spellcasting;
  const factTiles: Array<{ label: string; value: string }> = [];

  if (detail.kind === 'SUBCLASS') {
    factTiles.push({
      label: 'Parent Class',
      value: parentClassMeta?.name ?? toClassLabel(detail.classId)
    });
  }

  const hitDie = normalizeFact(extracted.hitDie, 50);
  if (hitDie) {
    factTiles.push({
      label: 'Hit Die',
      value: hitDie
    });
  }

  const primaryAbility = normalizeFact(extracted.primaryAbility, 70);
  if (primaryAbility) {
    factTiles.push({
      label: 'Primary Ability',
      value: primaryAbility
    });
  }

  if (extracted.savingThrows && extracted.savingThrows.length > 0) {
    factTiles.push({
      label: 'Saving Throws',
      value: extracted.savingThrows.join(', ')
    });
  }

  if (spellcasting?.casterType) {
    factTiles.push({
      label: 'Caster Type',
      value: spellcasting.casterType
    });
  }

  if (extracted.subclassLevelStart) {
    factTiles.push({
      label: 'Subclass Start Level',
      value: String(extracted.subclassLevelStart)
    });
  }

  const featureLevels = Object.keys(extracted.featuresByLevel)
    .map((key) => Number.parseInt(key, 10))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const grantedLevels = Object.keys(extracted.grantedSpellRefs)
    .map((key) => Number.parseInt(key, 10))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const spellSlotRows = (spellcasting?.spellSlotsByLevel ?? [])
    .map((slots, levelIndex) => {
      const highestSlotLevel = slots.reduce((highest, count, slotIndex) => {
        if (count > 0) {
          return slotIndex + 1;
        }
        return highest;
      }, 0);
      return {
        characterLevel: levelIndex + 1,
        slots,
        highestSlotLevel
      };
    })
    .filter((row) => row.highestSlotLevel > 0);
  const maxSpellSlotLevel = spellSlotRows.reduce(
    (highest, row) => Math.max(highest, row.highestSlotLevel),
    0
  );

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/55 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Quick facts</h3>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {factTiles.map((fact) => (
          <div
            key={fact.label}
            className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2"
          >
            <dt className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{fact.label}</dt>
            <dd className="mt-1 text-sm text-slate-100">
              {fact.label === 'Parent Class' && parentClassMeta ? (
                <Link
                  to={`/rules/classes/${parentClassMeta.id}`}
                  className="text-emerald-300 underline decoration-emerald-600/70 underline-offset-2 hover:text-emerald-200"
                >
                  {fact.value}
                </Link>
              ) : (
                fact.value
              )}
            </dd>
          </div>
        ))}
      </dl>

      {spellSlotRows.length > 0 ? (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Spell Slots by Character Level
          </h4>
          <p className="mt-1 text-xs text-slate-400">
            Row = character level, columns = available spell slots.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/35">
            <table className="w-full min-w-[680px] border-separate border-spacing-0 text-xs">
              <thead>
                <tr className="bg-slate-900/70 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                  <th className="sticky left-0 z-[1] border-b border-r border-slate-800 bg-slate-900/90 px-3 py-2 text-left">
                    Character Level
                  </th>
                  {Array.from(
                    {
                      length: maxSpellSlotLevel
                    },
                    (_, slotIndex) => (
                      <th
                        key={`slot-header-${slotIndex + 1}`}
                        className="border-b border-slate-800 px-2 py-2 text-center"
                      >
                        {toOrdinalLevelLabel(slotIndex + 1)}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {spellSlotRows.map((row) => (
                  <tr key={`slots-row-${row.characterLevel}`} className="odd:bg-slate-950/20 even:bg-slate-950/45">
                    <th className="sticky left-0 z-[1] border-b border-r border-slate-800 bg-slate-900/90 px-3 py-2 text-left font-medium text-slate-200">
                      Level {row.characterLevel}
                    </th>
                    {Array.from(
                      {
                        length: maxSpellSlotLevel
                      },
                      (_, slotIndex) => {
                        const count = row.slots[slotIndex] ?? 0;
                        return (
                          <td
                            key={`slots-row-${row.characterLevel}-slot-${slotIndex + 1}`}
                            className="border-b border-slate-800 px-2 py-2 text-center"
                          >
                            {count > 0 ? (
                              <span className="inline-flex min-w-7 items-center justify-center rounded-full border border-sky-600/70 bg-sky-950/45 px-2 py-0.5 font-semibold text-sky-200">
                                {count}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                        );
                      }
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {featureLevels.length > 0 ? (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Feature Unlock Levels
          </h4>
          <ul className="mt-2 grid gap-2 text-xs text-slate-200 sm:grid-cols-2">
            {featureLevels.map((level) => (
              <li key={`features-${level}`} className="rounded border border-slate-800 bg-slate-950/40 px-2 py-1">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Level {level}</p>
                <p className="mt-0.5 text-slate-100">{(extracted.featuresByLevel[level] ?? []).join(', ')}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {grantedLevels.length > 0 ? (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Granted Spells
          </h4>
          <ul className="mt-2 grid gap-2 text-xs text-slate-200 sm:grid-cols-2">
            {grantedLevels.map((level) => (
              <li key={`granted-${level}`} className="rounded border border-slate-800 bg-slate-950/40 px-2 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Level {level}</p>
                <SpellRefChips
                  refs={asDistinctSpellRefs(extracted.grantedSpellRefs[level] ?? [])}
                  spellLinkState={spellLinkState}
                  onSpellLinkClick={onSpellLinkClick}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};

const BacklinksSection = ({
  detail,
  parentClassMeta,
  siblingSubclasses,
  classSubclasses,
  spellLinkState,
  onSpellLinkClick
}: {
  detail: RulesEntryDetail;
  parentClassMeta: RulesEntryMeta | null;
  siblingSubclasses: RulesEntryMeta[];
  classSubclasses: RulesEntryMeta[];
  spellLinkState: unknown;
  onSpellLinkClick: (event: MouseEvent<HTMLAnchorElement>, slug: string) => void;
}) => {
  const linkedSpellRefs = useMemo(() => flattenGrantedSpellRefs(detail), [detail]);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/55 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Backlinks</h3>

      {detail.kind === 'SUBCLASS' ? (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Parent Class</p>
          {parentClassMeta ? (
            <Link
              to={`/rules/classes/${parentClassMeta.id}`}
              className="mt-1 inline-flex rounded-full border border-emerald-600/60 bg-emerald-950/35 px-3 py-1 text-xs text-emerald-200 hover:border-emerald-500"
            >
              {parentClassMeta.name}
            </Link>
          ) : (
            <p className="mt-1 text-sm text-slate-300">{toClassLabel(detail.classId)}</p>
          )}
        </div>
      ) : null}

      {detail.kind === 'CLASS' && classSubclasses.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Subclasses</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {classSubclasses.map((subclass) => (
              <Link
                key={`subclass-backlink-${subclass.id}`}
                to={`/rules/subclasses/${subclass.id}`}
                className="rounded-full border border-sky-600/60 bg-sky-950/35 px-3 py-1 text-xs text-sky-200 hover:border-sky-500"
              >
                {subclass.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {detail.kind === 'SUBCLASS' && siblingSubclasses.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Other Subclasses</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {siblingSubclasses.map((subclass) => (
              <Link
                key={`sibling-backlink-${subclass.id}`}
                to={`/rules/subclasses/${subclass.id}`}
                className="rounded-full border border-sky-600/60 bg-sky-950/35 px-3 py-1 text-xs text-sky-200 hover:border-sky-500"
              >
                {subclass.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {linkedSpellRefs.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Referenced Spells</p>
          <SpellRefChips
            refs={linkedSpellRefs}
            spellLinkState={spellLinkState}
            onSpellLinkClick={onSpellLinkClick}
          />
        </div>
      ) : null}
    </section>
  );
};

export const ClassesDetailBaseRoute = ({ expectedKind }: { expectedKind: RulesEntryKind }) => {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RulesEntryDetail | null>(null);

  const meta = useMemo(() => getRulesEntryMeta(id), [id]);
  const parentClassMeta = useMemo(() => {
    if (!detail || detail.kind !== 'SUBCLASS') {
      return null;
    }
    return getClassMeta(detail.classId);
  }, [detail]);

  const classSubclasses = useMemo(() => {
    if (!detail || detail.kind !== 'CLASS') {
      return [];
    }
    return getSubclassesForClass(detail.classId);
  }, [detail]);

  const siblingSubclasses = useMemo(() => {
    if (!detail || detail.kind !== 'SUBCLASS') {
      return [];
    }
    return getSubclassesForClass(detail.classId).filter((entry) => entry.id !== detail.id);
  }, [detail]);

  const spellLinkState = useMemo(
    () => ({
      backgroundLocation: location
    }),
    [location]
  );

  const handleSpellLinkClick = (event: MouseEvent<HTMLAnchorElement>, slug: string) => {
    if (isModifiedClick(event)) {
      return;
    }
    event.preventDefault();
    navigate(`/rules/spells/${slug}`, {
      state: {
        backgroundLocation: location
      }
    });
  };

  useEffect(() => {
    let cancelled = false;

    if (!id) {
      setError('Entry ID is missing.');
      setLoading(false);
      return;
    }

    if (!meta) {
      setError('Rules entry not found.');
      setLoading(false);
      return;
    }

    if (meta.kind !== expectedKind) {
      setError(`The requested entry is not a ${expectedKind.toLowerCase()}.`);
      setLoading(false);
      return;
    }

    setLoading(true);
    void getRulesEntryDetail(id)
      .then((nextDetail) => {
        if (cancelled) {
          return;
        }
        if (!nextDetail) {
          setError('Rules entry detail not found.');
          setDetail(null);
          return;
        }
        setDetail(nextDetail);
        setError(null);
      })
      .catch((detailError) => {
        if (!cancelled) {
          setError(
            detailError instanceof Error ? detailError.message : 'Failed to load entry detail'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [expectedKind, id, meta]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 text-sm text-slate-300">
        Loading entry detail...
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4">
        <p className="rounded border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error ?? 'Entry not found.'}
        </p>
        <Link
          to="/rules/classes"
          className="mt-3 inline-flex rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          Back to Classes & Subclasses
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/rules/classes" className="text-xs uppercase tracking-[0.2em] text-sky-300 hover:underline">
          Classes & Subclasses
        </Link>
      </div>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${
              detail.kind === 'CLASS'
                ? 'border border-emerald-500/60 bg-emerald-950/40 text-emerald-200'
                : 'border border-sky-500/60 bg-sky-950/40 text-sky-200'
            }`}
          >
            {detail.kind === 'CLASS' ? 'Class' : 'Subclass'}
          </span>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-100">{detail.name}</h2>
        </div>
        {detail.kind === 'SUBCLASS' ? (
          <p className="mt-1 text-sm text-slate-300">
            Parent class:{' '}
            {parentClassMeta ? (
              <Link
                to={`/rules/classes/${parentClassMeta.id}`}
                className="text-emerald-300 underline decoration-emerald-600/70 underline-offset-2 hover:text-emerald-200"
              >
                {parentClassMeta.name}
              </Link>
            ) : (
              toClassLabel(detail.classId)
            )}
          </p>
        ) : null}
      </header>

      <QuickFacts
        detail={detail}
        parentClassMeta={parentClassMeta}
        spellLinkState={spellLinkState}
        onSpellLinkClick={handleSpellLinkClick}
      />

      <BacklinksSection
        detail={detail}
        parentClassMeta={parentClassMeta}
        siblingSubclasses={siblingSubclasses}
        classSubclasses={classSubclasses}
        spellLinkState={spellLinkState}
        onSpellLinkClick={handleSpellLinkClick}
      />

      <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Rules Text</h3>
        <div className="mt-3">
          <ClassDocumentBlocks
            blocks={detail.documentBlocks}
            currentEntryId={detail.id}
            currentClassId={detail.classId}
            spellLinkState={spellLinkState}
            onSpellLinkClick={handleSpellLinkClick}
          />
        </div>
      </section>
    </section>
  );
};
