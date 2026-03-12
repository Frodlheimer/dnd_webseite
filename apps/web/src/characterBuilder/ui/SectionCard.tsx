import type { ReactNode } from 'react';

export const SectionCard = (props: {
  title: string;
  description?: string;
  explainerTitle?: string;
  explainerBody?: ReactNode;
  children: ReactNode;
}) => {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-xl font-semibold tracking-tight text-slate-100">{props.title}</h3>
        {props.description ? <p className="mt-1 text-sm text-slate-300">{props.description}</p> : null}
      </div>

      {props.explainerBody ? (
        <details className="mb-4 rounded-lg border border-slate-700 bg-slate-950/50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-sky-200">
            {props.explainerTitle ?? 'How this works'}
          </summary>
          <div className="mt-2 text-sm text-slate-300">{props.explainerBody}</div>
        </details>
      ) : null}

      <div>{props.children}</div>
    </section>
  );
};

