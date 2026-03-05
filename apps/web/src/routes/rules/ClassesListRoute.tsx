import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { classesWorkerClient } from '../../rules/classes/worker/classesWorkerClient';
import type { ClassesTagGroups } from '../../rules/classes/worker/filterClasses';
import { formatClassesTagLabel } from '../../rules/classes/ui/tagLabels';
import type { RulesEntryMeta } from '../../rules/classes/types';

const PAGE_SIZE = 40;

type KindFilter = 'ALL' | 'CLASS' | 'SUBCLASS';

type IndexState = {
  groups: ClassesTagGroups;
  tagCounts: Record<string, number>;
  classOptions: Array<{
    id: string;
    name: string;
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
      {formatClassesTagLabel(tag)}
      {typeof count === 'number' ? <span className="ml-1 opacity-80">({count})</span> : null}
    </button>
  );
};

const resultPathForMeta = (meta: RulesEntryMeta): string => {
  if (meta.kind === 'CLASS') {
    return `/rules/classes/${meta.id}`;
  }
  return `/rules/subclasses/${meta.id}`;
};

export const ClassesListRoute = () => {
  const [indexState, setIndexState] = useState<IndexState | null>(null);
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [kindFilter, setKindFilter] = useState<KindFilter>('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<RulesEntryMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const index = await classesWorkerClient.getIndex();
        if (cancelled) {
          return;
        }
        setIndexState({
          groups: index.groups,
          tagCounts: index.tagCounts,
          classOptions: index.classOptions
        });
      } catch (workerError) {
        if (!cancelled) {
          setError(workerError instanceof Error ? workerError.message : 'Failed to load classes index');
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
      void classesWorkerClient
        .filter({
          query,
          selectedTags,
          kindFilter,
          classFilter,
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
            setError(
              workerError instanceof Error ? workerError.message : 'Failed to filter classes'
            );
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
  }, [classFilter, kindFilter, page, query, selectedTags]);

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
    const settings = indexState?.groups.settings ?? [];
    const caster = indexState?.groups.caster ?? [];
    const hasTags = indexState?.groups.has ?? [];
    return [...settings, ...caster, ...hasTags].slice(0, 16);
  }, [indexState?.groups.caster, indexState?.groups.has, indexState?.groups.settings]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Classes & Subclasses</h2>
          <p className="mt-1 text-sm text-slate-300">
            Built-in class references with worker-based filtering. No API calls.
          </p>
        </div>

        <label className="w-full max-w-xl text-sm text-slate-300">
          Search by name
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Type class or subclass name..."
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">Kind</p>
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'CLASS', 'SUBCLASS'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setKindFilter(value);
                  setPage(0);
                }}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  kindFilter === value
                    ? 'border-sky-500/80 bg-sky-950/50 text-sky-200'
                    : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                }`}
              >
                {value === 'ALL' ? 'All' : value === 'CLASS' ? 'Classes' : 'Subclasses'}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">Class</p>
          <select
            value={classFilter}
            onChange={(event) => {
              setClassFilter(event.target.value);
              setPage(0);
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          >
            <option value="ALL">All classes</option>
            {(indexState?.classOptions ?? []).map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
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
                {formatClassesTagLabel(tag)} x
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
        <p>{loading ? 'Loading classes...' : `${total.toLocaleString()} entries matched`}</p>
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
          <Link
            key={meta.id}
            to={resultPathForMeta(meta)}
            className="block rounded-lg border border-slate-800 bg-slate-900/65 p-3 transition hover:border-slate-600 hover:bg-slate-900"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                  meta.kind === 'CLASS'
                    ? 'border border-emerald-500/60 bg-emerald-950/40 text-emerald-200'
                    : 'border border-sky-500/60 bg-sky-950/40 text-sky-200'
                }`}
              >
                {meta.kind === 'CLASS' ? 'Class' : 'Subclass'}
              </span>
              <h3 className="text-base font-semibold tracking-tight text-slate-100">{meta.name}</h3>
              {meta.kind === 'SUBCLASS' ? (
                <span className="text-xs text-slate-400">
                  ({meta.parentClassId?.replace(/-/g, ' ')})
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-300">{meta.summary || 'No summary available.'}</p>
          </Link>
        ))}
      </div>
    </section>
  );
};
