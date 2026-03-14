import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { RulesDocumentBlock } from '../../rules/classes/types';
import { ClassDocumentBlocks } from '../../rules/classes/ui/ClassDocumentBlocks';
import {
  getParentRaceMeta,
  getRaceDetail,
  getRaceMeta,
  getSubraceMetasForRace
} from '../../rules/races/api/racesData';
import type { RaceStructuredData, RuleBlock } from '../../rules/races/model';
import { RaceFactsPanel } from '../../rules/races/ui/RaceFactsPanel';
import { RaceTraitsSection } from '../../rules/races/ui/RaceTraitsSection';
import { SubraceList } from '../../rules/races/ui/SubraceList';
import { formatAbilityBonuses, formatRaceTagLabel } from '../../rules/races/ui/formatters';

const toRenderableBlocks = (blocks: RuleBlock[]): RulesDocumentBlock[] => {
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

const DataListSection = ({
  title,
  rows
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) => {
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">{title}</h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-3">
            <dt className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{row.label}</dt>
            <dd className="mt-1 text-sm text-slate-100">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export const RaceDetailRoute = () => {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const meta = useMemo(() => getRaceMeta(id), [id]);
  const parentMeta = useMemo(() => getParentRaceMeta(id), [id]);
  const subraces = useMemo(() => getSubraceMetasForRace(id), [id]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RaceStructuredData | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!id) {
      setError('Race ID is missing.');
      setLoading(false);
      return;
    }

    if (!meta) {
      setError('Race entry not found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    void getRaceDetail(id)
      .then((nextDetail) => {
        if (cancelled) {
          return;
        }
        if (!nextDetail) {
          setError('Race detail not found.');
          setDetail(null);
          return;
        }
        setDetail(nextDetail);
        setError(null);
      })
      .catch((detailError) => {
        if (!cancelled) {
          setError(detailError instanceof Error ? detailError.message : 'Failed to load race detail');
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
  }, [id, meta]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 text-sm text-slate-300">
        Loading race detail...
      </section>
    );
  }

  if (error || !detail || !meta) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4">
        <p className="rounded border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error ?? 'Race not found.'}
        </p>
        <Link
          to="/rules/races"
          className="mt-3 inline-flex rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          Back to Races
        </Link>
      </section>
    );
  }

  const proficiencyRows = [
    detail.proficiencies.weapons.length > 0
      ? {
          label: 'Weapons',
          value: detail.proficiencies.weapons.join(', ')
        }
      : null,
    detail.proficiencies.tools.length > 0
      ? {
          label: 'Tools',
          value: detail.proficiencies.tools.join(', ')
        }
      : null,
    detail.proficiencies.skills.length > 0
      ? {
          label: 'Skills',
          value: detail.proficiencies.skills.join(', ')
        }
      : null,
    detail.proficiencies.skillChoices
      ? {
          label: 'Skill choices',
          value: `Choose ${detail.proficiencies.skillChoices.choose} from ${detail.proficiencies.skillChoices.from.join(', ')}`
        }
      : null,
    detail.proficiencies.toolChoices
      ? {
          label: 'Tool choices',
          value: `Choose ${detail.proficiencies.toolChoices.choose} from ${detail.proficiencies.toolChoices.from.join(', ')}`
        }
      : null
  ].filter((row): row is { label: string; value: string } => !!row);

  const defenseRows = [
    detail.defenses.resistances.length > 0
      ? {
          label: 'Resistances',
          value: detail.defenses.resistances.join(', ')
        }
      : null,
    detail.defenses.immunities.length > 0
      ? {
          label: 'Immunities',
          value: detail.defenses.immunities.join(', ')
        }
      : null,
    detail.defenses.conditionImmunities.length > 0
      ? {
          label: 'Condition immunities',
          value: detail.defenses.conditionImmunities.join(', ')
        }
      : null,
    detail.defenses.savingThrowAdvantages.length > 0
      ? {
          label: 'Saving throw advantages',
          value: detail.defenses.savingThrowAdvantages.join(', ')
        }
      : null
  ].filter((row): row is { label: string; value: string } => !!row);

  const descriptiveRows = [
    detail.basics.ageText
      ? {
          label: 'Age',
          value: detail.basics.ageText
        }
      : null,
    detail.basics.alignmentText
      ? {
          label: 'Alignment',
          value: detail.basics.alignmentText
        }
      : null,
    formatAbilityBonuses(detail.abilities)
      ? {
          label: 'Ability bonuses',
          value: formatAbilityBonuses(detail.abilities) ?? ''
        }
      : null
  ].filter((row): row is { label: string; value: string } => !!row);

  const visibleTags = detail.tags.filter((tag) => !tag.startsWith('parent:'));

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/rules/races" className="text-xs uppercase tracking-[0.2em] text-sky-300 hover:underline">
          Races
        </Link>
        {parentMeta ? (
          <Link
            to={`/rules/races/${parentMeta.id}`}
            className="text-xs text-slate-400 hover:text-slate-200 hover:underline"
          >
            Parent: {parentMeta.name}
          </Link>
        ) : null}
      </div>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-100">{detail.name}</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${
              detail.kind === 'subrace'
                ? 'border border-amber-500/70 bg-amber-950/35 text-amber-200'
                : 'border border-sky-500/70 bg-sky-950/35 text-sky-200'
            }`}
          >
            {detail.kind}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-300">Source: SRD 5.1</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs text-slate-200"
            >
              {formatRaceTagLabel(tag)}
            </span>
          ))}
        </div>
      </header>

      <RaceFactsPanel race={detail} />
      <DataListSection title="Descriptive Facts" rows={descriptiveRows} />
      <DataListSection title="Proficiencies" rows={proficiencyRows} />
      <DataListSection title="Defenses" rows={defenseRows} />
      <RaceTraitsSection traits={detail.traits} />
      <SubraceList subraces={subraces} />

      <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Original Rule Text</h3>
        <div className="mt-3">
          <ClassDocumentBlocks blocks={toRenderableBlocks(detail.documentBlocks)} currentEntryId={detail.id} />
        </div>
      </section>
    </section>
  );
};
