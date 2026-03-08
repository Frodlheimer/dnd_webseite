import { Link } from 'react-router-dom';

export const CharacterBuilderHomeRoute = () => {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-2xl font-semibold tracking-tight">Builder</h2>
      <p className="mt-2 text-sm text-slate-300">
        Character automation tools are available as local-only modules. Use Point Buy Calculator
        for score planning or open Character Sheets for PDF-based editing.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/player/characters/point-buy"
          className="inline-flex rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
        >
          Open Point Buy Calculator
        </Link>
        <Link
          to="/player/characters/sheets"
          className="inline-flex rounded-lg border border-slate-600 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-sky-500/70 hover:text-sky-100"
        >
          Open Character Sheets
        </Link>
      </div>
    </section>
  );
};
