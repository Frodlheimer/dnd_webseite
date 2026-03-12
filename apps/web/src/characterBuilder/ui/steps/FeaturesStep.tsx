import type { CharacterRecord } from '../../model/character';
import type { BuilderClassFeatureChoice } from '../../rules/rulesFacade';

const normalizeSelection = (value: string | string[] | number | boolean | undefined): string[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
};

export const FeaturesStep = (props: {
  character: CharacterRecord;
  featureChoices: BuilderClassFeatureChoice[];
  onFeatureChoiceChange: (choiceId: string, selectedOptionIds: string[]) => void;
}) => {
  if (props.featureChoices.length === 0) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-300">
        No explicit feature choices are currently required from available rules data.
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {props.featureChoices.map((choice) => {
        const selected = normalizeSelection(props.character.features.selectedChoices[choice.id]);
        return (
          <section key={choice.id} className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-100">{choice.title}</p>
              <p className="text-xs text-slate-300">
                {selected.length}/{choice.choiceCount}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {choice.options.map((option) => {
                const checked = selected.includes(option.id);
                const atLimit = !checked && selected.length >= choice.choiceCount;
                return (
                  <label
                    key={option.id}
                    className={`flex items-center gap-2 rounded border border-slate-700 px-2 py-1.5 text-sm ${
                      atLimit ? 'opacity-60' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={atLimit}
                      onChange={(event) => {
                        if (event.target.checked) {
                          props.onFeatureChoiceChange(choice.id, [...selected, option.id]);
                        } else {
                          props.onFeatureChoiceChange(
                            choice.id,
                            selected.filter((entry) => entry !== option.id)
                          );
                        }
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

