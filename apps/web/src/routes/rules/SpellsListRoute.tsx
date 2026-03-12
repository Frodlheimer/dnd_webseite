import { useEffect, useRef, useState } from 'react';

import { SpellFlagsLegend } from '../../rules/spells/ui/SpellFlagsLegend';
import { SpellsTable } from '../../rules/spells/ui/SpellsTable';
import { formatSpellTagLabel } from '../../rules/spells/ui/tagLabels';
import type { SpellMeta } from '../../rules/spells/types';
import type { SpellTagGroups } from '../../rules/spells/worker/filterSpells';
import { spellsWorkerClient } from '../../rules/spells/worker/spellsWorkerClient';

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
type FilterCategoryId = 'flags' | 'concentration' | 'target' | 'levels' | 'schools' | 'classes';

type FilterOption = {
  value: string;
  label: string;
  count: number | undefined;
};

const COMPACT_LABEL_PREFIXES = ['Concentration: ', 'Target: ', 'School: ', 'Class: ', 'Source: '];

const formatCompactTagLabel = (tag: string): string => {
  const baseLabel = formatSpellTagLabel(tag);
  for (const prefix of COMPACT_LABEL_PREFIXES) {
    if (baseLabel.startsWith(prefix)) {
      return baseLabel.slice(prefix.length);
    }
  }
  return baseLabel;
};

const resolveSelectedTagsLabel = (values: string[], allLabel: string): string => {
  if (values.length === 0) {
    return allLabel;
  }
  if (values.length === 1) {
    return formatCompactTagLabel(values[0] ?? '');
  }
  if (values.length === 2) {
    return `${formatCompactTagLabel(values[0] ?? '')}, ${formatCompactTagLabel(values[1] ?? '')}`;
  }
  return `${values.length} selected`;
};

const toggleArrayValue = <T extends string>(values: T[], value: T): T[] => {
  if (values.includes(value)) {
    return values.filter((entry) => entry !== value);
  }
  return [...values, value];
};

const DropdownFilterCategory = ({
  id,
  title,
  selectedValues,
  selectedLabel,
  options,
  isOpen,
  onToggle,
  onToggleValue,
  onClear,
  alignRight = false
}: {
  id: FilterCategoryId;
  title: string;
  selectedValues: string[];
  selectedLabel: string;
  options: FilterOption[];
  isOpen: boolean;
  onToggle: (id: FilterCategoryId) => void;
  onToggleValue: (value: string) => void;
  onClear: () => void;
  alignRight?: boolean;
}) => {
  const active = selectedValues.length > 0;

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => onToggle(id)}
        className={`w-full min-w-0 rounded-lg border px-2.5 py-2 text-left transition ${
          isOpen || active
            ? 'border-sky-500/80 bg-sky-950/35'
            : 'border-slate-700 bg-slate-950/55 hover:border-slate-500'
        }`}
      >
        <span className="block truncate text-[10px] uppercase tracking-[0.18em] text-slate-300">
          {title}
        </span>
        <span
          className={`mt-1 block truncate text-[10px] leading-4 ${
            active ? 'text-sky-300' : 'text-slate-500'
          }`}
          title={selectedLabel}
        >
          {selectedLabel}
        </span>
      </button>

      {isOpen ? (
        <div
          className={`absolute top-full z-40 mt-2 w-max min-w-[220px] max-w-[320px] rounded-lg border border-slate-700 bg-slate-950/95 shadow-2xl ${
            alignRight ? 'right-0' : 'left-0'
          }`}
        >
          <ul role="listbox" className="max-h-72 overflow-auto py-1">
            {options.map((option) => {
              const isAllOption = option.value === 'all';
              const selected = isAllOption
                ? selectedValues.length === 0
                : selectedValues.includes(option.value);

              return (
                <li key={`${id}-${option.value}`}>
                  <button
                    type="button"
                    onClick={() => {
                      if (isAllOption) {
                        onClear();
                        return;
                      }
                      onToggleValue(option.value);
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition ${
                      selected
                        ? 'bg-sky-950/45 text-sky-200'
                        : 'text-slate-200 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded border border-slate-600 text-[10px]">
                        {selected ? 'x' : ''}
                      </span>
                      <span>{option.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selected ? <span className="text-[10px] text-sky-300">Selected</span> : null}
                      {typeof option.count === 'number' ? (
                        <span className="text-[10px] text-slate-400">({option.count})</span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export const SpellsListRoute = () => {
  const [indexState, setIndexState] = useState<IndexState | null>(null);
  const [query, setQuery] = useState('');
  const [selectedFlagTags, setSelectedFlagTags] = useState<string[]>([]);
  const [selectedLevelTags, setSelectedLevelTags] = useState<string[]>([]);
  const [selectedSchoolTags, setSelectedSchoolTags] = useState<string[]>([]);
  const [selectedClassTags, setSelectedClassTags] = useState<string[]>([]);
  const [selectedConcentrationFilters, setSelectedConcentrationFilters] = useState<
    Array<Exclude<ConcentrationFilter, 'all'>>
  >([]);
  const [selectedTargetFilters, setSelectedTargetFilters] = useState<
    Array<Exclude<TargetFilter, 'all'>>
  >([]);
  const [openCategory, setOpenCategory] = useState<FilterCategoryId | null>(null);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<SpellMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filtersRowRef = useRef<HTMLDivElement | null>(null);

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
    if (openCategory === null) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!target || !(target instanceof Node)) {
        return;
      }
      if (filtersRowRef.current?.contains(target)) {
        return;
      }
      setOpenCategory(null);
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openCategory]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const allTagsSet = new Set(indexState?.allTags ?? []);
    const keepKnownTags = (tags: string[]): string[] => {
      if (allTagsSet.size === 0) {
        return tags;
      }
      return tags.filter((tag) => allTagsSet.has(tag));
    };

    const workerTagGroups = [
      keepKnownTags(selectedFlagTags),
      keepKnownTags(selectedLevelTags),
      keepKnownTags(selectedSchoolTags),
      keepKnownTags(selectedClassTags),
      keepKnownTags(selectedConcentrationFilters.map((value) => `concentration:${value}`)),
      keepKnownTags(selectedTargetFilters.map((value) => `target:${value}`))
    ].filter((group) => group.length > 0);

    const timeout = window.setTimeout(() => {
      void spellsWorkerClient
        .filter({
          query,
          tags: [],
          tagGroups: workerTagGroups,
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
  }, [
    page,
    query,
    selectedFlagTags,
    selectedLevelTags,
    selectedSchoolTags,
    selectedClassTags,
    selectedConcentrationFilters,
    selectedTargetFilters,
    indexState?.allTags
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const schoolTags = indexState?.groups.schools ?? [];
  const levelTags = indexState?.groups.levels ?? [];
  const classTags = indexState?.groups.classes ?? [];
  const tagCounts = indexState?.tagCounts ?? {};

  const flagsOptions: FilterOption[] = [
    {
      value: 'all',
      label: 'All flags',
      count: undefined
    },
    ...FLAG_TAGS.map((tag) => ({
      value: tag,
      label: formatCompactTagLabel(tag),
      count: tagCounts[tag]
    }))
  ];

  const concentrationOptions: FilterOption[] = [
    {
      value: 'all',
      label: 'All',
      count: undefined
    },
    {
      value: 'yes',
      label: 'Yes',
      count: tagCounts['concentration:yes']
    },
    {
      value: 'no',
      label: 'No',
      count: tagCounts['concentration:no']
    }
  ];

  const targetOptions: FilterOption[] = [
    {
      value: 'all',
      label: 'All',
      count: undefined
    },
    {
      value: 'area',
      label: 'Area of Effect',
      count: tagCounts['target:area']
    },
    {
      value: 'single',
      label: 'Single Target',
      count: tagCounts['target:single']
    },
    {
      value: 'self',
      label: 'Self',
      count: tagCounts['target:self']
    }
  ];

  const levelOptions: FilterOption[] = [
    {
      value: 'all',
      label: 'All levels',
      count: undefined
    },
    ...levelTags.map((tag) => ({
      value: tag,
      label: formatCompactTagLabel(tag),
      count: tagCounts[tag]
    }))
  ];

  const schoolOptions: FilterOption[] = [
    {
      value: 'all',
      label: 'All schools',
      count: undefined
    },
    ...schoolTags.map((tag) => ({
      value: tag,
      label: formatCompactTagLabel(tag),
      count: tagCounts[tag]
    }))
  ];

  const classOptions: FilterOption[] = [
    {
      value: 'all',
      label: 'All classes',
      count: undefined
    },
    ...classTags.map((tag) => ({
      value: tag,
      label: formatCompactTagLabel(tag),
      count: tagCounts[tag]
    }))
  ];

  const toggleOpenCategory = (id: FilterCategoryId) => {
    setOpenCategory((previous) => (previous === id ? null : id));
  };

  const clearMultiTagFilter = (setter: (updater: (previous: string[]) => string[]) => void) => {
    setter(() => []);
    setPage(0);
  };

  const toggleMultiTagFilter = (
    value: string,
    setter: (updater: (previous: string[]) => string[]) => void
  ) => {
    setter((previous) => toggleArrayValue(previous, value));
    setPage(0);
  };

  const clearConcentrationFilters = () => {
    setSelectedConcentrationFilters([]);
    setPage(0);
  };

  const toggleConcentrationFilter = (value: string) => {
    if (value !== 'yes' && value !== 'no') {
      return;
    }
    setSelectedConcentrationFilters((previous) => toggleArrayValue(previous, value));
    setPage(0);
  };

  const clearTargetFilters = () => {
    setSelectedTargetFilters([]);
    setPage(0);
  };

  const toggleTargetFilter = (value: string) => {
    if (value !== 'area' && value !== 'single' && value !== 'self') {
      return;
    }
    setSelectedTargetFilters((previous) => toggleArrayValue(previous, value));
    setPage(0);
  };

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

      <div
        ref={filtersRowRef}
        className="mt-4 rounded-lg border border-slate-800 bg-slate-950/45 p-2"
      >
        <div className="grid grid-cols-6 gap-2">
          <DropdownFilterCategory
            id="flags"
            title="Flags"
            selectedValues={selectedFlagTags}
            selectedLabel={resolveSelectedTagsLabel(selectedFlagTags, 'All')}
            options={flagsOptions}
            isOpen={openCategory === 'flags'}
            onToggle={toggleOpenCategory}
            onToggleValue={(value) => toggleMultiTagFilter(value, setSelectedFlagTags)}
            onClear={() => clearMultiTagFilter(setSelectedFlagTags)}
          />

          <DropdownFilterCategory
            id="concentration"
            title="Concentration"
            selectedValues={selectedConcentrationFilters}
            selectedLabel={resolveSelectedTagsLabel(selectedConcentrationFilters, 'All')}
            options={concentrationOptions}
            isOpen={openCategory === 'concentration'}
            onToggle={toggleOpenCategory}
            onToggleValue={toggleConcentrationFilter}
            onClear={clearConcentrationFilters}
          />

          <DropdownFilterCategory
            id="target"
            title="Effect Target"
            selectedValues={selectedTargetFilters}
            selectedLabel={resolveSelectedTagsLabel(selectedTargetFilters, 'All')}
            options={targetOptions}
            isOpen={openCategory === 'target'}
            onToggle={toggleOpenCategory}
            onToggleValue={toggleTargetFilter}
            onClear={clearTargetFilters}
          />

          <DropdownFilterCategory
            id="levels"
            title="Levels"
            selectedValues={selectedLevelTags}
            selectedLabel={resolveSelectedTagsLabel(selectedLevelTags, 'All')}
            options={levelOptions}
            isOpen={openCategory === 'levels'}
            onToggle={toggleOpenCategory}
            onToggleValue={(value) => toggleMultiTagFilter(value, setSelectedLevelTags)}
            onClear={() => clearMultiTagFilter(setSelectedLevelTags)}
          />

          <DropdownFilterCategory
            id="schools"
            title="Schools"
            selectedValues={selectedSchoolTags}
            selectedLabel={resolveSelectedTagsLabel(selectedSchoolTags, 'All')}
            options={schoolOptions}
            isOpen={openCategory === 'schools'}
            onToggle={toggleOpenCategory}
            onToggleValue={(value) => toggleMultiTagFilter(value, setSelectedSchoolTags)}
            onClear={() => clearMultiTagFilter(setSelectedSchoolTags)}
            alignRight
          />

          <DropdownFilterCategory
            id="classes"
            title="Classes"
            selectedValues={selectedClassTags}
            selectedLabel={resolveSelectedTagsLabel(selectedClassTags, 'All')}
            options={classOptions}
            isOpen={openCategory === 'classes'}
            onToggle={toggleOpenCategory}
            onToggleValue={(value) => toggleMultiTagFilter(value, setSelectedClassTags)}
            onClear={() => clearMultiTagFilter(setSelectedClassTags)}
            alignRight
          />
        </div>
      </div>

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
