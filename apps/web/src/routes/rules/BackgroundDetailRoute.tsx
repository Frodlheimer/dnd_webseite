import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { RulesDocumentBlock } from '../../rules/classes/types';
import { ClassDocumentBlocks } from '../../rules/classes/ui/ClassDocumentBlocks';
import { getBackgroundDetail, getBackgroundMeta } from '../../rules/backgrounds/api/backgroundsData';
import type { BackgroundStructuredData, RuleBlock } from '../../rules/backgrounds/model';
import { BackgroundFactsPanel } from '../../rules/backgrounds/ui/BackgroundFactsPanel';
import { BackgroundSections } from '../../rules/backgrounds/ui/BackgroundSections';

const toRenderableBlocks = (blocks: RuleBlock[]): RulesDocumentBlock[] => {
  return blocks.flatMap((block) => {
    if (block.type === 'list') {
      return [
        {
          type: block.ordered ? ('ol' as const) : ('ul' as const),
          items: block.items
        }
      ];
    }

    if (block.type === 'table') {
      const rows = block.headers ? [block.headers, ...block.rows] : block.rows;
      const mapped: RulesDocumentBlock[] = [];
      if (block.caption) {
        mapped.push({
          type: 'p',
          text: block.caption
        });
      }
      mapped.push({
        type: 'table',
        rows
      });
      return mapped;
    }

    return [block];
  });
};

export const BackgroundDetailRoute = () => {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const meta = useMemo(() => getBackgroundMeta(id), [id]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<BackgroundStructuredData | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!id) {
      setError('Background ID is missing.');
      setLoading(false);
      return;
    }

    if (!meta) {
      setError('Background entry not found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    void getBackgroundDetail(id)
      .then((nextDetail) => {
        if (cancelled) {
          return;
        }
        if (!nextDetail) {
          setError('Background detail not found.');
          setDetail(null);
          return;
        }
        setDetail(nextDetail);
        setError(null);
      })
      .catch((detailError) => {
        if (!cancelled) {
          setError(detailError instanceof Error ? detailError.message : 'Failed to load background detail');
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
        Loading background detail...
      </section>
    );
  }

  if (error || !detail || !meta) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4">
        <p className="rounded border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error ?? 'Background not found.'}
        </p>
        <Link
          to="/rules/backgrounds"
          className="mt-3 inline-flex rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          Back to Backgrounds
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
      <Link to="/rules/backgrounds" className="text-xs uppercase tracking-[0.2em] text-sky-300 hover:underline">
        Backgrounds
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-100">{detail.name}</h2>
          <span className="rounded-full border border-cyan-500/70 bg-cyan-950/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-200">
            Background
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-300">Source: Local Wikidot export</p>
        {detail.summary ? <p className="mt-3 text-sm text-slate-300">{detail.summary}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {detail.categories.map((category) => (
            <span
              key={`${detail.id}-${category}`}
              className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs text-slate-200"
            >
              {category}
            </span>
          ))}
          {detail.aliases
            .filter((alias) => alias !== detail.name)
            .map((alias) => (
              <span
                key={`${detail.id}-${alias}`}
                className="rounded-full border border-cyan-500/50 bg-cyan-950/35 px-3 py-1 text-xs text-cyan-100"
              >
                Alias: {alias}
              </span>
            ))}
        </div>
      </header>

      <BackgroundFactsPanel background={detail} />
      <BackgroundSections background={detail} />

      <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Original Rule Text</h3>
        <div className="mt-3">
          <ClassDocumentBlocks blocks={toRenderableBlocks(detail.documentBlocks)} currentEntryId={detail.id} />
        </div>
      </section>
    </section>
  );
};
