import type { RaceStructuredData } from '../model';

export const RaceTraitsSection = ({ traits }: { traits: RaceStructuredData['traits'] }) => {
  if (traits.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Traits</h3>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {traits.map((trait) => (
          <article key={trait.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-semibold tracking-tight text-slate-100">{trait.name}</h4>
              {trait.category ? (
                <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                  {trait.category}
                </span>
              ) : null}
            </div>
            {trait.summary ? <p className="mt-2 text-sm font-medium text-sky-200">{trait.summary}</p> : null}
            <p className="mt-2 text-sm leading-7 text-slate-200">{trait.rulesText}</p>
          </article>
        ))}
      </div>
    </section>
  );
};
