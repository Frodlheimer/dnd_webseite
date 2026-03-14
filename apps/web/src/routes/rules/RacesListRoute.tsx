import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { RaceEntryMeta } from '../../rules/races/model';
import { formatMetaLanguages } from '../../rules/races/ui/formatters';
import { racesWorkerClient } from '../../rules/races/worker/racesWorkerClient';

const PAGE_SIZE = 40;

type IndexState = {
  filterOptions: {
    sizes: string[];
    speeds: number[];
    darkvisionValues: number[];
    languages: string[];
  };
  tagCounts: Record<string, number>;
  total: number;
};

const RaceCard = ({ meta }: { meta: RaceEntryMeta }) => {
  return (
    <Link
      to={`/rules/races/${meta.id}`}
      className="block rounded-lg border border-slate-800 bg-slate-900/65 p-4 transition hover:border-slate-600 hover:bg-slate-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${
            meta.kind === 'subrace'
              ? 'border border-amber-500/70 bg-amber-950/35 text-amber-200'
              : 'border border-sky-500/70 bg-sky-950/35 text-sky-200'
          }`}
        >
          {meta.kind}
        </span>
        <h3 className="text-base font-semibold tracking-tight text-slate-100">{meta.name}</h3>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
        <span>Size {meta.size ?? 'Unknown'}</span>
        <span>Speed {meta.speedWalk ? `${meta.speedWalk} ft` : 'Unknown'}</span>
        <span>Darkvision {meta.darkvision ? `${meta.darkvision} ft` : 'None'}</span>
        {meta.parentRaceId ? <span>Parent {meta.parentRaceId}</span> : null}
      </div>
      <p className="mt-3 text-sm text-slate-300">{meta.summary || 'No summary available.'}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
        <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1">
          Languages: {formatMetaLanguages(meta)}
        </span>
        {meta.structuredFlags.hasToolChoices ? (
          <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1">Tool choice</span>
        ) : null}
        {meta.structuredFlags.hasWeaponProficiencies ? (
          <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1">Weapon training</span>
        ) : null}
        {meta.structuredFlags.hasResistances ? (
          <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1">Resistance</span>
        ) : null}
      </div>
    </Link>
  );
};

const FilterCheckbox = ({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) => {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-sky-400 focus:ring-sky-500"
      />
      <span>{label}</span>
    </label>
  );
};

export const RacesListRoute = () => {
  const [indexState, setIndexState] = useState<IndexState | null>(null);
  const [query, setQuery] = useState('');
  const [sizeFilter, setSizeFilter] = useState('ALL');
  const [speedFilter, setSpeedFilter] = useState('ALL');
  const [darkvisionFilter, setDarkvisionFilter] = useState('ALL');
  const [languageFilter, setLanguageFilter] = useState('ALL');
  const [requireToolChoices, setRequireToolChoices] = useState(false);
  const [requireWeaponProficiencies, setRequireWeaponProficiencies] = useState(false);
  const [requireResistances, setRequireResistances] = useState(false);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<RaceEntryMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void racesWorkerClient
      .getIndex()
      .then((index) => {
        if (!cancelled) {
          setIndexState(index);
          setError(null);
        }
      })
      .catch((workerError) => {
        if (!cancelled) {
          setError(workerError instanceof Error ? workerError.message : 'Failed to load races index');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timeout = window.setTimeout(() => {
      void racesWorkerClient
        .filter({
          query,
          sizeFilter,
          speedFilter,
          darkvisionFilter,
          languageFilter,
          requireToolChoices,
          requireWeaponProficiencies,
          requireResistances,
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE
        })
        .then((result) => {
          if (!cancelled) {
            setRows(result.metas);
            setTotal(result.total);
            setError(null);
          }
        })
        .catch((workerError) => {
          if (!cancelled) {
            setError(workerError instanceof Error ? workerError.message : 'Failed to filter races');
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
  }, [
    darkvisionFilter,
    languageFilter,
    page,
    query,
    requireResistances,
    requireToolChoices,
    requireWeaponProficiencies,
    sizeFilter,
    speedFilter
  ]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Races</h2>
          <p className="mt-1 text-sm text-slate-300">
            Structured SRD 5.1 race and subrace references with machine-readable facts.
          </p>
        </div>

        <label className="w-full max-w-xl text-sm text-slate-300">
          Search by race name or summary
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search races..."
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <label className="text-sm text-slate-300">
          Size
          <select
            value={sizeFilter}
            onChange={(event) => {
              setSizeFilter(event.target.value);
              setPage(0);
            }}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          >
            <option value="ALL">All sizes</option>
            {(indexState?.filterOptions.sizes ?? []).map((value) => (
              <option key={`size-${value}`} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Speed
          <select
            value={speedFilter}
            onChange={(event) => {
              setSpeedFilter(event.target.value);
              setPage(0);
            }}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          >
            <option value="ALL">All speeds</option>
            {(indexState?.filterOptions.speeds ?? []).map((value) => (
              <option key={`speed-${value}`} value={`${value}`}>
                {value} ft
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Darkvision
          <select
            value={darkvisionFilter}
            onChange={(event) => {
              setDarkvisionFilter(event.target.value);
              setPage(0);
            }}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          >
            <option value="ALL">Any</option>
            {(indexState?.filterOptions.darkvisionValues ?? []).map((value) => (
              <option key={`darkvision-${value}`} value={`${value}`}>
                {value} ft
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Languages
          <select
            value={languageFilter}
            onChange={(event) => {
              setLanguageFilter(event.target.value);
              setPage(0);
            }}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          >
            <option value="ALL">Any language</option>
            {(indexState?.filterOptions.languages ?? []).map((value) => (
              <option key={`language-${value}`} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <FilterCheckbox
          label="Has tool choices"
          checked={requireToolChoices}
          onChange={(next) => {
            setRequireToolChoices(next);
            setPage(0);
          }}
        />
        <FilterCheckbox
          label="Has weapon proficiencies"
          checked={requireWeaponProficiencies}
          onChange={(next) => {
            setRequireWeaponProficiencies(next);
            setPage(0);
          }}
        />
        <FilterCheckbox
          label="Has resistances"
          checked={requireResistances}
          onChange={(next) => {
            setRequireResistances(next);
            setPage(0);
          }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
        <p>{loading ? 'Loading races...' : `${total.toLocaleString()} entries matched`}</p>
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

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {rows.map((meta) => (
          <RaceCard key={meta.id} meta={meta} />
        ))}
      </div>
    </section>
  );
};
