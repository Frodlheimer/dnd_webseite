import { useEffect, useMemo, useState } from 'react';

import { SpellFlagsLegend } from '../../rules/spells/ui/SpellFlagsLegend';
import { SpellsTable } from '../../rules/spells/ui/SpellsTable';
import { formatSpellTagLabel } from '../../rules/spells/ui/tagLabels';
import type { SpellMeta } from '../../rules/spells/types';
import { spellsWorkerClient } from '../../rules/spells/worker/spellsWorkerClient';
import type { SpellTagGroups } from '../../rules/spells/worker/filterSpells';

const PAGE_SIZE = 40;

const FLAG_TAGS = [
  'ritual',
  'dunamancy',
  'dunamancy:graviturgy',
  'dunamancy:chronurgy',
  'technomagic'
] as const;

type IndexState = {
  allTags: string[];
  tagCounts: Record<string, number>;
  groups: SpellTagGroups;
};

type ConcentrationFilter = 'all' | 'yes' | 'no';
type TargetFilter = 'all' | 'area' | 'single' | 'self';

const FilterChip = ({
  tag,
  selected,
  onToggle,
  count
}: {
  tag: string;
  selected: boolean;
  onToggle: (tag: string) => void;
  count: number | undefined;
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
      {formatSpellTagLabel(tag)}
      {typeof count === 'number' ? (
        <span className="ml-1 text-[10px] opacity-80">({count})</span>
      ) : null}
    </button>
  );
};

export const SpellsListRoute = () => {
  const [indexState, setIndexState] = useState<IndexState | null>(null);
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [concentrationFilter, setConcentrationFilter] = useState<ConcentrationFilter>('all');
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('all');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<SpellMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const index = await spellsWorkerClient.getIndex();
        if (cancelled) {
          return;
        }
        setIndexState(index);
      } catch (workerError) {
        if (!cancelled) {
          setError(
            workerError instanceof Error ? workerError.message : 'Failed to load spell index'
          );
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

    const workerTags = [...selectedTags];
    const concentrationTag = `concentration:${concentrationFilter}`;
    const targetTag = `target:${targetFilter}`;

    if (
      concentrationFilter !== 'all' &&
      (indexState?.allTags.includes(concentrationTag) ?? false)
    ) {
      workerTags.push(concentrationTag);
    }

    if (targetFilter !== 'all' && (indexState?.allTags.includes(targetTag) ?? false)) {
      workerTags.push(targetTag);
    }

    const timeout = window.setTimeout(() => {
      void spellsWorkerClient
        .filter({
          query,
          tags: workerTags,
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE
        })
        .then((result) => {
          if (cancelled) {
            return;
          }

          setRows(result.items);
          setTotal(result.total);
          setError(null);
        })
        .catch((workerError) => {
          if (!cancelled) {
            setError(
              workerError instanceof Error ? workerError.message : 'Failed to filter spells'
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 70);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [page, query, selectedTags, concentrationFilter, targetFilter, indexState?.allTags]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

  const toggleTag = (tag: string) => {
    setPage(0);
    setSelectedTags((previous) => {
      if (previous.includes(tag)) {
        return previous.filter((entry) => entry !== tag);
      }

      return [...previous, tag];
    });
  };

  const schoolTags = indexState?.groups.schools ?? [];
  const levelTags = indexState?.groups.levels ?? [];
  const classTags = indexState?.groups.classes ?? [];
  const selectedFilterTags = [...selectedTags];
  if (concentrationFilter !== 'all') {
    selectedFilterTags.push(`concentration:${concentrationFilter}`);
  }
  if (targetFilter !== 'all') {
    selectedFilterTags.push(`target:${targetFilter}`);
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Spells</h2>
          <p className="mt-1 text-sm text-slate-300">
            Built-in spell browser powered by a local worker. No API calls.
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
            placeholder="Type spell name..."
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">Flags</p>
          <div className="flex flex-wrap gap-2">
            {FLAG_TAGS.map((tag) => (
              <FilterChip
                key={tag}
                tag={tag}
                selected={selectedTags.includes(tag)}
                onToggle={toggleTag}
                count={indexState?.tagCounts[tag]}
              />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
            Concentration
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setConcentrationFilter('all');
                setPage(0);
              }}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                concentrationFilter === 'all'
                  ? 'border-sky-500/80 bg-sky-950/50 text-sky-200'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => {
                setConcentrationFilter('yes');
                setPage(0);
              }}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                concentrationFilter === 'yes'
                  ? 'border-sky-500/80 bg-sky-950/50 text-sky-200'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => {
                setConcentrationFilter('no');
                setPage(0);
              }}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                concentrationFilter === 'no'
                  ? 'border-sky-500/80 bg-sky-950/50 text-sky-200'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
              }`}
            >
              No
            </button>
          </div>
        </section>
      </div>

      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
        <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
          Effect Target
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setTargetFilter('all');
              setPage(0);
            }}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              targetFilter === 'all'
                ? 'border-sky-500/80 bg-sky-950/50 text-sky-200'
                : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => {
              setTargetFilter('area');
              setPage(0);
            }}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              targetFilter === 'area'
                ? 'border-sky-500/80 bg-sky-950/50 text-sky-200'
                : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
            }`}
          >
            Area of Effect
          </button>
          <button
            type="button"
            onClick={() => {
              setTargetFilter('single');
              setPage(0);
            }}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              targetFilter === 'single'
                ? 'border-sky-500/80 bg-sky-950/50 text-sky-200'
                : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
            }`}
          >
            Single Target
          </button>
          <button
            type="button"
            onClick={() => {
              setTargetFilter('self');
              setPage(0);
            }}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              targetFilter === 'self'
                ? 'border-sky-500/80 bg-sky-950/50 text-sky-200'
                : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
            }`}
          >
            Self
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">Levels</p>
          <div className="flex flex-wrap gap-2">
            {levelTags.map((tag) => (
              <FilterChip
                key={tag}
                tag={tag}
                selected={selectedTags.includes(tag)}
                onToggle={toggleTag}
                count={indexState?.tagCounts[tag]}
              />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">Schools</p>
          <div className="flex flex-wrap gap-2">
            {schoolTags.map((tag) => (
              <FilterChip
                key={tag}
                tag={tag}
                selected={selectedTags.includes(tag)}
                onToggle={toggleTag}
                count={indexState?.tagCounts[tag]}
              />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">Classes</p>
          <div className="flex flex-wrap gap-2">
            {classTags.map((tag) => (
              <FilterChip
                key={tag}
                tag={tag}
                selected={selectedTags.includes(tag)}
                onToggle={toggleTag}
                count={indexState?.tagCounts[tag]}
              />
            ))}
          </div>
        </section>
      </div>

      {selectedFilterTags.length > 0 ? (
        <section className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">Filters</p>
          <div className="flex flex-wrap gap-2">
            {selectedFilterTags.map((tag) => (
              <button
                key={`selected-${tag}`}
                type="button"
                onClick={() => {
                  if (tag === 'concentration:yes') {
                    setConcentrationFilter('all');
                    setPage(0);
                    return;
                  }
                  if (tag === 'concentration:no') {
                    setConcentrationFilter('all');
                    setPage(0);
                    return;
                  }
                  if (tag === 'target:area' || tag === 'target:single' || tag === 'target:self') {
                    setTargetFilter('all');
                    setPage(0);
                    return;
                  }
                  toggleTag(tag);
                }}
                className="rounded-full border border-sky-500/70 bg-sky-950/40 px-3 py-1 text-xs text-sky-200"
              >
                {formatSpellTagLabel(tag)} x
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-4">
        <SpellFlagsLegend />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
        <p>{loading ? 'Loading spells...' : `${total.toLocaleString()} spells matched`}</p>
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

      <div className="mt-4">
        <SpellsTable spells={rows} />
      </div>
    </section>
  );
};
