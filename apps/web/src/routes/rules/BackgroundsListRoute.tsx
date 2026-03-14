import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { BackgroundMeta } from '../../rules/backgrounds/model';
import { backgroundsWorkerClient } from '../../rules/backgrounds/worker/backgroundsWorkerClient';

const PAGE_SIZE = 40;

type IndexState = {
  filterOptions: {
    categories: string[];
  };
  tagCounts: Record<string, number>;
  total: number;
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

const BackgroundCard = ({ meta }: { meta: BackgroundMeta }) => {
  return (
    <Link
      to={`/rules/backgrounds/${meta.id}`}
      className="block rounded-lg border border-slate-800 bg-slate-900/65 p-4 transition hover:border-slate-600 hover:bg-slate-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold tracking-tight text-slate-100">{meta.name}</h3>
        {meta.aliases.slice(1, 3).map((alias) => (
          <span
            key={`${meta.id}-${alias}`}
            className="rounded-full border border-cyan-500/40 bg-cyan-950/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan-200"
          >
            {alias}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
        {meta.categories.map((category) => (
          <span key={`${meta.id}-${category}`} className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1">
            {category}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-300">{meta.summary || 'No summary available.'}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
        {meta.grants.skills.length > 0 ? (
          <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1">
            Skills: {meta.grants.skills.join(', ')}
          </span>
        ) : null}
        {meta.grants.tools.length > 0 ? (
          <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1">
            Tools: {meta.grants.tools.join(', ')}
          </span>
        ) : null}
        {meta.grants.languages.length > 0 ? (
          <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1">
            Languages: {meta.grants.languages.join(', ')}
          </span>
        ) : null}
        {meta.grants.hasChoices ? (
          <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1">Choices</span>
        ) : null}
        {meta.grants.hasFeature ? (
          <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1">Feature</span>
        ) : null}
        {meta.grants.hasEquipment ? (
          <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1">Equipment</span>
        ) : null}
      </div>
    </Link>
  );
};

export const BackgroundsListRoute = () => {
  const [indexState, setIndexState] = useState<IndexState | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [requireSkillProficiency, setRequireSkillProficiency] = useState(false);
  const [requireToolProficiency, setRequireToolProficiency] = useState(false);
  const [requireLanguage, setRequireLanguage] = useState(false);
  const [requireChoices, setRequireChoices] = useState(false);
  const [requireFeature, setRequireFeature] = useState(false);
  const [requireEquipment, setRequireEquipment] = useState(false);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<BackgroundMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void backgroundsWorkerClient
      .getIndex()
      .then((index) => {
        if (!cancelled) {
          setIndexState(index);
          setError(null);
        }
      })
      .catch((workerError) => {
        if (!cancelled) {
          setError(workerError instanceof Error ? workerError.message : 'Failed to load backgrounds index');
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
      void backgroundsWorkerClient
        .filter({
          query,
          categoryFilter,
          requireSkillProficiency,
          requireToolProficiency,
          requireLanguage,
          requireChoices,
          requireFeature,
          requireEquipment,
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
            setError(workerError instanceof Error ? workerError.message : 'Failed to filter backgrounds');
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
    categoryFilter,
    page,
    query,
    requireChoices,
    requireEquipment,
    requireFeature,
    requireLanguage,
    requireSkillProficiency,
    requireToolProficiency
  ]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Backgrounds</h2>
          <p className="mt-1 text-sm text-slate-300">
            Structured DnD 5e background references generated from the local Wikidot export.
          </p>
        </div>

        <label className="w-full max-w-xl text-sm text-slate-300">
          Search by name, alias, category, or tag
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search backgrounds..."
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <label className="text-sm text-slate-300">
          Category
          <select
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setPage(0);
            }}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          >
            <option value="ALL">All categories</option>
            {(indexState?.filterOptions.categories ?? []).map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <FilterCheckbox
          label="Skill proficiency"
          checked={requireSkillProficiency}
          onChange={(next) => {
            setRequireSkillProficiency(next);
            setPage(0);
          }}
        />
        <FilterCheckbox
          label="Tool proficiency"
          checked={requireToolProficiency}
          onChange={(next) => {
            setRequireToolProficiency(next);
            setPage(0);
          }}
        />
        <FilterCheckbox
          label="Language"
          checked={requireLanguage}
          onChange={(next) => {
            setRequireLanguage(next);
            setPage(0);
          }}
        />
        <FilterCheckbox
          label="Has choices"
          checked={requireChoices}
          onChange={(next) => {
            setRequireChoices(next);
            setPage(0);
          }}
        />
        <FilterCheckbox
          label="Has feature"
          checked={requireFeature}
          onChange={(next) => {
            setRequireFeature(next);
            setPage(0);
          }}
        />
        <FilterCheckbox
          label="Has equipment"
          checked={requireEquipment}
          onChange={(next) => {
            setRequireEquipment(next);
            setPage(0);
          }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
        <p>{loading ? 'Loading backgrounds...' : `${total.toLocaleString()} entries matched`}</p>
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
        <p className="mt-4 rounded border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {rows.map((meta) => (
          <BackgroundCard key={meta.id} meta={meta} />
        ))}
      </div>
    </section>
  );
};
