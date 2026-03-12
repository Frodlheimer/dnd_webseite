import type { CharacterRecord } from '../../model/character';
import type { BuilderClassSummary, BuilderSubclassSummary } from '../../rules/rulesFacade';

export const BasicsStep = (props: {
  character: CharacterRecord;
  classes: BuilderClassSummary[];
  subclasses: BuilderSubclassSummary[];
  subclassRequired: boolean;
  onNameChange: (value: string) => void;
  onPlayerNameChange: (value: string) => void;
  onLevelChange: (value: number) => void;
  onClassChange: (classId: string) => void;
  onSubclassChange: (subclassId: string) => void;
}) => {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-200">
          Character name
          <input
            value={props.character.meta.name}
            onChange={(event) => props.onNameChange(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm text-slate-200">
          Player name
          <input
            value={props.character.meta.playerName ?? ''}
            onChange={(event) => props.onPlayerNameChange(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
      </div>

      <label className="block text-sm text-slate-200">
        Level (1-20)
        <input
          type="number"
          min={1}
          max={20}
          value={props.character.progression.level}
          onChange={(event) => props.onLevelChange(Number.parseInt(event.target.value, 10))}
          className="mt-1 w-24 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        />
      </label>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-100">Choose class</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {props.classes.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => props.onClassChange(entry.id)}
              className={`rounded-lg border p-3 text-left transition ${
                props.character.progression.classId === entry.id
                  ? 'border-sky-500/80 bg-sky-950/35'
                  : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'
              }`}
            >
              <p className="text-sm font-semibold text-slate-100">{entry.name}</p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-300">{entry.summary}</p>
            </button>
          ))}
        </div>
      </div>

      {props.subclassRequired ? (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-100">Choose subclass</p>
          {props.subclasses.length === 0 ? (
            <p className="text-sm text-slate-400">No subclass data found for this class.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {props.subclasses.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => props.onSubclassChange(entry.id)}
                  className={`rounded-lg border p-3 text-left transition ${
                    props.character.progression.subclassId === entry.id
                      ? 'border-sky-500/80 bg-sky-950/35'
                      : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-100">{entry.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-300">{entry.summary}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

