import type { MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import type { SpellMeta } from '../types';

type SpellsTableProps = {
  spells: SpellMeta[];
};

const SpellFlagsSuperscript = ({ spell }: { spell: SpellMeta }) => {
  if (spell.flagCodes.length === 0) {
    return null;
  }

  return (
    <sup className="ml-1 inline-flex flex-wrap gap-0.5 align-super">
      {spell.flagCodes.map((code) => (
        <span
          key={`${spell.slug}-${code}`}
          className="rounded bg-slate-800 px-1 py-0.5 text-[9px] font-semibold text-sky-300"
        >
          {code}
        </span>
      ))}
    </sup>
  );
};

export const SpellsTable = ({ spells }: SpellsTableProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSpellClick = (event: MouseEvent<HTMLAnchorElement>, slug: string) => {
    // Keep native browser behavior for middle click / cmd-click / ctrl-click (new tab).
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
      return;
    }

    event.preventDefault();
    navigate(`/rules/spells/${slug}`, {
      state: {
        backgroundLocation: location
      }
    });
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-950/50">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
          <tr>
            <th scope="col" className="px-3 py-2">
              Name
            </th>
            <th scope="col" className="px-3 py-2">
              School
            </th>
            <th scope="col" className="px-3 py-2">
              Casting Time
            </th>
            <th scope="col" className="px-3 py-2">
              Range
            </th>
            <th scope="col" className="px-3 py-2">
              Duration
            </th>
            <th scope="col" className="px-3 py-2">
              Components
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/80">
          {spells.map((spell) => (
            <tr key={spell.slug} className="hover:bg-slate-900/50">
              <td className="px-3 py-2 align-top">
                <Link
                  to={`/rules/spells/${spell.slug}`}
                  onClick={(event) => handleSpellClick(event, spell.slug)}
                  className="font-medium text-sky-300 hover:text-sky-200 hover:underline"
                >
                  {spell.name}
                </Link>
                <SpellFlagsSuperscript spell={spell} />
              </td>
              <td className="px-3 py-2 align-top text-slate-300">{spell.school}</td>
              <td className="px-3 py-2 align-top text-slate-300">{spell.castingTime}</td>
              <td className="px-3 py-2 align-top text-slate-300">{spell.range}</td>
              <td className="px-3 py-2 align-top text-slate-300">{spell.duration}</td>
              <td className="px-3 py-2 align-top text-slate-300">{spell.components}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

