import { SpellPickerTable } from './SpellPickerTable';
import { SelectedSpellsPanel } from './SelectedSpellsPanel';

type SpellRow = {
  slug: string;
  name: string;
  level: number;
  source: string;
};

export const SpellChoicePanel = (props: {
  spellRows: SpellRow[];
  grantedSpellSlugs: string[];
  selectedCantrips: string[];
  selectedKnownSpells: string[];
  preparedSpells: string[];
  cantripsKnown: number | null;
  knownSpells: number | null;
  preparedMax: number | null;
  isPreparedCaster: boolean;
  isKnownCaster: boolean;
  onToggleCantrip: (slug: string) => void;
  onToggleKnownSpell: (slug: string) => void;
  onTogglePreparedSpell: (slug: string) => void;
}) => {
  const bySlug = new Map(props.spellRows.map((spell) => [spell.slug, spell]));
  const grantedRows = props.grantedSpellSlugs
    .map((slug) => bySlug.get(slug))
    .filter((row): row is SpellRow => !!row);
  const cantripRows = props.spellRows.filter((spell) => spell.level === 0);
  const leveledRows = props.spellRows.filter((spell) => spell.level > 0);

  return (
    <div className="space-y-3">
      {props.cantripsKnown && props.cantripsKnown > 0 ? (
        <SpellPickerTable
          title="Cantrips"
          spells={cantripRows}
          selectedSlugs={props.selectedCantrips}
          onToggleSpell={props.onToggleCantrip}
          maxSelected={props.cantripsKnown}
        />
      ) : null}

      {props.isKnownCaster ? (
        <SpellPickerTable
          title="Known Spells"
          spells={leveledRows}
          selectedSlugs={props.selectedKnownSpells}
          onToggleSpell={props.onToggleKnownSpell}
          maxSelected={props.knownSpells}
        />
      ) : null}

      {props.isPreparedCaster ? (
        <SpellPickerTable
          title="Prepared Spells"
          spells={leveledRows}
          selectedSlugs={props.preparedSpells}
          onToggleSpell={props.onTogglePreparedSpell}
          maxSelected={props.preparedMax}
        />
      ) : null}

      <SelectedSpellsPanel
        granted={grantedRows}
        selectedCantrips={props.selectedCantrips
          .map((slug) => bySlug.get(slug))
          .filter((row): row is SpellRow => !!row)}
        selectedKnown={props.selectedKnownSpells
          .map((slug) => bySlug.get(slug))
          .filter((row): row is SpellRow => !!row)}
        prepared={props.preparedSpells
          .map((slug) => bySlug.get(slug))
          .filter((row): row is SpellRow => !!row)}
      />
    </div>
  );
};

