import type { CharacterRecord, Ability } from '../../model/character';
import type { FeatEntryMeta } from '../../../rules/feats/types';

const abilityOptions: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const formatAbility = (ability: Ability): string => ability.toUpperCase();

const defaultAsi = (): Partial<Record<Ability, number>> => ({
  str: 1,
  dex: 1
});

export const AsiFeatsStep = (props: {
  character: CharacterRecord;
  asiLevels: number[];
  feats: FeatEntryMeta[];
  onSetAsiChoice: (args: {
    level: number;
    choice:
      | { kind: 'ASI'; increases: Partial<Record<Ability, number>> }
      | { kind: 'FEAT'; featId: string | null; bonusAssignments?: Partial<Record<Ability, number>> };
  }) => void;
}) => {
  if (props.asiLevels.length === 0) {
    return (
      <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-300">
        No ASI / feat opportunities are available for the selected class.
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {props.asiLevels
        .filter((level) => level <= props.character.progression.level)
        .map((level) => {
          const current = props.character.featsAndAsi.opportunities.find((entry) => entry.level === level);
          const currentChoice = current?.choice;
          const asiChoice = currentChoice?.kind === 'ASI' ? currentChoice : null;
          const featChoice = currentChoice?.kind === 'FEAT' ? currentChoice : null;
          const nextFeatChoice = (): {
            kind: 'FEAT';
            featId: string | null;
            bonusAssignments?: Partial<Record<Ability, number>>;
          } => {
            if (featChoice?.bonusAssignments) {
              return {
                kind: 'FEAT',
                featId: featChoice.featId,
                bonusAssignments: featChoice.bonusAssignments
              };
            }
            return {
              kind: 'FEAT',
              featId: featChoice?.featId ?? null
            };
          };

          return (
            <section key={level} className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-100">Level {level}</p>
              </div>

              <div className="mb-2 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    props.onSetAsiChoice({
                      level,
                      choice: {
                        kind: 'ASI',
                        increases: asiChoice ? asiChoice.increases : defaultAsi()
                      }
                    })
                  }
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    asiChoice
                      ? 'border-sky-500/80 bg-sky-950/35 text-sky-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300'
                  }`}
                >
                  ASI
                </button>
                <button
                  type="button"
                  onClick={() =>
                    props.onSetAsiChoice({
                      level,
                      choice: nextFeatChoice()
                    })
                  }
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    featChoice
                      ? 'border-sky-500/80 bg-sky-950/35 text-sky-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300'
                  }`}
                >
                  Feat
                </button>
              </div>

              {asiChoice ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  {abilityOptions.map((ability) => (
                    <label key={ability} className="text-xs text-slate-300">
                      {formatAbility(ability)}
                      <input
                        type="number"
                        min={0}
                        max={2}
                        value={asiChoice.increases[ability] ?? 0}
                        onChange={(event) =>
                          props.onSetAsiChoice({
                            level,
                            choice: {
                              kind: 'ASI',
                              increases: {
                                ...asiChoice.increases,
                                [ability]: Number.parseInt(event.target.value, 10)
                              }
                            }
                          })
                        }
                        className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                      />
                    </label>
                  ))}
                </div>
              ) : null}

              {featChoice ? (
                <div className="space-y-2">
                  <label className="block text-xs text-slate-300">
                    Feat
                    <select
                      value={featChoice.featId ?? ''}
                      onChange={(event) =>
                        props.onSetAsiChoice({
                          level,
                          choice: {
                            ...featChoice,
                            featId: event.target.value || null
                          }
                        })
                      }
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                    >
                      <option value="">Select feat</option>
                      {props.feats.map((feat) => (
                        <option key={feat.id} value={feat.id}>
                          {feat.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {abilityOptions.map((ability) => (
                      <label key={ability} className="text-xs text-slate-300">
                        Feat bonus {formatAbility(ability)}
                        <input
                          type="number"
                          min={0}
                          max={1}
                          value={featChoice.bonusAssignments?.[ability] ?? 0}
                          onChange={(event) =>
                            props.onSetAsiChoice({
                              level,
                              choice: {
                                ...featChoice,
                                bonusAssignments: {
                                  ...(featChoice.bonusAssignments ?? {}),
                                  [ability]: Number.parseInt(event.target.value, 10)
                                }
                              }
                            })
                          }
                          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
    </div>
  );
};
