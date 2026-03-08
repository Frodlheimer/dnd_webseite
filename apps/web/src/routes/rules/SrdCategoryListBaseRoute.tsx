import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { srdWorkerClient } from '../../rules/srd/worker/srdWorkerClient';
import { formatSrdTagLabel } from '../../rules/srd/ui/tagLabels';
import type { SrdCategory, SrdEntryMeta } from '../../rules/srd/types';

const PAGE_SIZE = 40;

type SrdCategoryListBaseRouteProps = {
  category: SrdCategory;
  title: string;
  description: string;
  detailBasePath: string;
  showMonsterFilters?: boolean;
};

const filterTagValues = (tags: string[], prefix: string): string[] => {
  return tags
    .filter((tag) => tag.startsWith(prefix))
    .map((tag) => tag.slice(prefix.length))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
};

const parseCrToNumber = (value: string): number => {
  const normalized = value.trim().replace(/-/g, '/');
  const fractionMatch = normalized.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const numerator = Number.parseInt(fractionMatch[1] ?? '', 10);
    const denominator = Number.parseInt(fractionMatch[2] ?? '', 10);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
      return numerator / denominator;
    }
  }

  const numeric = Number.parseFloat(normalized);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return Number.POSITIVE_INFINITY;
};

const sortCrValues = (values: string[]): string[] => {
  return [...values].sort((left, right) => {
    const diff = parseCrToNumber(left) - parseCrToNumber(right);
    if (diff !== 0) {
      return diff;
    }
    return left.localeCompare(right);
  });
};

const formatCrValue = (value: string): string => {
  return value.replace(/-/g, '/');
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
      {formatSrdTagLabel(tag)}
      {typeof count === 'number' ? <span className="ml-1 opacity-80">({count})</span> : null}
    </button>
  );
};

const ResultCard = ({ meta, detailBasePath }: { meta: SrdEntryMeta; detailBasePath: string }) => {
  return (
    <Link
      to={`${detailBasePath}/${meta.id}`}
      className="block rounded-lg border border-slate-800 bg-slate-900/65 p-3 transition hover:border-slate-600 hover:bg-slate-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-600 bg-slate-950/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-300">
          {meta.section}
        </span>
        <h3 className="text-base font-semibold tracking-tight text-slate-100">{meta.title}</h3>
      </div>
      <p className="mt-2 text-sm text-slate-300">{meta.summary || 'No summary available.'}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
        <span>{meta.sourcePageRange}</span>
        {meta.extra.challengeRating ? <span>CR {meta.extra.challengeRating}</span> : null}
        {meta.extra.monsterType ? <span>{meta.extra.monsterType}</span> : null}
        {meta.extra.size ? <span>{meta.extra.size}</span> : null}
        {meta.extra.armorClass ? <span>AC {meta.extra.armorClass}</span> : null}
        {meta.extra.hitPoints ? <span>HP {meta.extra.hitPoints}</span> : null}
        {typeof meta.extra.initiativeMod === 'number' ? (
          <span>Init {meta.extra.initiativeMod >= 0 ? `+${meta.extra.initiativeMod}` : meta.extra.initiativeMod}</span>
        ) : null}
      </div>
    </Link>
  );
};

export const SrdCategoryListBaseRoute = ({
  category,
  title,
  description,
  detailBasePath,
  showMonsterFilters = false
}: SrdCategoryListBaseRouteProps) => {
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [rows, setRows] = useState<SrdEntryMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monsterTypeFilter, setMonsterTypeFilter] = useState('ALL');
  const [monsterCrFilter, setMonsterCrFilter] = useState('ALL');
  const [monsterSizeFilter, setMonsterSizeFilter] = useState('ALL');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const index = await srdWorkerClient.getIndex(category);
        if (cancelled) {
          return;
        }
        setAllTags(index.allTags);
        setTagCounts(index.tagCounts);
        setError(null);
      } catch (workerError) {
        if (!cancelled) {
          setError(workerError instanceof Error ? workerError.message : 'Failed to load SRD index');
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [category]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timeout = window.setTimeout(() => {
      void srdWorkerClient
        .filter({
          category,
          query,
          selectedTags,
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          ...(showMonsterFilters ? { monsterTypeFilter, monsterCrFilter, monsterSizeFilter } : {})
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
            setError(workerError instanceof Error ? workerError.message : 'Failed to filter SRD entries');
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
  }, [category, monsterCrFilter, monsterSizeFilter, monsterTypeFilter, page, query, selectedTags, showMonsterFilters]);

  const spotlightTags = useMemo(() => {
    return allTags
      .filter((tag) => !showMonsterFilters || (!tag.startsWith('type:') && !tag.startsWith('cr:') && !tag.startsWith('size:')))
      .slice(0, 24);
  }, [allTags, showMonsterFilters]);

  const monsterTypes = useMemo(() => filterTagValues(allTags, 'type:'), [allTags]);
  const monsterCrValues = useMemo(() => sortCrValues(filterTagValues(allTags, 'cr:')), [allTags]);
  const monsterSizes = useMemo(() => filterTagValues(allTags, 'size:'), [allTags]);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const toggleTag = (tag: string) => {
    setPage(0);
    setSelectedTags((previous) => {
      if (previous.includes(tag)) {
        return previous.filter((entry) => entry !== tag);
      }
      return [...previous, tag];
    });
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-slate-300">{description}</p>
        </div>
        <label className="w-full max-w-xl text-sm text-slate-300">
          Search
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search title or summary..."
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
      </div>

      {showMonsterFilters ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm text-slate-300">
            Monster type
            <select
              value={monsterTypeFilter}
              onChange={(event) => {
                setMonsterTypeFilter(event.target.value);
                setPage(0);
              }}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            >
              <option value="ALL">All types</option>
              {monsterTypes.map((value) => (
                <option key={`type-${value}`} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Challenge Rating
            <select
              value={monsterCrFilter}
              onChange={(event) => {
                setMonsterCrFilter(event.target.value);
                setPage(0);
              }}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            >
              <option value="ALL">All CR</option>
              {monsterCrValues.map((value) => (
                <option key={`cr-${value}`} value={value}>
                  {formatCrValue(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Size
            <select
              value={monsterSizeFilter}
              onChange={(event) => {
                setMonsterSizeFilter(event.target.value);
                setPage(0);
              }}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            >
              <option value="ALL">All sizes</option>
              {monsterSizes.map((value) => (
                <option key={`size-${value}`} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {spotlightTags.length > 0 ? (
        <section className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">Tags</p>
          <div className="flex flex-wrap gap-2">
            {spotlightTags.map((tag) => (
              <TagChip
                key={tag}
                tag={tag}
                selected={selectedTags.includes(tag)}
                count={tagCounts[tag]}
                onToggle={toggleTag}
              />
            ))}
          </div>
        </section>
      ) : null}

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
                {formatSrdTagLabel(tag)} x
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
        <p>{loading ? 'Loading entries...' : `${total.toLocaleString()} entries matched`}</p>
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
            onClick={() => setPage((previous) => (previous + 1 < totalPages ? previous + 1 : previous))}
            disabled={page + 1 >= totalPages || loading}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-xs disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-500/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {rows.map((meta) => (
          <ResultCard key={meta.id} meta={meta} detailBasePath={detailBasePath} />
        ))}
      </div>
    </section>
  );
};
