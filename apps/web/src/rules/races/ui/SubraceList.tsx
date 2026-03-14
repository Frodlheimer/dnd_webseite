import { Link } from 'react-router-dom';

import type { RaceEntryMeta } from '../model';

export const SubraceList = ({ subraces }: { subraces: RaceEntryMeta[] }) => {
  if (subraces.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Subraces</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {subraces.map((subrace) => (
          <Link
            key={subrace.id}
            to={`/rules/races/${subrace.id}`}
            className="block rounded-lg border border-slate-800 bg-slate-950/60 p-3 transition hover:border-slate-600 hover:bg-slate-950/80"
          >
            <p className="text-sm font-semibold text-slate-100">{subrace.name}</p>
            <p className="mt-1 text-sm text-slate-300">{subrace.summary || 'No summary available.'}</p>
          </Link>
        ))}
      </div>
    </section>
  );
};
