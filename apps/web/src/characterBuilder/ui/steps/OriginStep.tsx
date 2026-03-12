import type { CharacterRecord } from '../../model/character';
import type { BuilderBackground, BuilderRaceSummary } from '../../rules/rulesFacade';

const parseCsv = (value: string): string[] => {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export const OriginStep = (props: {
  character: CharacterRecord;
  races: BuilderRaceSummary[];
  backgrounds: BuilderBackground[];
  onModeChange: (mode: CharacterRecord['origin']['mode']) => void;
  onRaceChange: (raceId: string) => void;
  onBackgroundChange: (backgroundId: string) => void;
  onLanguagesChange: (values: string[]) => void;
  onToolsChange: (values: string[]) => void;
}) => {
  const languageText = props.character.origin.selectedLanguages.join(', ');
  const toolText = props.character.origin.selectedToolProficiencies.join(', ');

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
        <p className="mb-2 text-sm font-medium text-slate-100">Origin mode</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => props.onModeChange('SRD_5_2_BACKGROUND')}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              props.character.origin.mode === 'SRD_5_2_BACKGROUND'
                ? 'border-sky-500/80 bg-sky-950/35 text-sky-200'
                : 'border-slate-700 bg-slate-900 text-slate-300'
            }`}
          >
            SRD 5.2 Background
          </button>
          <button
            type="button"
            onClick={() => props.onModeChange('LEGACY_RACE')}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              props.character.origin.mode === 'LEGACY_RACE'
                ? 'border-sky-500/80 bg-sky-950/35 text-sky-200'
                : 'border-slate-700 bg-slate-900 text-slate-300'
            }`}
          >
            Legacy Race
          </button>
        </div>
      </section>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-100">Choose race / species</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {props.races.map((race) => (
            <button
              key={race.id}
              type="button"
              onClick={() => props.onRaceChange(race.id)}
              className={`rounded-lg border p-3 text-left ${
                props.character.origin.raceId === race.id
                  ? 'border-sky-500/80 bg-sky-950/35'
                  : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'
              }`}
            >
              <p className="text-sm font-semibold text-slate-100">{race.name}</p>
              <p className="mt-1 text-xs text-slate-300">
                Speed {race.speedFeet ?? '?'} ft
                {Object.keys(race.abilityBonuses).length > 0
                  ? ` | Legacy bonuses ${Object.entries(race.abilityBonuses)
                      .map(([ability, amount]) => `${ability.toUpperCase()} +${amount}`)
                      .join(', ')}`
                  : ''}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-100">Choose background</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {props.backgrounds.map((background) => (
            <button
              key={background.id}
              type="button"
              onClick={() => props.onBackgroundChange(background.id)}
              className={`rounded-lg border p-3 text-left ${
                props.character.origin.backgroundId === background.id
                  ? 'border-sky-500/80 bg-sky-950/35'
                  : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'
              }`}
            >
              <p className="text-sm font-semibold text-slate-100">{background.name}</p>
              <p className="mt-1 text-xs text-slate-300">{background.summary}</p>
              <p className="mt-1 text-xs text-slate-400">
                Skills: {background.skillProficiencies.join(', ') || 'None'} | Tools:{' '}
                {background.toolProficiencies.join(', ') || 'None'}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-200">
          Selected languages (comma-separated)
          <input
            value={languageText}
            onChange={(event) => props.onLanguagesChange(parseCsv(event.target.value))}
            placeholder="Common, Elvish"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm text-slate-200">
          Selected tools (comma-separated)
          <input
            value={toolText}
            onChange={(event) => props.onToolsChange(parseCsv(event.target.value))}
            placeholder="Thieves tools"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
      </div>
    </div>
  );
};

