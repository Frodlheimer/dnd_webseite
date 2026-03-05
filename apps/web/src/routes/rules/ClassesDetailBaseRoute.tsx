import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getRulesEntryDetail, getRulesEntryMeta } from '../../rules/classes/api/classesData';
import { ClassDocumentBlocks } from '../../rules/classes/ui/ClassDocumentBlocks';
import type { RulesEntryDetail, RulesEntryKind } from '../../rules/classes/types';

const toClassLabel = (value: string): string => {
  return value
    .split('-')
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
};

const renderSpellSlotLine = (slots: number[]): string => {
  return slots
    .map((count, index) => (count > 0 ? `${index + 1}:${count}` : null))
    .filter((entry): entry is string => !!entry)
    .join(' | ');
};

const QuickFacts = ({ detail }: { detail: RulesEntryDetail }) => {
  const extracted = detail.extracted;
  const spellcasting = extracted.spellcasting;
  const featureLevels = Object.keys(extracted.featuresByLevel)
    .map((key) => Number.parseInt(key, 10))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const grantedLevels = Object.keys(extracted.grantedSpellRefs)
    .map((key) => Number.parseInt(key, 10))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/55 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Quick facts</h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {detail.kind === 'SUBCLASS' ? (
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Parent Class
            </dt>
            <dd className="mt-1 text-sm text-slate-200">{toClassLabel(detail.classId)}</dd>
          </div>
        ) : null}
        {extracted.hitDie ? (
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Hit Die</dt>
            <dd className="mt-1 text-sm text-slate-200">{extracted.hitDie}</dd>
          </div>
        ) : null}
        {extracted.primaryAbility ? (
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Primary Ability</dt>
            <dd className="mt-1 text-sm text-slate-200">{extracted.primaryAbility}</dd>
          </div>
        ) : null}
        {extracted.savingThrows && extracted.savingThrows.length > 0 ? (
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Saving Throws</dt>
            <dd className="mt-1 text-sm text-slate-200">{extracted.savingThrows.join(', ')}</dd>
          </div>
        ) : null}
        {spellcasting?.casterType ? (
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Caster Type</dt>
            <dd className="mt-1 text-sm text-slate-200">{spellcasting.casterType}</dd>
          </div>
        ) : null}
        {extracted.subclassLevelStart ? (
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Subclass Start Level
            </dt>
            <dd className="mt-1 text-sm text-slate-200">{extracted.subclassLevelStart}</dd>
          </div>
        ) : null}
      </dl>

      {spellcasting?.spellSlotsByLevel ? (
        <div className="mt-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Spell Slots by Level
          </h4>
          <div className="mt-2 grid gap-1 text-xs text-slate-300 sm:grid-cols-2">
            {spellcasting.spellSlotsByLevel.map((slots, levelIndex) => {
              const rendered = renderSpellSlotLine(slots);
              if (rendered.length === 0) {
                return null;
              }
              return (
                <p key={`slots-${levelIndex}`}>
                  Level {levelIndex + 1}: {rendered}
                </p>
              );
            })}
          </div>
        </div>
      ) : null}

      {featureLevels.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Feature Unlock Levels
          </h4>
          <div className="mt-2 grid gap-1 text-xs text-slate-300 sm:grid-cols-2">
            {featureLevels.map((level) => (
              <p key={`features-${level}`}>
                Level {level}: {(extracted.featuresByLevel[level] ?? []).join(', ')}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {grantedLevels.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Granted Spells
          </h4>
          <div className="mt-2 grid gap-1 text-xs text-slate-300 sm:grid-cols-2">
            {grantedLevels.map((level) => (
              <p key={`granted-${level}`}>
                Level {level}:{' '}
                {(extracted.grantedSpellRefs[level] ?? [])
                  .map((spell) => spell.name)
                  .join(', ')}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
};

export const ClassesDetailBaseRoute = ({ expectedKind }: { expectedKind: RulesEntryKind }) => {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RulesEntryDetail | null>(null);

  const meta = useMemo(() => getRulesEntryMeta(id), [id]);

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
          <p className="mt-1 text-sm text-slate-300">Parent class: {toClassLabel(detail.classId)}</p>
        ) : null}
      </header>

      <QuickFacts detail={detail} />

      <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Rules Text</h3>
        <div className="mt-3">
          <ClassDocumentBlocks blocks={detail.documentBlocks} />
        </div>
      </section>
    </section>
  );
};
