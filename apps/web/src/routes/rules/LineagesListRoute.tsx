import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { lineagesWorkerClient } from '../../rules/lineages/worker/lineagesWorkerClient';
import type { LineagesTagGroups } from '../../rules/lineages/worker/filterLineages';
import { formatLineagesTagLabel } from '../../rules/lineages/ui/tagLabels';
import type { LineageEntryMeta } from '../../rules/lineages/types';

const PAGE_SIZE = 40;

type IndexState = {
  groups: LineagesTagGroups;
  tagCounts: Record<string, number>;
  groupOptions: Array<{
    id: string;
    label: string;
    count: number;
  }>;
  settingOptions: Array<{
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
      {formatLineagesTagLabel(tag)}
      {typeof count === 'number' ? <span className="ml-1 opacity-80">({count})</span> : null}
    </button>
  );
};

const LineageCard = ({ meta }: { meta: LineageEntryMeta }) => {
  return (
    <Link
      to={`/rules/lineages/${meta.id}`}
      className="block rounded-lg border border-slate-800 bg-slate-900/65 p-3 transition hover:border-slate-600 hover:bg-slate-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-amber-500/70 bg-amber-950/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-200">
          Lineage
        </span>
        <h3 className="text-base font-semibold tracking-tight text-slate-100">{meta.name}</h3>
      </div>
      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
        <span>{meta.group}</span>
        {meta.setting ? <span>• {meta.setting}</span> : null}
      </div>
      <p className="mt-2 text-sm text-slate-300">{meta.summary || 'No summary available.'}</p>
    </Link>
  );
};

export const LineagesListRoute = () => {
  const [indexState, setIndexState] = useState<IndexState | null>(null);
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [settingFilter, setSettingFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<LineageEntryMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const index = await lineagesWorkerClient.getIndex();
        if (cancelled) {
          return;
        }
        setIndexState({
          groups: index.groups,
          tagCounts: index.tagCounts,
          groupOptions: index.groupOptions,
          settingOptions: index.settingOptions
        });
      } catch (workerError) {
        if (!cancelled) {
          setError(workerError instanceof Error ? workerError.message : 'Failed to load lineages index');
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
      void lineagesWorkerClient
        .filter({
          query,
          selectedTags,
          groupFilter,
          settingFilter,
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
            setError(workerError instanceof Error ? workerError.message : 'Failed to filter lineages');
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
  }, [groupFilter, page, query, selectedTags, settingFilter]);

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
    const groups = indexState?.groups.groups ?? [];
    const settings = indexState?.groups.settings ?? [];
    const hasTags = indexState?.groups.has ?? [];
    const traits = indexState?.groups.trait ?? [];
    return [...groups, ...settings, ...hasTags, ...traits.slice(0, 10)].slice(0, 18);
  }, [indexState?.groups.groups, indexState?.groups.has, indexState?.groups.settings, indexState?.groups.trait]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Races & Lineages</h2>
          <p className="mt-1 text-sm text-slate-300">
            Built-in lineage references with worker-based filtering. Client-only and fast.
          </p>
        </div>

        <label className="w-full max-w-xl text-sm text-slate-300">
          Search by lineage name or summary
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Type lineage name..."
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">Group</p>
          <select
            value={groupFilter}
            onChange={(event) => {
              setGroupFilter(event.target.value);
              setPage(0);
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          >
            <option value="ALL">All groups</option>
            {(indexState?.groupOptions ?? []).map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} ({option.count})
              </option>
            ))}
          </select>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">Setting</p>
          <select
            value={settingFilter}
            onChange={(event) => {
              setSettingFilter(event.target.value);
              setPage(0);
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          >
            <option value="ALL">All settings</option>
            {(indexState?.settingOptions ?? []).map((option) => (
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
                {formatLineagesTagLabel(tag)} x
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
        <p>{loading ? 'Loading lineages...' : `${total.toLocaleString()} entries matched`}</p>
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
          <LineageCard key={meta.id} meta={meta} />
        ))}
      </div>
    </section>
  );
};
