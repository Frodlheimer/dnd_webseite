import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { npcsRepository } from '../../dm/npcs/npcsRepository';
import { getSrdEntryDetail, getSrdEntryMeta } from '../../rules/srd/api/srdData';
import { SrdDocumentBlocks } from '../../rules/srd/ui/SrdDocumentBlocks';
import { SrdMonsterStatblock } from '../../rules/srd/ui/SrdMonsterStatblock';
import type { SrdCategory, SrdEntryDetail } from '../../rules/srd/types';

type SrdCategoryDetailBaseRouteProps = {
  category: SrdCategory;
  listPath: string;
  addNpcButton?: boolean;
};

const extractMonsterTags = (detail: SrdEntryDetail): string[] => {
  const tags: string[] = [];
  if (detail.extra.monsterType) {
    tags.push(`type:${detail.extra.monsterType}`);
  }
  if (detail.extra.challengeRating) {
    tags.push(`cr:${detail.extra.challengeRating}`);
  }
  if (detail.extra.size) {
    tags.push(`size:${detail.extra.size}`);
  }
  return tags;
};

export const SrdCategoryDetailBaseRoute = ({
  category,
  listPath,
  addNpcButton = false
}: SrdCategoryDetailBaseRouteProps) => {
  const { id = '' } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<SrdEntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addNpcState, setAddNpcState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const meta = useMemo(() => getSrdEntryMeta(category, id), [category, id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void getSrdEntryDetail(category, id)
      .then((entry) => {
        if (cancelled) {
          return;
        }
        if (!entry) {
          setError('Entry not found.');
          setDetail(null);
          return;
        }
        setDetail(entry);
      })
      .catch((detailError) => {
        if (!cancelled) {
          setError(detailError instanceof Error ? detailError.message : 'Failed to load SRD entry.');
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
  }, [category, id]);

  const handleAddNpc = async () => {
    if (!detail) {
      return;
    }
    try {
      setAddNpcState('saving');
      await npcsRepository.upsertNpc({
        name: detail.title,
        initiativeMod: detail.extra.initiativeMod ?? 0,
        tags: extractMonsterTags(detail)
      });
      setAddNpcState('saved');
      window.setTimeout(() => setAddNpcState('idle'), 1800);
    } catch {
      setAddNpcState('error');
    }
  };

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 text-sm text-slate-300">
        Loading entry...
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className="rounded-xl border border-rose-500/50 bg-rose-950/25 p-4 text-sm text-rose-200">
        {error ?? 'Entry not found.'}
      </section>
    );
  }

  const isMonsterView = category === 'monsters';

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={listPath} className="text-xs text-sky-300 hover:text-sky-200">
            Back to list
          </Link>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">{detail.title}</h2>
          <p className="mt-1 text-xs text-slate-400">{detail.sourcePageRange}</p>
        </div>
        {addNpcButton ? (
          <button
            type="button"
            onClick={() => void handleAddNpc()}
            disabled={addNpcState === 'saving'}
            className="rounded-lg border border-sky-500/60 bg-sky-950/35 px-3 py-1.5 text-sm text-sky-200 transition hover:border-sky-400 disabled:opacity-60"
          >
            {addNpcState === 'saving' ? 'Adding...' : 'Add to NPC Library'}
          </button>
        ) : null}
      </div>

      {meta?.tags.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {meta.tags.slice(0, 16).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-0.5 text-[11px] text-slate-300"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {!isMonsterView && detail.summary ? <p className="mt-4 text-sm text-slate-300">{detail.summary}</p> : null}

      {isMonsterView ? (
        <SrdMonsterStatblock detail={detail} />
      ) : (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <SrdDocumentBlocks blocks={detail.contentBlocks} />
        </div>
      )}

      {addNpcButton && addNpcState === 'saved' ? (
        <p className="mt-3 text-sm text-emerald-300">Monster added to NPC library.</p>
      ) : null}
      {addNpcButton && addNpcState === 'error' ? (
        <p className="mt-3 text-sm text-rose-300">Could not add monster to NPC library.</p>
      ) : null}
    </section>
  );
};
