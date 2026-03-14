import type { RaceStructuredData } from '../model';
import { formatAbilityBonuses, formatLanguages, formatSpeed } from './formatters';

const FactCard = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/55 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-100">{value}</p>
    </div>
  );
};

export const RaceFactsPanel = ({ race }: { race: RaceStructuredData }) => {
  const speed = formatSpeed(race.basics);
  const languages = formatLanguages(race.languages);
  const abilityBonuses = formatAbilityBonuses(race.abilities);
  const rows = [
    race.basics.size
      ? {
          label: 'Size',
          value: race.basics.size
        }
      : null,
    speed
      ? {
          label: 'Speed',
          value: speed
        }
      : null,
    typeof race.senses.darkvision === 'number'
      ? {
          label: 'Darkvision',
          value: `${race.senses.darkvision} ft`
        }
      : null,
    languages
      ? {
          label: 'Languages',
          value: languages
        }
      : null,
    abilityBonuses
      ? {
          label: 'Ability Score Bonuses',
          value: abilityBonuses
        }
      : null
  ].filter((row): row is { label: string; value: string } => !!row);

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Quick Facts</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {rows.map((row) => (
          <FactCard key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </section>
  );
};
