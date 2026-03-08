import type { MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { getLineageDetail, getLineageMeta } from '../../rules/lineages/api/lineagesData';
import type { LineageEntryDetail } from '../../rules/lineages/types';
import { ClassDocumentBlocks } from '../../rules/classes/ui/ClassDocumentBlocks';

const isModifiedClick = (event: MouseEvent<HTMLAnchorElement>): boolean => {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
};

const QuickFactsSection = ({ detail }: { detail: LineageEntryDetail }) => {
  const rows = [
    {
      label: 'Group',
      value: detail.group
    },
    detail.setting
      ? {
          label: 'Setting',
          value: detail.setting
        }
      : null,
    detail.quickFacts.source
      ? {
          label: 'Source',
          value: detail.quickFacts.source
        }
      : null,
    detail.quickFacts.abilityScoreIncrease
      ? {
          label: 'Ability Score Increase',
          value: detail.quickFacts.abilityScoreIncrease
        }
      : null,
    detail.quickFacts.creatureType
      ? {
          label: 'Creature Type',
          value: detail.quickFacts.creatureType
        }
      : null,
    detail.quickFacts.size
      ? {
          label: 'Size',
          value: detail.quickFacts.size
        }
      : null,
    detail.quickFacts.speed
      ? {
          label: 'Speed',
          value: detail.quickFacts.speed
        }
      : null,
    detail.quickFacts.languages
      ? {
          label: 'Languages',
          value: detail.quickFacts.languages
        }
      : null,
    detail.quickFacts.darkvision
      ? {
          label: 'Darkvision',
          value: detail.quickFacts.darkvision
        }
      : null
  ].filter((entry): entry is { label: string; value: string } => !!entry);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/55 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Quick facts</h3>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((fact) => (
          <div
            key={fact.label}
            className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2"
          >
            <dt className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{fact.label}</dt>
            <dd className="mt-1 text-sm text-slate-100">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

const TraitsSection = ({ detail }: { detail: LineageEntryDetail }) => {
  if (detail.traits.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/55 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Core traits</h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {detail.traits.map((trait) => (
          <li
            key={`trait-${trait.labelKey}`}
            className="rounded border border-slate-800 bg-slate-950/40 px-3 py-2"
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{trait.label}</p>
            <p className="mt-1 text-sm leading-7 text-slate-200">{trait.value}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};

export const LineageDetailRoute = () => {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<LineageEntryDetail | null>(null);

  const meta = useMemo(() => getLineageMeta(id), [id]);
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
      setError('Lineage ID is missing.');
      setLoading(false);
      return;
    }

    if (!meta) {
      setError('Lineage entry not found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    void getLineageDetail(id)
      .then((nextDetail) => {
        if (cancelled) {
          return;
        }
        if (!nextDetail) {
          setError('Lineage detail not found.');
          setDetail(null);
          return;
        }
        setDetail(nextDetail);
        setError(null);
      })
      .catch((detailError) => {
        if (!cancelled) {
          setError(detailError instanceof Error ? detailError.message : 'Failed to load lineage detail');
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
  }, [id, meta]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 text-sm text-slate-300">
        Loading lineage detail...
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4">
        <p className="rounded border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error ?? 'Lineage not found.'}
        </p>
        <Link
          to="/rules/lineages"
          className="mt-3 inline-flex rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          Back to Races & Lineages
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/rules/lineages" className="text-xs uppercase tracking-[0.2em] text-sky-300 hover:underline">
          Races & Lineages
        </Link>
      </div>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-amber-500/70 bg-amber-950/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-200">
            Lineage
          </span>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-100">{detail.name}</h2>
        </div>
        <p className="mt-1 text-sm text-slate-300">
          {detail.group}
          {detail.setting ? ` • ${detail.setting}` : ''}
        </p>
      </header>

      <QuickFactsSection detail={detail} />
      <TraitsSection detail={detail} />

      <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Rules text</h3>
        <div className="mt-3">
          <ClassDocumentBlocks
            blocks={detail.documentBlocks}
            currentEntryId={detail.id}
            spellLinkState={spellLinkState}
            onSpellLinkClick={handleSpellLinkClick}
          />
        </div>
      </section>
    </section>
  );
};
