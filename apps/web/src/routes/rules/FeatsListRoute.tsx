import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { formatFeatsTagLabel } from '../../rules/feats/ui/tagLabels';
import type { FeatsTagGroups } from '../../rules/feats/worker/filterFeats';
import { featsWorkerClient } from '../../rules/feats/worker/featsWorkerClient';
import type { FeatEntryMeta } from '../../rules/feats/types';

const PAGE_SIZE = 40;

type IndexState = {
  groups: FeatsTagGroups;
  tagCounts: Record<string, number>;
  raceOptions: Array<{
    id: string;
    label: string;
    count: number;
  }>;
  abilityOptions: Array<{
    id: string;
    label: string;
    count: number;
  }>;
};

const TagChip = ({
  tag,
  selected,
  count,
  onToggle
}: {
  tag: string;
  selected: boolean;
  count: number | undefined;
  onToggle: (tag: string) => void;
}) => {
  return (
    <button
      type="button"
      onClick={() => onToggle(tag)}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        selected
          ? 'border-sky-500/80 bg-sky-950/50 text-sky-200'
          : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
      }`}
    >
      {formatFeatsTagLabel(tag)}
      {typeof count === 'number' ? <span className="ml-1 opacity-80">({count})</span> : null}
    </button>
  );
};

const FeatCard = ({ meta }: { meta: FeatEntryMeta }) => {
  const abilityIncrease = meta.quickFacts.abilityIncrease;
  return (
    <Link
      to={`/rules/feats/${meta.id}`}
      className="block rounded-lg border border-slate-800 bg-slate-900/65 p-3 transition hover:border-slate-600 hover:bg-slate-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-violet-500/70 bg-violet-950/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-violet-200">
          Feat
        </span>
        <h3 className="text-base font-semibold tracking-tight text-slate-100">{meta.name}</h3>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {meta.quickFacts.source ?? 'Unknown source'}
        {meta.collection ? ` • ${meta.collection}` : ''}
      </p>
      <p className="mt-2 text-sm text-slate-300">{meta.summary || 'No summary available.'}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
        {meta.quickFacts.prerequisite ? (
          <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1">
            Prerequisite: {meta.quickFacts.prerequisite}
          </span>
        ) : null}
        {abilityIncrease.amount > 0 ? (
          <span className="rounded-full border border-sky-600/70 bg-sky-950/35 px-2 py-1 text-sky-200">
            +{abilityIncrease.amount}{' '}
            {abilityIncrease.abilities.includes('ALL')
              ? 'Any ability'
              : abilityIncrease.abilities.join(', ')}
          </span>
        ) : null}
      </div>
    </Link>
  );
};

export const FeatsListRoute = () => {
  const [indexState, setIndexState] = useState<IndexState | null>(null);
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [raceFilter, setRaceFilter] = useState('ALL');
  const [abilityFilter, setAbilityFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<FeatEntryMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const index = await featsWorkerClient.getIndex();
        if (cancelled) {
          return;
        }
        setIndexState({
          groups: index.groups,
          tagCounts: index.tagCounts,
          raceOptions: index.raceOptions,
          abilityOptions: index.abilityOptions
        });
      } catch (workerError) {
        if (!cancelled) {
          setError(workerError instanceof Error ? workerError.message : 'Failed to load feats index');
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timeout = window.setTimeout(() => {
      void featsWorkerClient
        .filter({
          query,
          selectedTags,
          raceFilter,
          abilityFilter,
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE
        })
        .then((result) => {
          if (cancelled) {
            return;
          }
          setRows(result.metas);
          setTotal(result.total);
          setError(null);
        })
        .catch((workerError) => {
          if (!cancelled) {
            setError(workerError instanceof Error ? workerError.message : 'Failed to filter feats');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 60);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [abilityFilter, page, query, raceFilter, selectedTags]);

  const toggleTag = (tag: string) => {
    setPage(0);
    setSelectedTags((previous) => {
      if (previous.includes(tag)) {
        return previous.filter((entry) => entry !== tag);
      }
      return [...previous, tag];
    });
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const spotlightTags = useMemo(() => {
    const collection = indexState?.groups.collection ?? [];
    const source = indexState?.groups.source ?? [];
    const has = indexState?.groups.has ?? [];
    return [...collection, ...source, ...has].slice(0, 18);
  }, [indexState?.groups.collection, indexState?.groups.has, indexState?.groups.source]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Feats</h2>
          <p className="mt-1 text-sm text-slate-300">
            Built-in feat references with fast client-only filtering. No API calls.
          </p>
        </div>

        <label className="w-full max-w-xl text-sm text-slate-300">
          Search by feat name
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Type feat name..."
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">Race prerequisite</p>
          <select
            value={raceFilter}
            onChange={(event) => {
              setRaceFilter(event.target.value);
              setPage(0);
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          >
            <option value="ALL">All races</option>
            {(indexState?.raceOptions ?? []).map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} ({option.count})
              </option>
            ))}
          </select>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">Ability increase</p>
          <select
            value={abilityFilter}
            onChange={(event) => {
              setAbilityFilter(event.target.value);
              setPage(0);
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          >
            <option value="ALL">All</option>
            {(indexState?.abilityOptions ?? []).map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} ({option.count})
              </option>
            ))}
          </select>
        </section>
      </div>

      <section className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
        <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">Tags</p>
        <div className="flex flex-wrap gap-2">
          {spotlightTags.map((tag) => (
            <TagChip
              key={tag}
              tag={tag}
              selected={selectedTags.includes(tag)}
              count={indexState?.tagCounts[tag]}
              onToggle={toggleTag}
            />
          ))}
        </div>
      </section>

      {selectedTags.length > 0 ? (
        <section className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">Active filters</p>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <button
                key={`active-${tag}`}
                type="button"
                onClick={() => toggleTag(tag)}
                className="rounded-full border border-sky-500/70 bg-sky-950/40 px-3 py-1 text-xs text-sky-200"
              >
                {formatFeatsTagLabel(tag)} x
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
        <p>{loading ? 'Loading feats...' : `${total.toLocaleString()} entries matched`}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((previous) => Math.max(0, previous - 1))}
            disabled={page <= 0 || loading}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-xs disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-slate-400">
            Page {Math.min(page + 1, totalPages)} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setPage((previous) => (previous + 1 < totalPages ? previous + 1 : previous))
            }
            disabled={page + 1 >= totalPages || loading}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-xs disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {rows.map((meta) => (
          <FeatCard key={meta.id} meta={meta} />
        ))}
      </div>
    </section>
  );
};
