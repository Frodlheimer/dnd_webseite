import { Link } from 'react-router-dom';

export const LoginRoute = () => {
  return (
    <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/80 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Login</h1>
      <p className="mt-3 text-sm text-slate-300">
        Coming soon. Until then, you can launch the VTT directly from the landing page.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        Back to home
      </Link>
    </section>
  );
};
