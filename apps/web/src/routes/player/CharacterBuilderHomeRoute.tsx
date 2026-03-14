import { Link } from 'react-router-dom';

const workflowSteps = [
  {
    title: 'Choose your rules and core identity',
    description: 'Start with the rule set, then define class, level, race, subrace, and background.'
  },
  {
    title: 'Resolve rules-driven choices',
    description: 'Work through ability scores, proficiencies, spells, equipment, and ASI or feat decisions.'
  },
  {
    title: 'Review and export locally',
    description: 'Check the final character, save locally, and export into the sheet workflow without server storage.'
  }
];

export const CharacterBuilderHomeRoute = () => {
  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/65 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-sky-300">Character Builder</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">
          Create a new character
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          The Character Builder guides you through a local-first DnD character workflow. Choose
          your ruleset, class, origin, proficiencies, spells, equipment, and review steps in a
          fixed order so the app can apply rules and catch unresolved choices automatically.
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Nothing is processed on a server. Your characters stay local in the browser and can be
          reopened later from Your Characters.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/player/characters/new"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-sky-500 px-6 py-3 text-base font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Start Character Builder
          </Link>
          <Link
            to="/player/characters/list"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-600 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-sky-500/70 hover:text-sky-100"
          >
            Open Your Characters
          </Link>
          <Link
            to="/player/tools/point-buy"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-slate-100"
          >
            Open Point Buy Calculator
          </Link>
        </div>
      </header>

      <section className="grid gap-3 lg:grid-cols-3">
        {workflowSteps.map((step, index) => (
          <article
            key={step.title}
            className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-sky-300/80">Step {index + 1}</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-100">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{step.description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
        <h3 className="text-xl font-semibold tracking-tight text-slate-100">How to use it</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
            <p className="text-sm font-semibold text-slate-100">Guided workflow</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Use the section list in Character Progress to move through the build in order. The
              app highlights missing decisions, warnings, and review blockers.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
            <p className="text-sm font-semibold text-slate-100">Reference-aware choices</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Many cards include info buttons that open Stats and Rules details so you can read
              classes, races, backgrounds, feats, and spells without leaving the builder.
            </p>
          </div>
        </div>
      </section>
    </section>
  );
};
