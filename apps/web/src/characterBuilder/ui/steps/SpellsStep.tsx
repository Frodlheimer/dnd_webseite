import type { CharacterRecord } from '../../model/character';
import type { DerivedCharacterRuntime } from '../../engine/deriveCharacter';
import { SpellChoicePanel } from '../spells/SpellChoicePanel';

const toggleSpell = (current: string[], slug: string): string[] => {
  if (current.includes(slug)) {
    return current.filter((entry) => entry !== slug);
  }
  return [...current, slug];
};

export const SpellsStep = (props: {
  character: CharacterRecord;
  runtime: DerivedCharacterRuntime;
  onCantripsChange: (next: string[]) => void;
  onKnownSpellsChange: (next: string[]) => void;
  onPreparedSpellsChange: (next: string[]) => void;
}) => {
  if (props.runtime.spellLimits.casterType === 'NONE') {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-300">
        This class currently has no spellcasting selection requirements.
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-xs text-slate-300">
        <p>Caster type: {props.runtime.spellLimits.casterType}</p>
        <p>Max spell level available: {props.runtime.maxSpellLevel}</p>
        {props.runtime.spellLimits.preparedFormula ? (
          <p>Prepared formula: {props.runtime.spellLimits.preparedFormula}</p>
        ) : null}
      </div>
      <SpellChoicePanel
        spellRows={props.runtime.availableSpells}
        grantedSpellSlugs={props.character.spells.grantedSpells}
        selectedCantrips={props.character.spells.selectedCantrips}
        selectedKnownSpells={props.character.spells.selectedKnownSpells}
        preparedSpells={props.character.spells.preparedSpells}
        cantripsKnown={props.runtime.spellLimits.cantripsKnown}
        knownSpells={props.runtime.spellLimits.spellsKnown}
        preparedMax={props.runtime.spellLimits.preparedMax}
        isPreparedCaster={props.runtime.spellLimits.isPreparedCaster}
        isKnownCaster={props.runtime.spellLimits.isKnownSpellsCaster}
        onToggleCantrip={(slug) => props.onCantripsChange(toggleSpell(props.character.spells.selectedCantrips, slug))}
        onToggleKnownSpell={(slug) =>
          props.onKnownSpellsChange(toggleSpell(props.character.spells.selectedKnownSpells, slug))
        }
        onTogglePreparedSpell={(slug) =>
          props.onPreparedSpellsChange(toggleSpell(props.character.spells.preparedSpells, slug))
        }
      />
    </div>
  );
};

