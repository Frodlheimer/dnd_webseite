import { Link } from 'react-router-dom';

import { AdSlot } from '../../components/ads/AdSlot';

type HubQuickLink = {
  label: string;
  to: string;
};

const HubTile = ({
  title,
  description,
  to,
  quickLinks
}: {
  title: string;
  description: string;
  to: string;
  quickLinks?: HubQuickLink[];
}) => {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-slate-600 hover:bg-slate-900">
      <Link
        to={to}
        className="block transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
      >
        <h3 className="text-lg font-semibold tracking-tight text-slate-100">{title}</h3>
        <p className="mt-1 text-sm text-slate-300">{description}</p>
      </Link>
      {quickLinks && quickLinks.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {quickLinks.map((quickLink) => (
            <Link
              key={`${title}-${quickLink.to}`}
              to={quickLink.to}
              className="inline-flex rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-xs text-sky-200 transition hover:border-sky-500/70 hover:text-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
            >
              {quickLink.label}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
};

export const PlayerHubRoute = () => {
  return (
    <section>
      <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-sky-300">Player</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Player Hub</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">
          Prepare your side of the session, then open the in-game view whenever you are ready.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/vtt"
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            Resume
          </Link>
          <Link
            to="/player/join"
            className="rounded-lg border border-slate-600 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-sky-400 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
          >
            Join Session
          </Link>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <HubTile title="Join / Resume Session" description="Enter with code or continue in-game." to="/player/join" />
        <HubTile
          title="Your Characters"
          description="Open character builder and sheet templates."
          to="/player/characters"
        />
        <HubTile title="Notes" description="Session notes and reminders." to="/player/notes" />
        <HubTile
          title="Tools"
          description="Dice and utility helpers."
          to="/player/tools"
          quickLinks={[{ label: 'Dice', to: '/dice' }]}
        />
        <HubTile title="Files / Handouts" description="Coming soon." to="/player/tools" />
      </div>

      <div className="mt-6 xl:hidden">
        <AdSlot variant="inline" />
      </div>
    </section>
  );
};
