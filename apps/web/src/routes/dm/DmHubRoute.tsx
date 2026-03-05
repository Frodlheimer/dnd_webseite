import { Link } from 'react-router-dom';

import { AdSlot } from '../../components/ads/AdSlot';

const HubTile = ({
  title,
  description,
  to
}: {
  title: string;
  description: string;
  to: string;
}) => {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
    >
      <h3 className="text-lg font-semibold tracking-tight text-slate-100">{title}</h3>
      <p className="mt-1 text-sm text-slate-300">{description}</p>
    </Link>
  );
};

export const DmHubRoute = () => {
  return (
    <section>
      <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-sky-300">Dungeon Master</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">DM Hub</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">
          Manage your prep workflow, then launch the live in-game experience from here.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/vtt"
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            Resume
          </Link>
          <Link
            to="/dm/session"
            className="rounded-lg border border-slate-600 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-sky-400 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
          >
            Session Workspace
          </Link>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <HubTile
          title="Session"
          description="Current room flow and host actions."
          to="/dm/session"
        />
        <HubTile
          title="Maps & Scenes"
          description="Map library and scene management."
          to="/dm/maps"
        />
        <HubTile title="NPC Library" description="NPC templates and references." to="/dm/npcs" />
        <HubTile title="Encounters" description="Build and track encounters." to="/dm/encounters" />
        <HubTile title="Notes" description="Private DM notes and reminders." to="/dm/notes" />
        <HubTile title="Audio" description="Ambience and soundtrack controls." to="/dm/audio" />
      </div>

      <div className="mt-6 xl:hidden">
        <AdSlot variant="inline" />
      </div>
    </section>
  );
};
