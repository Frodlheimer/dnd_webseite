import { Link } from 'react-router-dom';

export const CharacterBuilderHomeRoute = () => {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-2xl font-semibold tracking-tight">Builder</h2>
      <p className="mt-2 text-sm text-slate-300">
        Character automation tools are planned next. You can already use full PDF sheet editing in
        the Character Sheets section.
      </p>
      <Link
        to="/player/characters/sheets"
        className="mt-4 inline-flex rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
      >
        Open Character Sheets
      </Link>
    </section>
  );
};
