import { useMemo, useState } from 'react';
import { RuleReferenceButton } from '../RuleReferenceButton';

type SpellRow = {
  slug: string;
  name: string;
  level: number;
  source: string;
};

export const SpellPickerTable = (props: {
  title: string;
  spells: SpellRow[];
  selectedSlugs: string[];
  onOpenSpellReference: (slug: string) => void;
  onToggleSpell: (slug: string) => void;
  maxSelected: number | null;
}) => {
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(props.selectedSlugs), [props.selectedSlugs]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return props.spells;
    }
    return props.spells.filter((spell) => spell.name.toLowerCase().includes(normalized));
  }, [props.spells, query]);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-slate-100">{props.title}</h4>
        <p className="text-xs text-slate-300">
          {props.selectedSlugs.length}
          {props.maxSelected ? ` / ${props.maxSelected}` : ''}
        </p>
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search spells..."
        className="mb-2 w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
      />
      <div className="max-h-72 overflow-auto rounded border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-900 text-slate-300">
            <tr>
              <th className="px-2 py-1">Pick</th>
              <th className="px-2 py-1">Name</th>
              <th className="px-2 py-1">Lvl</th>
              <th className="px-2 py-1">Source</th>
              <th className="px-2 py-1 text-center">Info</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((spell) => {
              const selected = selectedSet.has(spell.slug);
              const atLimit = !selected && props.maxSelected !== null && props.selectedSlugs.length >= props.maxSelected;
              return (
                <tr key={spell.slug} className="border-t border-slate-800 text-slate-200">
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={atLimit}
                      onChange={() => props.onToggleSpell(spell.slug)}
                    />
                  </td>
                  <td className="px-2 py-1.5">{spell.name}</td>
                  <td className="px-2 py-1.5">{spell.level === 0 ? 'C' : spell.level}</td>
                  <td className="px-2 py-1.5 text-slate-400">{spell.source}</td>
                  <td className="px-2 py-1.5 text-center">
                    <RuleReferenceButton
                      label={`Open spell reference for ${spell.name}`}
                      onClick={() => props.onOpenSpellReference(spell.slug)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
