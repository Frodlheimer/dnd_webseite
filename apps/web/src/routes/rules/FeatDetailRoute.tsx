import type { MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { getFeatDetail, getFeatMeta } from '../../rules/feats/api/featsData';
import type { FeatEntryDetail } from '../../rules/feats/types';
import { ClassDocumentBlocks } from '../../rules/classes/ui/ClassDocumentBlocks';

const isModifiedClick = (event: MouseEvent<HTMLAnchorElement>): boolean => {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
};

const QuickFactsSection = ({ detail }: { detail: FeatEntryDetail }) => {
  const rows = [
    detail.collection
      ? {
          label: 'Collection',
          value: detail.collection
        }
      : null,
    detail.quickFacts.source
      ? {
          label: 'Source',
          value: detail.quickFacts.source
        }
      : null,
    detail.quickFacts.prerequisite
      ? {
          label: 'Prerequisite',
          value: detail.quickFacts.prerequisite
        }
      : null,
    detail.quickFacts.racePrerequisites.length > 0
      ? {
          label: 'Race prerequisite',
          value: detail.quickFacts.racePrerequisites.join(', ')
        }
      : null,
    detail.quickFacts.abilityIncrease.amount > 0
      ? {
          label: 'Ability increase',
          value: `+${detail.quickFacts.abilityIncrease.amount} ${
            detail.quickFacts.abilityIncrease.abilities.includes('ALL')
              ? 'Any ability'
              : detail.quickFacts.abilityIncrease.abilities.join(', ')
          }`
        }
      : null
  ].filter((entry): entry is { label: string; value: string } => !!entry);

  if (rows.length === 0) {
    return null;
  }

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

export const FeatDetailRoute = () => {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<FeatEntryDetail | null>(null);

  const meta = useMemo(() => getFeatMeta(id), [id]);
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
      setError('Feat ID is missing.');
      setLoading(false);
      return;
    }

    if (!meta) {
      setError('Feat entry not found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    void getFeatDetail(id)
      .then((nextDetail) => {
        if (cancelled) {
          return;
        }
        if (!nextDetail) {
          setError('Feat detail not found.');
          setDetail(null);
          return;
        }
        setDetail(nextDetail);
        setError(null);
      })
      .catch((detailError) => {
        if (!cancelled) {
          setError(detailError instanceof Error ? detailError.message : 'Failed to load feat detail');
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
        Loading feat detail...
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4">
        <p className="rounded border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error ?? 'Feat not found.'}
        </p>
        <Link
          to="/rules/feats"
          className="mt-3 inline-flex rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          Back to Feats
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/rules/feats" className="text-xs uppercase tracking-[0.2em] text-sky-300 hover:underline">
          Feats
        </Link>
      </div>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-violet-500/70 bg-violet-950/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-violet-200">
            Feat
          </span>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-100">{detail.name}</h2>
        </div>
        <p className="mt-1 text-sm text-slate-300">
          {detail.group}
          {detail.collection ? ` • ${detail.collection}` : ''}
        </p>
      </header>

      <QuickFactsSection detail={detail} />

      {detail.highlights.length > 0 ? (
        <section className="rounded-lg border border-slate-800 bg-slate-950/55 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Highlights</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-200 marker:text-sky-300">
            {detail.highlights.map((highlight, index) => (
              <li key={`highlight-${index}`}>{highlight}</li>
            ))}
          </ul>
        </section>
      ) : null}

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
