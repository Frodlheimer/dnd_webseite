import { NavLink, Outlet } from 'react-router-dom';

type CharacterBuilderNavItem = {
  to: string;
  label: string;
  description: string;
};

const navItems: CharacterBuilderNavItem[] = [
  {
    to: '/player/characters',
    label: 'Builder',
    description: 'Automation tools (coming soon)'
  },
  {
    to: '/player/characters/point-buy',
    label: 'Point Buy Calculator',
    description: '5e SRD point-buy with ASI and feat planning'
  },
  {
    to: '/player/characters/sheets',
    label: 'Character Sheets',
    description: 'Template-based PDF sheets'
  }
];

export const CharacterBuilderRoute = () => {
  return (
    <section className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="rounded-xl border border-slate-800 bg-slate-900/65 p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-sky-300">Player</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Character Builder</h1>
        <p className="mt-2 text-sm text-slate-300">
          Build and manage character sheets fully client-side. No server processing.
        </p>

        <nav className="mt-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/player/characters'}
              className={({ isActive }) =>
                `block rounded-lg border px-3 py-2 transition ${
                  isActive
                    ? 'border-sky-500/70 bg-sky-950/40 text-sky-200'
                    : 'border-slate-800 bg-slate-900/50 text-slate-200 hover:border-slate-600 hover:bg-slate-800/70'
                }`
              }
            >
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-slate-400">{item.description}</p>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <Outlet />
      </div>
    </section>
  );
};
