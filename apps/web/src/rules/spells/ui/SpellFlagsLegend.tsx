import type { SpellFlagCode } from '../types';

const FLAG_LABELS: Array<{ code: SpellFlagCode; text: string }> = [
  { code: 'R', text: 'Ritual' },
  { code: 'D', text: 'Dunamancy' },
  { code: 'DG', text: 'Graviturgy Dunamancy' },
  { code: 'DC', text: 'Chronurgy Dunamancy' },
  { code: 'T', text: 'Technomagic' }
];

export const SpellFlagsLegend = () => {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300">
      <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">Flags Legend</p>
      <ul className="flex flex-wrap gap-3">
        {FLAG_LABELS.map((entry) => (
          <li key={entry.code} className="inline-flex items-center gap-1">
            <sup className="rounded bg-slate-800 px-1 py-0.5 text-[10px] font-semibold text-sky-300">
              {entry.code}
            </sup>
            <span>{entry.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
