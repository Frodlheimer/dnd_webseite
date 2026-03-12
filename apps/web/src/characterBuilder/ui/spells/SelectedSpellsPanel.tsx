type SpellRow = {
  slug: string;
  name: string;
  level: number;
  source: string;
};

const renderSpellList = (rows: SpellRow[]) => {
  if (rows.length === 0) {
    return <p className="text-xs text-slate-400">None selected.</p>;
  }
  return (
    <ul className="space-y-1 text-xs text-slate-200">
      {rows.map((spell) => (
        <li key={spell.slug} className="rounded border border-slate-700 bg-slate-950/40 px-2 py-1">
          {spell.name} <span className="text-slate-400">(lvl {spell.level === 0 ? 'cantrip' : spell.level})</span>
        </li>
      ))}
    </ul>
  );
};

export const SelectedSpellsPanel = (props: {
  granted: SpellRow[];
  selectedCantrips: SpellRow[];
  selectedKnown: SpellRow[];
  prepared: SpellRow[];
}) => {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/45 p-3">
      <h4 className="text-sm font-medium text-slate-100">Selected Spells</h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.15em] text-slate-400">Granted (locked)</p>
          {renderSpellList(props.granted)}
        </div>
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.15em] text-slate-400">Cantrips</p>
          {renderSpellList(props.selectedCantrips)}
        </div>
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.15em] text-slate-400">Known</p>
          {renderSpellList(props.selectedKnown)}
        </div>
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.15em] text-slate-400">Prepared</p>
          {renderSpellList(props.prepared)}
        </div>
      </div>
    </section>
  );
};

