import { NavLink, Outlet } from 'react-router-dom';

type RulesNavItem = {
  to: string;
  label: string;
  description: string;
  disabled?: boolean;
};

const navItems: RulesNavItem[] = [
  {
    to: '/rules/spells',
    label: 'Spells',
    description: 'Browse built-in spell rules'
  },
  {
    to: '/rules/classes',
    label: 'Classes & Subclasses',
    description: 'Browse class and subclass references'
  },
  {
    to: '/rules/races',
    label: 'Races (SRD)',
    description: 'Browse SRD 5.1 race references'
  },
  {
    to: '/rules/equipment',
    label: 'Equipment',
    description: 'Weapons, armor, gear, and packs'
  },
  {
    to: '/rules/adventuring',
    label: 'Adventuring',
    description: 'Travel, exploration, and rest rules'
  },
  {
    to: '/rules/combat',
    label: 'Combat',
    description: 'Turn structure, actions, and damage'
  },
  {
    to: '/rules/spellcasting',
    label: 'Spellcasting Rules',
    description: 'General casting rules and components'
  },
  {
    to: '/rules/conditions',
    label: 'Conditions',
    description: 'Appendix PH-A condition references'
  },
  {
    to: '/rules/magic-items',
    label: 'Magic Items',
    description: 'SRD 5.1 magic items A-Z'
  },
  {
    to: '/rules/lineages',
    label: 'Races & Lineages',
    description: 'Legacy race & lineage dataset'
  },
  {
    to: '/rules/feats',
    label: 'Feats',
    description: 'Browse feat references and prerequisites'
  },
  {
    to: '/rules/srd-attribution',
    label: 'SRD Attribution',
    description: 'CC-BY-4.0 attribution and legal note'
  }
];

export const RulesRoute = () => {
  return (
    <section className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="rounded-xl border border-slate-800 bg-slate-900/65 p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-sky-300">Stats & Rules</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Rules Browser</h1>
        <p className="mt-2 text-sm text-slate-300">
          Built-in reference tools for out-of-game preparation. No server requests required.
        </p>

        <nav className="mt-4 space-y-2">
          {navItems.map((item) => {
            if (item.disabled) {
              return (
                <div
                  key={item.label}
                  className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 opacity-60"
                >
                  <p className="text-sm font-medium text-slate-300">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.description}</p>
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
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
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0">
        <Outlet />
      </div>
    </section>
  );
};
