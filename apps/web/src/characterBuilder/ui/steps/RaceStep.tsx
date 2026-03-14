import type { CharacterRecord } from '../../model/character';
import type { BuilderRaceSummary } from '../../rules/rulesFacade';
import { RuleReferenceButton } from '../RuleReferenceButton';

const parseCsv = (value: string): string[] => {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export const RaceStep = (props: {
  character: CharacterRecord;
  races: BuilderRaceSummary[];
  originRuntime: {
    availableSubraces: Array<{
      id: string;
      name: string;
      summary: string;
    }>;
    raceLanguageChoices: number;
    raceLanguageOptions: string[];
    raceToolChoices: number;
    raceToolOptions: string[];
    raceSkillChoices: number;
    raceSkillOptions: string[];
  };
  onRaceChange: (raceId: string) => void;
  onSubraceChange: (subraceId: string) => void;
  onRaceLanguagesChange: (values: string[]) => void;
  onRaceToolsChange: (values: string[]) => void;
  onRaceSkillsChange: (values: string[]) => void;
  onOpenRaceReference: (race: BuilderRaceSummary) => void;
  onOpenSubraceReference: (subraceId: string) => void;
}) => {
  const raceLanguageText = props.character.origin.selectedRaceLanguages.join(', ');
  const raceToolText = props.character.origin.selectedRaceToolProficiencies.join(', ');
  const raceSkillText = props.character.origin.selectedRaceSkills.join(', ');

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium text-slate-100">Choose race</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {props.races.map((race) => (
            <article
              key={race.id}
              className={`rounded-lg border p-3 text-left ${
                props.character.origin.raceId === race.id
                  ? 'border-sky-500/80 bg-sky-950/35'
                  : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => props.onRaceChange(race.id)} className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-semibold text-slate-100">{race.name}</p>
                  <p className="mt-1 text-xs text-slate-300">
                    Speed {race.speedFeet ?? '?'} ft
                    {Object.keys(race.abilityBonuses).length > 0
                      ? ` | Ability bonuses ${Object.entries(race.abilityBonuses)
                          .map(([ability, amount]) => `${ability.toUpperCase()} +${amount}`)
                          .join(', ')}`
                      : ''}
                  </p>
                </button>
                <RuleReferenceButton
                  label={`Open reference for ${race.name}`}
                  onClick={() => props.onOpenRaceReference(race)}
                />
              </div>
            </article>
          ))}
        </div>
      </div>

      {props.character.origin.mode === 'LEGACY_RACE' && props.originRuntime.availableSubraces.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-100">Choose subrace</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {props.originRuntime.availableSubraces.map((subrace) => (
              <article
                key={subrace.id}
                className={`rounded-lg border p-3 text-left ${
                  props.character.origin.subraceId === subrace.id
                    ? 'border-sky-500/80 bg-sky-950/35'
                    : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => props.onSubraceChange(subrace.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-semibold text-slate-100">{subrace.name}</p>
                    <p className="mt-1 text-xs text-slate-300">{subrace.summary}</p>
                  </button>
                  <RuleReferenceButton
                    label={`Open subrace reference for ${subrace.name}`}
                    onClick={() => props.onOpenSubraceReference(subrace.id)}
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {props.character.origin.mode === 'LEGACY_RACE' &&
      (props.originRuntime.raceLanguageChoices > 0 ||
        props.originRuntime.raceToolChoices > 0 ||
        props.originRuntime.raceSkillChoices > 0) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {props.originRuntime.raceLanguageChoices > 0 ? (
            <label className="text-sm text-slate-200">
              Race languages ({props.originRuntime.raceLanguageChoices})
              <input
                value={raceLanguageText}
                onChange={(event) => props.onRaceLanguagesChange(parseCsv(event.target.value))}
                placeholder={props.originRuntime.raceLanguageOptions.join(', ') || 'Choose languages'}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
              />
            </label>
          ) : null}
          {props.originRuntime.raceToolChoices > 0 ? (
            <label className="text-sm text-slate-200">
              Race tools ({props.originRuntime.raceToolChoices})
              <input
                value={raceToolText}
                onChange={(event) => props.onRaceToolsChange(parseCsv(event.target.value))}
                placeholder={props.originRuntime.raceToolOptions.join(', ') || 'Choose tools'}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
              />
            </label>
          ) : null}
          {props.originRuntime.raceSkillChoices > 0 ? (
            <label className="text-sm text-slate-200 sm:col-span-2">
              Race skills ({props.originRuntime.raceSkillChoices})
              <input
                value={raceSkillText}
                onChange={(event) => props.onRaceSkillsChange(parseCsv(event.target.value))}
                placeholder={props.originRuntime.raceSkillOptions.join(', ') || 'Choose skills'}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
              />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
