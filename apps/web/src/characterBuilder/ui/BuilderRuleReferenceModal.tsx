import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getFeatDetail } from '../../rules/feats/api/featsData';
import type { FeatEntryDetail } from '../../rules/feats/types';
import { getBackgroundDetail } from '../../rules/backgrounds/api/backgroundsData';
import type {
  BackgroundStructuredData,
  RuleBlock as BackgroundRuleBlock
} from '../../rules/backgrounds/model';
import { BackgroundFactsPanel } from '../../rules/backgrounds/ui/BackgroundFactsPanel';
import { BackgroundSections } from '../../rules/backgrounds/ui/BackgroundSections';
import { getLineageDetail } from '../../rules/lineages/api/lineagesData';
import type { LineageEntryDetail } from '../../rules/lineages/types';
import {
  getRaceDetail,
  getSubraceMetasForRace
} from '../../rules/races/api/racesData';
import type { RaceStructuredData, RuleBlock } from '../../rules/races/model';
import { RaceFactsPanel } from '../../rules/races/ui/RaceFactsPanel';
import { RaceTraitsSection } from '../../rules/races/ui/RaceTraitsSection';
import { SubraceList } from '../../rules/races/ui/SubraceList';
import { SpellDescriptionBlocks } from '../../rules/spells/ui/SpellDescriptionBlocks';
import type { SpellDetail } from '../../rules/spells/types';
import {
  getRulesEntryDetail,
  getRulesEntryMeta
} from '../../rules/classes/api/classesData';
import { ClassDocumentBlocks } from '../../rules/classes/ui/ClassDocumentBlocks';
import type { RulesDocumentBlock, RulesEntryDetail } from '../../rules/classes/types';
import { rulesFacade } from '../rules/rulesFacade';

export type BuilderRuleReference =
  | { kind: 'class'; id: string }
  | { kind: 'subclass'; id: string }
  | { kind: 'race'; id: string }
  | { kind: 'lineage'; id: string }
  | { kind: 'background'; id: string }
  | { kind: 'feat'; id: string }
  | { kind: 'spell'; id: string };

type LoadedReference =
  | { kind: 'class'; detail: RulesEntryDetail }
  | { kind: 'subclass'; detail: RulesEntryDetail }
  | { kind: 'race'; detail: RaceStructuredData }
  | { kind: 'lineage'; detail: LineageEntryDetail }
  | { kind: 'background'; detail: BackgroundStructuredData }
  | { kind: 'feat'; detail: FeatEntryDetail }
  | { kind: 'spell'; detail: SpellDetail };

const toRenderableRaceBlocks = (blocks: RuleBlock[]): RulesDocumentBlock[] => {
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

const toClassLikeBlocks = (blocks: unknown): RulesDocumentBlock[] => {
  return blocks as RulesDocumentBlock[];
};

const toRenderableBackgroundBlocks = (blocks: BackgroundRuleBlock[]): RulesDocumentBlock[] => {
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

const quickFactRows = (rows: Array<{ label: string; value: string | null | undefined }>) => {
  return rows.filter((row): row is { label: string; value: string } => Boolean(row.value));
};

const DataGridSection = (props: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) => {
  if (props.rows.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
        {props.title}
      </h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {props.rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-3">
            <dt className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{row.label}</dt>
            <dd className="mt-1 text-sm text-slate-100">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

const getReferenceHref = (reference: BuilderRuleReference): string | null => {
  switch (reference.kind) {
    case 'class':
      return `/rules/classes/${reference.id}`;
    case 'subclass':
      return `/rules/subclasses/${reference.id}`;
    case 'race':
      return `/rules/races/${reference.id}`;
    case 'lineage':
      return `/rules/lineages/${reference.id.startsWith('lineage:') ? reference.id.slice('lineage:'.length) : reference.id}`;
    case 'feat':
      return `/rules/feats/${reference.id}`;
    case 'spell':
      return `/rules/spells/${reference.id}`;
    case 'background':
      return `/rules/backgrounds/${reference.id}`;
  }
};

const normalizeLineageId = (id: string) => {
  return id.startsWith('lineage:') ? id.slice('lineage:'.length) : id;
};

const renderLoadedReference = (loaded: LoadedReference) => {
  if (loaded.kind === 'class' || loaded.kind === 'subclass') {
    const detail = loaded.detail;
    const meta = getRulesEntryMeta(detail.id);
    return (
      <>
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                loaded.kind === 'class'
                  ? 'border border-emerald-500/60 bg-emerald-950/40 text-emerald-200'
                  : 'border border-sky-500/60 bg-sky-950/40 text-sky-200'
              }`}
            >
              {loaded.kind === 'class' ? 'Class' : 'Subclass'}
            </span>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-100">{detail.name}</h2>
          </div>
          <p className="mt-1 text-sm text-slate-300">{detail.summary}</p>
        </header>

        <DataGridSection
          title="Quick Facts"
          rows={quickFactRows([
            {
              label: 'Hit Die',
              value: detail.extracted.hitDie
            },
            {
              label: 'Primary Ability',
              value: detail.extracted.primaryAbility
            },
            {
              label: 'Saving Throws',
              value: detail.extracted.savingThrows?.join(', ')
            },
            {
              label: 'Caster Type',
              value: detail.extracted.spellcasting?.casterType
            },
            {
              label: 'Subclass Start Level',
              value:
                typeof meta?.quick.subclassLevelStart === 'number'
                  ? String(meta.quick.subclassLevelStart)
                  : null
            }
          ])}
        />

        <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
            Rules Text
          </h3>
          <div className="mt-3">
            <ClassDocumentBlocks
              blocks={detail.documentBlocks}
              currentEntryId={detail.id}
              currentClassId={detail.classId}
            />
          </div>
        </section>
      </>
    );
  }

  if (loaded.kind === 'race') {
    const detail = loaded.detail;
    const descriptiveRows = quickFactRows([
      {
        label: 'Age',
        value: detail.basics.ageText
      },
      {
        label: 'Alignment',
        value: detail.basics.alignmentText
      },
      {
        label: 'Creature Type',
        value: detail.basics.creatureType
      }
    ]);

    return (
      <>
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                detail.kind === 'subrace'
                  ? 'border border-amber-500/70 bg-amber-950/35 text-amber-200'
                  : 'border border-sky-500/70 bg-sky-950/35 text-sky-200'
              }`}
            >
              {detail.kind}
            </span>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-100">{detail.name}</h2>
          </div>
          <p className="mt-1 text-sm text-slate-300">{detail.summary ?? 'Structured SRD race reference.'}</p>
        </header>

        <RaceFactsPanel race={detail} />
        <DataGridSection title="Descriptive Facts" rows={descriptiveRows} />
        <RaceTraitsSection traits={detail.traits} />
        {detail.kind === 'race' ? <SubraceList subraces={getSubraceMetasForRace(detail.id)} /> : null}

        <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
            Original Rule Text
          </h3>
          <div className="mt-3">
            <ClassDocumentBlocks
              blocks={toRenderableRaceBlocks(detail.documentBlocks)}
              currentEntryId={detail.id}
            />
          </div>
        </section>
      </>
    );
  }

  if (loaded.kind === 'background') {
    const detail = loaded.detail;
    return (
      <>
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-500/60 bg-cyan-950/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-200">
              Background
            </span>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-100">{detail.name}</h2>
          </div>
          <p className="mt-1 text-sm text-slate-300">{detail.summary ?? 'Structured background reference.'}</p>
        </header>

        <BackgroundFactsPanel background={detail} />
        <BackgroundSections background={detail} />

        <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
            Original Rule Text
          </h3>
          <div className="mt-3">
            <ClassDocumentBlocks
              blocks={toRenderableBackgroundBlocks(detail.documentBlocks)}
              currentEntryId={detail.id}
            />
          </div>
        </section>
      </>
    );
  }

  if (loaded.kind === 'lineage') {
    const detail = loaded.detail;
    return (
      <>
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-500/70 bg-amber-950/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-200">
              Lineage
            </span>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-100">{detail.name}</h2>
          </div>
          <p className="mt-1 text-sm text-slate-300">{detail.summary}</p>
        </header>

        <DataGridSection
          title="Quick Facts"
          rows={quickFactRows([
            { label: 'Group', value: detail.group },
            { label: 'Setting', value: detail.setting },
            { label: 'Source', value: detail.quickFacts.source },
            { label: 'Ability Score Increase', value: detail.quickFacts.abilityScoreIncrease },
            { label: 'Creature Type', value: detail.quickFacts.creatureType },
            { label: 'Size', value: detail.quickFacts.size },
            { label: 'Speed', value: detail.quickFacts.speed },
            { label: 'Languages', value: detail.quickFacts.languages },
            { label: 'Darkvision', value: detail.quickFacts.darkvision }
          ])}
        />

        {detail.traits.length > 0 ? (
          <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
              Traits
            </h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {detail.traits.map((trait) => (
                <li
                  key={trait.labelKey}
                  className="rounded border border-slate-800 bg-slate-950/40 px-3 py-2"
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{trait.label}</p>
                  <p className="mt-1 text-sm leading-7 text-slate-200">{trait.value}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
            Rules Text
          </h3>
          <div className="mt-3">
            <ClassDocumentBlocks blocks={toClassLikeBlocks(detail.documentBlocks)} currentEntryId={detail.id} />
          </div>
        </section>
      </>
    );
  }

  if (loaded.kind === 'feat') {
    const detail = loaded.detail;
    return (
      <>
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-fuchsia-500/60 bg-fuchsia-950/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-fuchsia-200">
              Feat
            </span>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-100">{detail.name}</h2>
          </div>
          <p className="mt-1 text-sm text-slate-300">{detail.summary}</p>
        </header>

        <DataGridSection
          title="Quick Facts"
          rows={quickFactRows([
            { label: 'Group', value: detail.group },
            { label: 'Collection', value: detail.collection },
            { label: 'Source', value: detail.quickFacts.source },
            { label: 'Prerequisite', value: detail.quickFacts.prerequisite },
            {
              label: 'Ability Increase',
              value: detail.quickFacts.abilityIncrease.description
            }
          ])}
        />

        {detail.highlights.length > 0 ? (
          <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
              Highlights
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              {detail.highlights.map((highlight, index) => (
                <li key={`${detail.id}-highlight-${index}`} className="rounded border border-slate-800 bg-slate-950/40 px-3 py-2">
                  {highlight}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
            Rules Text
          </h3>
          <div className="mt-3">
            <ClassDocumentBlocks blocks={toClassLikeBlocks(detail.documentBlocks)} currentEntryId={detail.id} />
          </div>
        </section>
      </>
    );
  }

  if (loaded.kind === 'spell') {
    const detail = loaded.detail;
    return (
      <>
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-sky-500/60 bg-sky-950/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-sky-200">
              Spell
            </span>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-100">{detail.name}</h2>
          </div>
          <p className="mt-1 text-sm text-slate-300">Source: {detail.source}</p>
        </header>

        <DataGridSection
          title="Quick Facts"
          rows={quickFactRows([
            { label: 'Level', value: detail.levelLabel },
            { label: 'School', value: detail.school },
            { label: 'Casting Time', value: detail.castingTime },
            { label: 'Range', value: detail.range },
            { label: 'Components', value: detail.components },
            { label: 'Duration', value: detail.duration }
          ])}
        />

        <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
            Description
          </h3>
          <div className="mt-3">
            <SpellDescriptionBlocks
              keyPrefix={`${detail.slug}-builder-reference`}
              blocks={detail.descriptionBlocks}
              currentSlug={detail.slug}
            />
          </div>
        </section>

        {detail.atHigherLevels ? (
          <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
              At Higher Levels
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-200">{detail.atHigherLevels}</p>
          </section>
        ) : null}
      </>
    );
  }

  return null;
};

export const BuilderRuleReferenceModal = (props: {
  reference: BuilderRuleReference;
  onClose: () => void;
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedReference | null>(null);
  const href = getReferenceHref(props.reference);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        props.onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [props.onClose]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setLoaded(null);

    void (async () => {
      try {
        switch (props.reference.kind) {
          case 'class':
          case 'subclass': {
            const detail = await getRulesEntryDetail(props.reference.id);
            if (!detail) {
              throw new Error('Rules entry not found.');
            }
            if (!cancelled) {
              setLoaded({
                kind: props.reference.kind,
                detail
              });
            }
            break;
          }
          case 'race': {
            const detail = await getRaceDetail(props.reference.id);
            if (!detail) {
              throw new Error('Race entry not found.');
            }
            if (!cancelled) {
              setLoaded({
                kind: 'race',
                detail
              });
            }
            break;
          }
          case 'lineage': {
            const detail = await getLineageDetail(normalizeLineageId(props.reference.id));
            if (!detail) {
              throw new Error('Lineage entry not found.');
            }
            if (!cancelled) {
              setLoaded({
                kind: 'lineage',
                detail
              });
            }
            break;
          }
          case 'background': {
            const detail = await getBackgroundDetail(props.reference.id);
            if (!detail) {
              throw new Error('Background not found.');
            }
            if (!cancelled) {
              setLoaded({
                kind: 'background',
                detail
              });
            }
            break;
          }
          case 'feat': {
            const detail = await getFeatDetail(props.reference.id);
            if (!detail) {
              throw new Error('Feat not found.');
            }
            if (!cancelled) {
              setLoaded({
                kind: 'feat',
                detail
              });
            }
            break;
          }
          case 'spell': {
            const detail = rulesFacade.getSpellById(props.reference.id);
            if (!detail) {
              throw new Error('Spell not found.');
            }
            if (!cancelled) {
              setLoaded({
                kind: 'spell',
                detail
              });
            }
            break;
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load reference.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [props.reference]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-950/75 p-4 backdrop-blur-sm md:p-8"
      onMouseDown={props.onClose}
    >
      <div className="w-full max-w-5xl" onMouseDown={(event) => event.stopPropagation()}>
        <section className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/95 p-4 sm:p-5 md:max-h-[calc(100vh-4rem)]">
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            {href ? (
              <Link
                to={href}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500"
              >
                Open in Rules & Stats
              </Link>
            ) : null}
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500"
              aria-label="Close reference card"
            >
              X
            </button>
          </div>

          {loading ? <p className="text-sm text-slate-300">Loading reference...</p> : null}

          {error ? (
            <p className="rounded border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          {!loading && !error && loaded ? (
            <div className="space-y-4">{renderLoadedReference(loaded)}</div>
          ) : null}
        </section>
      </div>
    </div>
  );
};
