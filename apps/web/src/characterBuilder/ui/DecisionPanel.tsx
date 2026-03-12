import type { PendingDecision } from '../model/character';

export const DecisionPanel = (props: {
  decisions: PendingDecision[];
  title?: string;
}) => {
  if (props.decisions.length === 0) {
    return (
      <section className="rounded-lg border border-emerald-500/50 bg-emerald-950/25 p-3 text-sm text-emerald-100">
        All required decisions for this section are complete.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-amber-300">{props.title ?? 'Needs choices'}</p>
      <div className="mt-2 space-y-2">
        {props.decisions.map((decision) => (
          <article key={decision.id} className="rounded-md border border-amber-600/30 bg-slate-950/50 p-2.5">
            <p className="text-sm font-medium text-slate-100">{decision.title}</p>
            {decision.description ? <p className="mt-1 text-xs text-slate-300">{decision.description}</p> : null}
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
              <span>Source: {decision.source}</span>
              <span>{decision.required ? 'Required' : 'Optional'}</span>
              {typeof decision.optionsCount === 'number' ? <span>{decision.optionsCount} options</span> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

