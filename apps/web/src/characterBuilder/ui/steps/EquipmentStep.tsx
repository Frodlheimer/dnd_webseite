import type { CharacterRecord } from '../../model/character';
import type { BuilderEquipmentChoice } from '../../rules/rulesFacade';

export const EquipmentStep = (props: {
  character: CharacterRecord;
  choices: BuilderEquipmentChoice[];
  onStartingModeChange: (mode: CharacterRecord['equipment']['startingMode']) => void;
  onSelectPackageOption: (decisionId: string, optionId: string) => void;
}) => {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
        <p className="mb-2 text-sm font-medium text-slate-100">Starting mode</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => props.onStartingModeChange('package')}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              props.character.equipment.startingMode === 'package'
                ? 'border-sky-500/80 bg-sky-950/35 text-sky-200'
                : 'border-slate-700 bg-slate-900 text-slate-300'
            }`}
          >
            Package
          </button>
          <button
            type="button"
            onClick={() => props.onStartingModeChange('gold')}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              props.character.equipment.startingMode === 'gold'
                ? 'border-sky-500/80 bg-sky-950/35 text-sky-200'
                : 'border-slate-700 bg-slate-900 text-slate-300'
            }`}
          >
            Gold
          </button>
        </div>
      </section>

      {props.choices.length === 0 ? (
        <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-300">
          No equipment package choices were detected for the selected class data.
        </section>
      ) : (
        props.choices.map((choice) => {
          const selected = props.character.equipment.selectedPackages.find(
            (entry) => entry.decisionId === choice.id
          );
          return (
            <section key={choice.id} className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
              <p className="mb-2 text-sm font-medium text-slate-100">{choice.title}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {choice.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => props.onSelectPackageOption(choice.id, option.id)}
                    className={`rounded-lg border p-2 text-left text-sm ${
                      selected?.optionId === option.id
                        ? 'border-sky-500/80 bg-sky-950/35 text-sky-100'
                        : 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    <p>{option.label}</p>
                  </button>
                ))}
              </div>
            </section>
          );
        })
      )}

      <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
        <p className="mb-2 text-sm font-medium text-slate-100">Current inventory</p>
        <ul className="space-y-1 text-xs text-slate-200">
          {props.character.equipment.items.map((item) => (
            <li key={`${item.id}-${item.name}`}>
              {item.quantity}x {item.name}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

