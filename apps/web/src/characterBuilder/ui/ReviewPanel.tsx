import type { CharacterRecord } from '../model/character';

const abilityOrder: Array<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'> = [
  'str',
  'dex',
  'con',
  'int',
  'wis',
  'cha'
];

export const ReviewPanel = (props: {
  character: CharacterRecord;
  onDownloadBlankSheet: () => void;
  onDownloadFilledSheet: () => void;
  onSaveNow: () => void;
  downloadBusy?: boolean;
  saveBusy?: boolean;
}) => {
  const senseRows = [
    props.character.derived.senses.darkvision
      ? `Darkvision ${props.character.derived.senses.darkvision} ft`
      : null,
    props.character.derived.senses.blindsight
      ? `Blindsight ${props.character.derived.senses.blindsight} ft`
      : null,
    props.character.derived.senses.tremorsense
      ? `Tremorsense ${props.character.derived.senses.tremorsense} ft`
      : null,
    props.character.derived.senses.truesight
      ? `Truesight ${props.character.derived.senses.truesight} ft`
      : null
  ].filter((row): row is string => !!row);
  const defenseRows = [
    props.character.derived.defenses.resistances.length > 0
      ? `Resistances: ${props.character.derived.defenses.resistances.join(', ')}`
      : null,
    props.character.derived.defenses.immunities.length > 0
      ? `Immunities: ${props.character.derived.defenses.immunities.join(', ')}`
      : null,
    props.character.derived.defenses.conditionImmunities.length > 0
      ? `Condition immunities: ${props.character.derived.defenses.conditionImmunities.join(', ')}`
      : null,
    props.character.derived.defenses.savingThrowAdvantages.length > 0
      ? `Saving throw advantages: ${props.character.derived.defenses.savingThrowAdvantages.join(', ')}`
      : null
  ].filter((row): row is string => !!row);

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-100">Final Review & Export</h2>
        <p className="mt-2 text-sm text-slate-300">
          Review your completed character, then export the filled General Character Sheet PDF.
        </p>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4">
        <h3 className="text-lg font-semibold text-slate-100">{props.character.meta.name}</h3>
        <p className="mt-1 text-sm text-slate-300">
          Status: {props.character.status} | Level {props.character.progression.level}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {abilityOrder.map((ability) => (
            <div key={ability} className="rounded border border-slate-700 bg-slate-950/45 px-2 py-1.5 text-xs">
              <span className="text-slate-400">{ability.toUpperCase()}</span>{' '}
              <span className="text-slate-100">{props.character.derived.abilityFinal[ability]}</span>{' '}
              <span className="text-slate-400">
                ({props.character.derived.abilityMods[ability] >= 0 ? '+' : ''}
                {props.character.derived.abilityMods[ability]})
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4 text-xs text-slate-300">
          <p>AC: {props.character.derived.armorClass ?? '-'}</p>
          <p>HP: {props.character.derived.hitPointsMax ?? '-'}</p>
          <p>Initiative: {props.character.derived.initiative >= 0 ? '+' : ''}{props.character.derived.initiative}</p>
          <p>Prof. bonus: +{props.character.derived.proficiencyBonus}</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-rose-600/30 bg-rose-950/20 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-rose-300">Errors</p>
          {props.character.validation.errors.length === 0 ? (
            <p className="mt-2 text-sm text-slate-300">No blocking errors.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-rose-100">
              {props.character.validation.errors.map((issue) => (
                <li key={issue.id}>{issue.message}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-amber-600/30 bg-amber-950/20 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-300">Warnings</p>
          {props.character.validation.warnings.length === 0 ? (
            <p className="mt-2 text-sm text-slate-300">No warnings.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-amber-100">
              {props.character.validation.warnings.map((issue) => (
                <li key={issue.id}>{issue.message}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {props.character.derived.raceTraitNames.length > 0 ||
      senseRows.length > 0 ||
      defenseRows.length > 0 ||
      props.character.derived.backgroundFeatureName ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4">
          <h3 className="text-lg font-semibold text-slate-100">Origin traits</h3>
          {props.character.derived.raceTraitNames.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Traits</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {props.character.derived.raceTraitNames.map((trait) => (
                  <span
                    key={trait}
                    className="rounded-full border border-slate-700 bg-slate-950/45 px-3 py-1 text-xs text-slate-200"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {senseRows.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Senses</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-200">
                {senseRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {defenseRows.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Defenses</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-200">
                {defenseRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {props.character.derived.backgroundFeatureName ? (
            <div className="mt-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Background feature</p>
              <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950/45 px-3 py-3">
                <p className="text-sm font-semibold text-slate-100">
                  {props.character.derived.backgroundFeatureName}
                </p>
                {props.character.derived.backgroundFeatureText ? (
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-300">
                    {props.character.derived.backgroundFeatureText}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={props.onDownloadBlankSheet}
            className="rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 hover:border-sky-500"
          >
            Download blank General Sheet
          </button>
          <button
            type="button"
            onClick={props.onDownloadFilledSheet}
            disabled={props.downloadBusy}
            className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
          >
            {props.downloadBusy ? 'Generating PDF...' : 'Download filled General Sheet'}
          </button>
          <button
            type="button"
            onClick={props.onSaveNow}
            disabled={props.saveBusy}
            className="rounded-lg border border-emerald-500/70 bg-emerald-950/35 px-3 py-2 text-sm text-emerald-100 disabled:opacity-60"
          >
            {props.saveBusy ? 'Saving...' : 'Save character locally'}
          </button>
        </div>
      </section>
    </section>
  );
};
