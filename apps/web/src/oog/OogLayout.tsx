import { Link, Outlet, useLocation } from 'react-router-dom';

import { AdSlot } from '../components/ads/AdSlot';
import { GlobalSearch } from '../components/search/GlobalSearch';
import type { SearchScope } from '../components/search/searchData';

const resolveSearchScope = (pathname: string): SearchScope => {
  if (pathname.startsWith('/player')) {
    return 'player';
  }

  if (pathname.startsWith('/dm')) {
    return 'dm';
  }

  return 'all';
};

export const OogLayout = () => {
  const location = useLocation();
  const searchScope = resolveSearchScope(location.pathname);
  const showRailAd = location.pathname.startsWith('/player') || location.pathname.startsWith('/dm');
  const isLanding = location.pathname === '/';
  const contentSpacing = isLanding ? 'pb-4 pt-4 lg:pb-3 lg:pt-3' : 'pb-8 pt-6';
  const containerClassName = showRailAd
    ? `w-full pl-4 pr-0 sm:pl-6 lg:pl-8 ${contentSpacing}`
    : `mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${contentSpacing}`;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#1e293b_0%,#0f172a_35%,#020617_100%)] text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
          >
            <span className="inline-block rounded-lg bg-sky-500 px-2 py-1 text-xs font-black uppercase tracking-wide text-slate-950">
              D20
            </span>
            <span className="text-lg font-semibold tracking-tight">D&amp;D VTT</span>
          </Link>

          <div className="min-w-0 flex-1">
            <GlobalSearch scope={searchScope} />
          </div>

          <Link
            to="/login"
            className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
          >
            Login
          </Link>
        </div>
      </header>

      <div className={containerClassName}>
        {showRailAd ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <Outlet />
            <aside className="hidden xl:block">
              <div className="sticky top-6">
                <AdSlot variant="rail" />
              </div>
            </aside>
          </div>
        ) : (
          <Outlet />
        )}
      </div>

      <footer className="border-t border-slate-800/80 bg-slate-950/70">
        <div className="mx-auto grid w-full max-w-7xl gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8">
          <AdSlot variant="footer" />
          <nav className="flex flex-wrap items-center gap-4">
            <Link
              to="/imprint"
              className="text-sm text-slate-400 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
            >
              Imprint
            </Link>
            <Link
              to="/feedback"
              className="text-sm text-slate-400 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
            >
              Feedback
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};
