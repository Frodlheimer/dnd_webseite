import { Link } from 'react-router-dom';

type PlaceholderRouteProps = {
  title: string;
  description?: string;
};

export const PlaceholderRoute = ({ title, description }: PlaceholderRouteProps) => {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-slate-300">{description ?? 'This section is coming soon.'}</p>
      <Link
        to="/vtt"
        className="mt-5 inline-flex rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 transition hover:border-sky-500 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
      >
        Open VTT
      </Link>
    </section>
  );
};
